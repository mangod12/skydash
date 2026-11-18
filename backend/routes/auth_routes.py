"""Authentication routes: login, register, current user."""

import logging
import os
import sqlite3
import time
from collections import deque

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from auth import create_token, issue_ws_ticket, revoke_token
from client_ip import client_ip
from deps import AUTH_ENABLED, user_store
from models import AuthLogin, AuthRegister
from password_policy import check_password

log = logging.getLogger("skydash")
router = APIRouter()

# Failed-login throttle: max attempts per (client, username) per window.
LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW_SECONDS = 60
LOGIN_MAX_TRACKED = 10000
_login_failures = {}
_login_pending = {}
_last_login_sweep = 0.0


def _throttle_key(request: Request, username: str) -> str:
    client = client_ip(request)
    return f"{client}:{username.lower()}"


def _recent_failures(key: str):
    """Return a failure bucket, or None when active buckets fill the cap.

    Never evict live buckets: doing so would let username churn reset a lockout.
    """
    global _last_login_sweep
    now = time.monotonic()
    cutoff = now - LOGIN_WINDOW_SECONDS
    if now - _last_login_sweep >= LOGIN_WINDOW_SECONDS:
        for old_key, bucket in list(_login_failures.items()):
            if not _login_pending.get(old_key) and (not bucket or bucket[-1] <= cutoff):
                _login_failures.pop(old_key, None)
        _last_login_sweep = now
    failures = _login_failures.get(key)
    if failures is None:
        if len(_login_failures) >= LOGIN_MAX_TRACKED:
            return None
        failures = _login_failures[key] = deque()
    while failures and failures[0] <= cutoff:
        failures.popleft()
    return failures


@router.post("/api/auth/login")
async def auth_login(body: AuthLogin, request: Request):
    # Lets the audit trail record who tried to sign in (role stays empty: not authenticated yet).
    request.state.attempted_username = (body.username or "")[:64]
    if not user_store:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Auth not enabled"},
        )
    key = _throttle_key(request, body.username)
    failures = _recent_failures(key)
    if failures is None or len(failures) + _login_pending.get(key, 0) >= LOGIN_MAX_FAILURES:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(LOGIN_WINDOW_SECONDS)},
            content={"success": False, "error": "Too many failed attempts, try again shortly"},
        )
    # Reserve before yielding so concurrent attempts cannot bypass the limit.
    # Only the blocking password/database work leaves the event loop.
    _login_pending[key] = _login_pending.get(key, 0) + 1
    try:
        user = await run_in_threadpool(user_store.authenticate, body.username, body.password)
    finally:
        remaining = _login_pending[key] - 1
        if remaining:
            _login_pending[key] = remaining
        else:
            _login_pending.pop(key, None)
    if not user:
        failures.append(time.monotonic())
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Invalid credentials"},
        )
    token = create_token(user)
    failures.clear()
    if not _login_pending.get(key):
        _login_failures.pop(key, None)
    safe_user = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    }
    return {"success": True, "data": {"token": token, "user": safe_user}}


@router.post("/api/auth/register")
async def auth_register(body: AuthRegister):
    # Public sign-up never grants elevated roles; body.role is ignored.
    # Set SKYDASH_ALLOW_REGISTRATION=false to close self-registration (production).
    if os.getenv("SKYDASH_ALLOW_REGISTRATION", "true").lower() in ("0", "false", "no"):
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": "Self-registration is disabled"},
        )
    if not user_store:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Auth not enabled"},
        )
    problem = check_password(body.username, body.password)
    if problem:
        return JSONResponse(status_code=422, content={"success": False, "error": problem})
    if user_store.username_exists(body.username):
        return JSONResponse(
            status_code=409,
            content={"success": False, "error": "Username taken"},
        )
    try:
        uid = user_store.create_user(body.username, body.password, "analyst")
        user = user_store.get_user(uid)
        token = create_token(user)
        return {"success": True, "data": {"token": token, "user": user}}
    except sqlite3.IntegrityError:
        # Another registration may have claimed the name after the precheck.
        # create_user has already rolled back the failed transaction.
        if user_store.username_exists(body.username):
            return JSONResponse(
                status_code=409,
                content={"success": False, "error": "Username taken"},
            )
        log.exception("Database constraint error registering user")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Internal server error"},
        )
    except Exception as exc:
        log.error(f"Error registering user: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Internal server error"},
        )


@router.get("/api/auth/me")
async def auth_me(request: Request):
    if not AUTH_ENABLED:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Auth not enabled"},
        )
    payload = getattr(request.state, "user", None)
    if not payload:
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Not authenticated"},
        )
    user = user_store.get_user(payload["sub"])
    if not user:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "User not found"},
        )
    return {"success": True, "data": user}


@router.post("/api/auth/ws-ticket")
async def auth_ws_ticket(request: Request):
    """One-time, 30s ticket for opening the telemetry WebSocket without the token in the URL."""
    payload = getattr(request.state, "user", None)
    raw = request.headers.get("Authorization", "")
    if not AUTH_ENABLED or not payload or not raw.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"success": False, "error": "Not authenticated"})
    ticket = issue_ws_ticket(raw[7:])
    if ticket is None:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": "30"},
            content={"success": False, "error": "Too many pending WebSocket tickets, try again shortly"},
        )
    return {"success": True, "data": {"ticket": ticket}}


@router.post("/api/auth/logout")
async def auth_logout(request: Request):
    """Revoke the presented token so it stops working immediately, not at expiry."""
    payload = getattr(request.state, "user", None)
    if not AUTH_ENABLED or not payload:
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Not authenticated"},
        )
    revoke_token(payload)
    return {"success": True}


# ── User administration (commander only, enforced by rbac) ────────

from typing import Optional  # noqa: E402
from pydantic import BaseModel, StrictBool  # noqa: E402

VALID_ROLES = ("viewer", "analyst", "operator", "commander")


class UserUpdate(BaseModel):
    role: Optional[str] = None
    disabled: Optional[StrictBool] = None


@router.get("/api/users")
async def users_list():
    if not user_store:
        return JSONResponse(status_code=400, content={"success": False, "error": "Auth not enabled"})
    return {"success": True, "data": user_store.list_users()}


@router.patch("/api/users/{user_id}")
async def users_update(user_id: str, body: UserUpdate, request: Request):
    if not user_store:
        return JSONResponse(status_code=400, content={"success": False, "error": "Auth not enabled"})
    if body.role is not None and body.role not in VALID_ROLES:
        return JSONResponse(status_code=422, content={"success": False, "error": "Unknown role"})
    me = getattr(request.state, "user", None) or {}
    if me.get("sub") == user_id and (body.disabled or (body.role and body.role != me.get("role"))):
        return JSONResponse(
            status_code=409,
            content={"success": False, "error": "You cannot change your own role or disable yourself"},
        )
    updated = user_store.update_user(user_id, body.role, body.disabled)
    if not updated:
        return JSONResponse(status_code=404, content={"success": False, "error": "User not found"})
    return {"success": True, "data": updated}
