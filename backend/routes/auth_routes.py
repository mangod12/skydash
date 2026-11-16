"""Authentication routes: login, register, current user."""

import logging
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from auth import create_token
from deps import AUTH_ENABLED, user_store
from models import AuthLogin, AuthRegister

log = logging.getLogger("skydash")
router = APIRouter()

# Failed-login throttle: max attempts per (client, username) per window.
LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW_SECONDS = 60
_login_failures = defaultdict(deque)


def _throttle_key(request: Request, username: str) -> str:
    client = request.client.host if request.client else "unknown"
    return f"{client}:{username.lower()}"


def _recent_failures(key: str) -> deque:
    failures = _login_failures[key]
    cutoff = time.monotonic() - LOGIN_WINDOW_SECONDS
    while failures and failures[0] < cutoff:
        failures.popleft()
    return failures


@router.post("/api/auth/login")
async def auth_login(body: AuthLogin, request: Request):
    if not user_store:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Auth not enabled"},
        )
    key = _throttle_key(request, body.username)
    failures = _recent_failures(key)
    if len(failures) >= LOGIN_MAX_FAILURES:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(LOGIN_WINDOW_SECONDS)},
            content={"success": False, "error": "Too many failed attempts, try again shortly"},
        )
    user = user_store.authenticate(body.username, body.password)
    if not user:
        failures.append(time.monotonic())
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Invalid credentials"},
        )
    token = create_token(user)
    failures.clear()
    safe_user = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    }
    return {"success": True, "data": {"token": token, "user": safe_user}}


@router.post("/api/auth/register")
async def auth_register(body: AuthRegister):
    # Public sign-up never grants elevated roles; body.role is ignored.
    if not user_store:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Auth not enabled"},
        )
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
