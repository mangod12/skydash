"""SkyDash Spatial Intelligence API — application entry point."""

import asyncio
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import verify_token
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
from routes.telemetry import router as telemetry_router
from routes.entities import router as entities_router
from routes.missions import router as missions_router
from routes.vision import router as vision_router
from routes.auth_routes import router as auth_router
from routes.connectors import router as connectors_router
from routes.export import router as export_router

log = logging.getLogger("skydash")

# ── App ──────────────────────────────────────────────────────

app = FastAPI(
    title="SkyDash Spatial Intelligence API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount route modules ──────────────────────────────────────

app.include_router(telemetry_router)
app.include_router(entities_router)
app.include_router(missions_router)
app.include_router(vision_router)
app.include_router(auth_router)
app.include_router(connectors_router)
app.include_router(export_router)

# ── Startup: telemetry recorder ──────────────────────────────


@app.on_event("startup")
async def start_telemetry_recorder():
    """Sample fleet telemetry every second into a ring buffer."""
    async def record():
        while True:
            snapshot = {
                "timestamp": time.time(),
                "drones": fleet.get_all_telemetry(),
            }
            telemetry_history.append(snapshot)
            await asyncio.sleep(1)
    asyncio.create_task(record())


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
        request.state.user = payload
    return await call_next(request)


# ── Error handling ───────────────────────────────────────────


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
        "uptime": round(time.time() - start_time, 1),
        "drones": len(fleet.drones),
        "entities": len(entity_store.entities),
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
