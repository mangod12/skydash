"""Authentication routes: login, register, current user."""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from auth import create_token
from deps import AUTH_ENABLED, user_store
from models import AuthLogin, AuthRegister

log = logging.getLogger("skydash")
router = APIRouter()


@router.post("/api/auth/login")
async def auth_login(body: AuthLogin):
    if not user_store:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Auth not enabled"},
        )
    user = user_store.authenticate(body.username, body.password)
    if not user:
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Invalid credentials"},
        )
    token = create_token(user)
    safe_user = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    }
    return {"success": True, "data": {"token": token, "user": safe_user}}


@router.post("/api/auth/register")
async def auth_register(body: AuthRegister):
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
        uid = user_store.create_user(body.username, body.password, body.role)
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
