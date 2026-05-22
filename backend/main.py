import asyncio
import json
import time
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from simulation import FleetSimulator
from entities import EntityStore

app = FastAPI(title="SkyDash Spatial Intelligence API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fleet = FleetSimulator()
entity_store = EntityStore()


# ─── REST: Root ──────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "SkyDash Spatial Intelligence API",
        "version": "2.0.0",
        "drones": list(fleet.drones.keys()),
        "endpoints": {
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
    return {"success": True, "data": {"message": "Simulation reset"}}


# ─── WebSocket: Telemetry Stream ─────────────────────────────

@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            payload = fleet.get_all_telemetry()
            await websocket.send_json({"type": "telemetry", "data": payload, "timestamp": time.time()})
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


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


@app.post("/api/entities")
async def create_entity(body: EntityCreate):
    entity = entity_store.create_entity(body.model_dump())
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


@app.post("/api/events")
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
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    uvicorn.run(app, host="0.0.0.0", port=port)
