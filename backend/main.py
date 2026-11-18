"""SkyDash Spatial Intelligence API — application entry point."""

import asyncio
import contextlib
import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import verify_token
from client_ip import client_ip
import ratelimit
from deps import (
    API_KEY,
    AUTH_ENABLED,
    CORS_ORIGINS,
    HOST,
    PORT,
    entity_store,
    fleet,
    mission_store,
    opensky,
    shodan,
    start_time,
    telemetry_history,
)
import audit
import cot_stream
from rbac import has_role, required_role
from routes.telemetry import router as telemetry_router
from routes.entities import router as entities_router
from routes.missions import router as missions_router
from routes.vision import router as vision_router
from routes.auth_routes import router as auth_router
from routes.connectors import router as connectors_router
from routes.export import router as export_router
from routes.demo import router as demo_router

log = logging.getLogger("skydash")

# ── App ──────────────────────────────────────────────────────

@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    """Sample fleet telemetry every second into a ring buffer."""
    async def record():
        while True:
            try:
                snapshot = {
                    "timestamp": time.time(),
                    "drones": fleet.get_all_telemetry(),
                }
                telemetry_history.append(snapshot)
            except Exception:
                # A transient adapter failure must not stop history collection.
                # Skip the failed sample rather than recording fabricated empty data.
                log.exception("Telemetry history sample failed")
            await asyncio.sleep(1)

    task = asyncio.create_task(record())
    cot_task = None
    cot_target = cot_stream.parse_target(os.getenv("SKYDASH_COT_TARGET"))
    if cot_target:
        cot_task = asyncio.create_task(cot_stream.run_stream(
            entity_store.list_entities, fleet.get_all_telemetry,
            cot_target, cot_stream.interval_from_env()))
    try:
        yield
    finally:
        for t in (task, cot_task):
            if t is None:
                continue
            t.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await t


app = FastAPI(
    title="SkyDash Spatial Intelligence API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# ── Mount route modules ──────────────────────────────────────

app.include_router(telemetry_router)
app.include_router(entities_router)
app.include_router(missions_router)
app.include_router(vision_router)
app.include_router(auth_router)
app.include_router(connectors_router)
app.include_router(export_router)
app.include_router(demo_router)

# ── Auth middleware ──────────────────────────────────────────

SKIP_AUTH_PATHS = {
    "/health", "/docs", "/openapi.json", "/",
    "/api/auth/login", "/api/auth/register",
}


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path in SKIP_AUTH_PATHS or path.startswith("/ws/"):
        return await call_next(request)
    if API_KEY and not AUTH_ENABLED:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if token != API_KEY:
            return JSONResponse(
                status_code=401,
                content={"success": False, "error": "Invalid or missing API key"},
            )
        return await call_next(request)
    if AUTH_ENABLED:
        raw = request.headers.get("Authorization", "")
        if not raw.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"success": False, "error": "Missing auth token"},
            )
        payload = verify_token(raw[7:])
        if not payload:
            return JSONResponse(
                status_code=401,
                content={"success": False, "error": "Invalid or expired token"},
            )
        request.state.user = payload  # set first so denials are audited with identity
        needed = required_role(request.method, path)
        if not has_role(payload.get("role"), needed):
            log.warning(
                "RBAC denied: user=%s role=%s %s %s needs=%s",
                payload.get("username"), payload.get("role"),
                request.method, path, needed,
            )
            return JSONResponse(
                status_code=403,
                content={
                    "success": False,
                    "error": f"Requires {needed} role or higher",
                },
            )
        request.state.user = payload
    return await call_next(request)


MAX_BODY_BYTES = int(os.getenv("SKYDASH_MAX_BODY_BYTES", str(25 * 1024 * 1024)))


@app.middleware("http")
async def hardening_middleware(request: Request, call_next):
    """Reject oversized bodies and add baseline security headers to every response."""
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        response = JSONResponse(
            status_code=413,
            content={"success": False, "error": "Request body too large"},
        )
    elif "chunked" in request.headers.get("transfer-encoding", "").lower():
        # The size cap relies on Content-Length; a chunked body would skip it.
        response = JSONResponse(
            status_code=411,
            content={"success": False, "error": "Content-Length required"},
        )
    else:
        wait = ratelimit.check(client_ip(request), request.url.path)
        if wait is not None:
            response = JSONResponse(
                status_code=429,
                headers={"Retry-After": str(wait)},
                content={"success": False, "error": "Rate limit exceeded, slow down"},
            )
        else:
            response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
    if request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    # Outermost middleware: sees auth denials (401/403) as well as handler results.
    path = request.url.path
    audited = AUTH_ENABLED and audit.should_audit(request.method, path)
    try:
        response = await call_next(request)
    except Exception:
        if audited:
            audit.record(request.method, path, 500, getattr(request.state, "user", None),
                         client_ip(request))
        raise
    if audited:
        who = getattr(request.state, "user", None)
        if not who and getattr(request.state, "attempted_username", None):
            who = {"username": request.state.attempted_username}
        audit.record(request.method, path, response.status_code, who,
                     client_ip(request))
    return response


# CORS is added last so it is the outermost middleware: early responses from the
# auth, body-size and audit layers (401, 403, 413) must carry CORS headers too, or
# a cross-origin frontend cannot read them and mistakes "auth required" for "auth off".
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Error handling ───────────────────────────────────────────


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Keep useful field errors without echoing credentials or non-JSON input.
    errors = [{key: error[key] for key in ("type", "loc", "msg") if key in error}
              for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"},
    )


# ── Health & Root ────────────────────────────────────────────


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "uptime": round(time.monotonic() - start_time, 1),
        "drones": len(fleet.drones),
        "entities": entity_store.count(),
        "missions": mission_store.count(),
        "telemetry_samples": len(telemetry_history),
        "connectors": {
            "opensky": {"available": True, "cached": len(opensky.cache)},
            "shodan": {
                "available": shodan.available,
                "mode": "live" if shodan.available else "mock",
            },
        },
    }


@app.get("/api/audit")
async def get_audit(limit: int = 100, username: str = None, since: float = None):
    """Audit trail, newest first. Commander role only (enforced in middleware)."""
    return {"success": True, "data": audit.query(limit, username, since)}


@app.get("/api/audit/export")
async def export_audit(limit: int = 10000, username: str = None, since: float = None):
    """Audit trail as CSV, newest first, up to 10000 rows. Commander role only."""
    from fastapi.responses import Response
    rows = audit.query(limit, username, since, max_limit=10000)
    return Response(
        audit.to_csv(rows),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="skydash-audit-{int(time.time())}.csv"'},
    )


@app.get("/")
async def root():
    return {
        "name": "SkyDash Spatial Intelligence API",
        "version": "2.0.0",
        "drones": list(fleet.drones.keys()),
        "endpoints": {
            "/health": "Health check",
            "/telemetry": "All drones telemetry",
            "/telemetry/{drone_id}": "Single drone telemetry",
            "/ws/telemetry": "WebSocket telemetry stream",
            "/api/telemetry/history": "Historical telemetry data",
            "/api/telemetry/stats": "Fleet aggregate statistics",
            "/api/entities": "Entity CRUD",
            "/api/missions": "Mission CRUD",
            "/api/vision/status": "Optional RT-DETR detector status",
            "/api/vision/sample-feed": "Optional MJPEG sample monitoring feed",
            "/api/vision/sample-frame": "Optional JPEG sample monitoring frame",
            "/api/vision/sample-viewer": "RT-DETR sample feed viewer",
            "/api/missions/{id}/detections": "Mission detection results",
            "/api/missions/{id}/detections/analyze": "Analyze a mission frame with RT-DETR",
            "/api/missions/{id}/detections/sample-monitor": "Analyze the sample feed frame with RT-DETR",
            "/api/missions/{id}/detections/{detection_id}": "Delete a mission detection result",
            "/api/timeline": "Event timeline",
            "/api/connectors/adsb": "ADS-B aircraft (OpenSky)",
            "/api/connectors/adsb/entities": "ADS-B as SkyDash entities",
            "/api/connectors/shodan": "Shodan IoT search",
            "/api/connectors/shodan/entities": "Shodan as SkyDash entities",
            "/api/connectors/status": "Connector status overview",
            "/docs": "API documentation",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
