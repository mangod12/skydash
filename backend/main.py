import asyncio
import logging
import os
import time
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from simulation import FleetSimulator
from entities import EntityStore

# ─── Config ──────────────────────────────────────────────────

PORT = int(os.getenv("SKYDASH_PORT", "8001"))
HOST = os.getenv("SKYDASH_HOST", "0.0.0.0")
API_KEY = os.getenv("SKYDASH_API_KEY", "")  # Empty = no auth (dev mode)
CORS_ORIGINS = os.getenv(
    "SKYDASH_CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:4173,http://localhost:80,http://localhost"
).split(",")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("skydash")

# ─── App ─────────────────────────────────────────────────────

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

fleet = FleetSimulator()
entity_store = EntityStore()
start_time = time.time()


# ─── Auth middleware ─────────────────────────────────────────

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Skip auth for health, docs, openapi, and WebSocket upgrade
    skip_paths = {"/health", "/docs", "/openapi.json", "/"}
    if not API_KEY or request.url.path in skip_paths or request.url.path.startswith("/ws/"):
        return await call_next(request)

    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token != API_KEY:
        return JSONResponse(status_code=401, content={"success": False, "error": "Invalid or missing API key"})

    return await call_next(request)


# ─── Error handling ──────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"},
    )


# ─── Health ──────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "uptime": round(time.time() - start_time, 1),
        "drones": len(fleet.drones),
        "entities": len(entity_store.entities),
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
            "/api/entities": "Entity CRUD",
            "/api/timeline": "Event timeline",
            "/docs": "API documentation",
        },
    }


# ─── REST: Telemetry ────────────────────────────────────────

@app.get("/telemetry")
async def get_all_telemetry():
    return {"success": True, "data": fleet.get_all_telemetry()}


@app.get("/telemetry/{drone_id}")
async def get_drone_telemetry(drone_id: str):
    data = fleet.get_drone_telemetry(drone_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Drone {drone_id} not found")
    return {"success": True, "data": data}


@app.post("/reset")
async def reset_simulation():
    fleet.reset()
    log.info("Simulation reset")
    return {"success": True, "data": {"message": "Simulation reset"}}


# ─── WebSocket: Telemetry Stream ─────────────────────────────

@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    await websocket.accept()
    log.info(f"WebSocket client connected: {websocket.client}")
    try:
        while True:
            payload = fleet.get_all_telemetry()
            await websocket.send_json({"type": "telemetry", "data": payload, "timestamp": time.time()})
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        log.info(f"WebSocket client disconnected: {websocket.client}")
    except Exception as e:
        log.warning(f"WebSocket error: {e}")


# ─── REST: Entities ──────────────────────────────────────────

class EntityCreate(BaseModel):
    type: str = "event"
    name: str
    coordinates: Optional[List[float]] = None
    properties: Dict = {}
    confidence: int = 50
    source: str = "Manual"
    tags: List[str] = []
    threatLevel: str = "none"


class RelationshipCreate(BaseModel):
    to_entity: str
    type: str
    confidence: int = 50


@app.get("/api/entities")
async def list_entities(
    type: Optional[str] = Query(None),
    threat: Optional[str] = Query(None),
):
    data = entity_store.list_entities(entity_type=type, threat=threat)
    return {"success": True, "data": data, "metadata": {"count": len(data)}}


@app.get("/api/entities/{entity_id}")
async def get_entity(entity_id: str):
    entity = entity_store.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True, "data": entity}


@app.post("/api/entities", status_code=201)
async def create_entity(body: EntityCreate):
    entity = entity_store.create_entity(body.model_dump())
    log.info(f"Entity created: {entity['id']} ({entity['name']})")
    return {"success": True, "data": entity}


@app.put("/api/entities/{entity_id}")
async def update_entity(entity_id: str, body: Dict):
    entity = entity_store.update_entity(entity_id, body)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True, "data": entity}


@app.delete("/api/entities/{entity_id}")
async def delete_entity(entity_id: str):
    if not entity_store.delete_entity(entity_id):
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True, "data": {"deleted": entity_id}}


@app.post("/api/entities/{entity_id}/relate")
async def create_relationship(entity_id: str, body: RelationshipCreate):
    rel = entity_store.add_relationship(
        entity_id, body.to_entity, body.type, body.confidence
    )
    return {"success": True, "data": rel}


@app.get("/api/entities/{entity_id}/graph")
async def get_entity_graph(entity_id: str):
    graph = entity_store.get_entity_graph(entity_id)
    return {"success": True, "data": graph}


# ─── REST: Timeline ──────────────────────────────────────────

@app.get("/api/timeline")
async def get_timeline(limit: int = 50, offset: int = 0):
    events = entity_store.get_timeline(limit, offset)
    return {"success": True, "data": events, "metadata": {"limit": limit, "offset": offset}}


@app.post("/api/events", status_code=201)
async def create_event(body: Dict):
    event = entity_store.add_event(body)
    return {"success": True, "data": event}


# ─── REST: Export ─────────────────────────────────────────────

@app.post("/api/export/geojson")
async def export_geojson():
    features = []
    for entity in entity_store.list_entities():
        if entity.get("coordinates"):
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [entity["coordinates"][1], entity["coordinates"][0]],
                },
                "properties": {
                    "id": entity["id"],
                    "name": entity["name"],
                    "type": entity["type"],
                    "threatLevel": entity["threatLevel"],
                    "confidence": entity["confidence"],
                },
            })
    return {
        "type": "FeatureCollection",
        "features": features,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
