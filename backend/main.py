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
from missions import MissionStore
from connectors import OpenSkyConnector, ShodanConnector
from auth import UserStore, create_token, verify_token, SECRET_KEY
import database

# ─── Config ──────────────────────────────────────────────────

PORT = int(os.getenv("SKYDASH_PORT", "8001"))
HOST = os.getenv("SKYDASH_HOST", "0.0.0.0")
API_KEY = os.getenv("SKYDASH_API_KEY", "")  # Empty = no auth (dev mode)
AUTH_ENABLED = bool(os.getenv("SKYDASH_AUTH_ENABLED") or os.getenv("SKYDASH_JWT_SECRET"))
DB_PATH = os.getenv("SKYDASH_DB_PATH", "skydash.db")
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

# Initialize shared database and run pending migrations
database.check_migrations()

entity_store = EntityStore()
mission_store = MissionStore()
user_store = UserStore() if AUTH_ENABLED else None
opensky = OpenSkyConnector()
shodan = ShodanConnector(api_key=os.getenv("SHODAN_API_KEY"))
start_time = time.time()

# ─── Telemetry History (in-memory ring buffer) ──────────────

telemetry_history: List[Dict] = []
MAX_HISTORY = 300  # 5 minutes at 1 sample/sec


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
            if len(telemetry_history) > MAX_HISTORY:
                telemetry_history.pop(0)
            await asyncio.sleep(1)
    asyncio.create_task(record())


# ─── Auth middleware ─────────────────────────────────────────

SKIP_AUTH_PATHS = {"/health", "/docs", "/openapi.json", "/", "/api/auth/login", "/api/auth/register"}


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path in SKIP_AUTH_PATHS or path.startswith("/ws/"):
        return await call_next(request)

    # Legacy API_KEY check (non-JWT mode)
    if API_KEY and not AUTH_ENABLED:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if token != API_KEY:
            return JSONResponse(status_code=401, content={"success": False, "error": "Invalid or missing API key"})
        return await call_next(request)

    # JWT auth check
    if AUTH_ENABLED:
        raw = request.headers.get("Authorization", "")
        if not raw.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"success": False, "error": "Missing auth token"})
        payload = verify_token(raw[7:])
        if not payload:
            return JSONResponse(status_code=401, content={"success": False, "error": "Invalid or expired token"})
        request.state.user = payload

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
        "missions": mission_store.count(),
        "telemetry_samples": len(telemetry_history),
        "connectors": {
            "opensky": {"available": True, "cached": len(opensky.cache)},
            "shodan": {"available": shodan.available, "mode": "live" if shodan.available else "mock"},
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
            "/api/timeline": "Event timeline",
            "/api/connectors/adsb": "ADS-B aircraft (OpenSky)",
            "/api/connectors/adsb/entities": "ADS-B as SkyDash entities",
            "/api/connectors/shodan": "Shodan IoT search",
            "/api/connectors/shodan/entities": "Shodan as SkyDash entities",
            "/api/connectors/status": "Connector status overview",
            "/docs": "API documentation",
        },
    }


# ─── Auth endpoints ─────────────────────────────────────────


class AuthLogin(BaseModel):
    username: str
    password: str


class AuthRegister(BaseModel):
    username: str
    password: str
    role: str = "analyst"


@app.post("/api/auth/login")
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


@app.post("/api/auth/register")
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
    uid = user_store.create_user(body.username, body.password, body.role)
    user = user_store.get_user(uid)
    token = create_token(user)
    return {"success": True, "data": {"token": token, "user": user}}


@app.get("/api/auth/me")
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


@app.post("/api/drone/{drone_id}/command")
async def send_drone_command(drone_id: str, body: Dict):
    log.info(f"Command received for {drone_id}: {body}")
    return {"success": True, "data": {"drone_id": drone_id, "command": body, "ack": "confirmed"}}


@app.post("/reset")
async def reset_simulation():
    fleet.reset()
    log.info("Simulation reset")
    return {"success": True, "data": {"message": "Simulation reset"}}


# ─── REST: Telemetry History ────────────────────────────────

HISTORY_FIELDS = {"altitude", "battery_percentage", "signal_strength", "ground_speed"}


@app.get("/api/telemetry/history")
async def get_telemetry_history(
    drone_id: Optional[str] = Query(None),
    limit: int = Query(60, ge=1, le=300),
    field: Optional[str] = Query(None),
):
    """Get historical telemetry data for charts."""
    if field and field not in HISTORY_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid field. Must be one of: {', '.join(sorted(HISTORY_FIELDS))}",
        )

    data = telemetry_history[-limit:]

    if drone_id:
        result = []
        for snapshot in data:
            drone_data = next(
                (d for d in snapshot["drones"] if d["drone_id"] == drone_id),
                None,
            )
            if drone_data:
                entry = {"timestamp": snapshot["timestamp"]}
                if field:
                    entry["value"] = drone_data.get(field)
                else:
                    entry.update(drone_data)
                result.append(entry)
        return {
            "success": True,
            "data": result,
            "metadata": {"count": len(result), "drone_id": drone_id},
        }

    return {
        "success": True,
        "data": data,
        "metadata": {"count": len(data)},
    }


@app.get("/api/telemetry/stats")
async def get_telemetry_stats():
    """Get aggregate statistics for fleet."""
    if not telemetry_history:
        return {"success": True, "data": {}}

    latest = telemetry_history[-1]["drones"]
    drone_count = len(latest)
    if drone_count == 0:
        return {
            "success": True,
            "data": {"active_drones": 0, "total_samples": len(telemetry_history)},
        }

    stats = {
        "active_drones": drone_count,
        "avg_altitude": round(sum(d["altitude"] for d in latest) / drone_count, 2),
        "avg_battery": round(
            sum(d["battery_percentage"] for d in latest) / drone_count, 1
        ),
        "avg_signal": round(
            sum(d["signal_strength"] for d in latest) / drone_count, 1
        ),
        "total_samples": len(telemetry_history),
        "recording_duration_s": round(
            telemetry_history[-1]["timestamp"] - telemetry_history[0]["timestamp"], 1
        ) if len(telemetry_history) > 1 else 0,
    }
    return {"success": True, "data": stats}


# ─── WebSocket: Telemetry Stream ─────────────────────────────

@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    ws_token = websocket.query_params.get("token", "")
    if AUTH_ENABLED:
        if not ws_token or not verify_token(ws_token):
            await websocket.close(code=4001, reason="Unauthorized")
            return
    elif API_KEY:
        if ws_token != API_KEY:
            await websocket.close(code=4001, reason="Unauthorized")
            return
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


# ─── REST: Missions ──────────────────────────────────────────

class MissionCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "active"
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    zoom_level: Optional[int] = None
    tags: List[str] = []


class MissionEntityAdd(BaseModel):
    entity_id: str


class MissionNoteAdd(BaseModel):
    content: str


@app.post("/api/missions", status_code=201)
async def create_mission(body: MissionCreate):
    mission = mission_store.create_mission(body.model_dump())
    log.info(f"Mission created: {mission['id']} ({mission['name']})")
    return {"success": True, "data": mission}


@app.get("/api/missions")
async def list_missions(status: Optional[str] = Query(None)):
    data = mission_store.list_missions(status=status)
    return {"success": True, "data": data, "metadata": {"count": len(data)}}


@app.get("/api/missions/{mission_id}")
async def get_mission(mission_id: str):
    mission = mission_store.get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission["entities"] = mission_store.get_mission_entities(mission_id)
    mission["notes"] = mission_store.get_notes(mission_id)
    return {"success": True, "data": mission}


@app.put("/api/missions/{mission_id}")
async def update_mission(mission_id: str, body: Dict):
    mission = mission_store.update_mission(mission_id, body)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": mission}


@app.delete("/api/missions/{mission_id}")
async def delete_mission(mission_id: str):
    if not mission_store.delete_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": {"deleted": mission_id}}


@app.post("/api/missions/{mission_id}/entities")
async def add_entity_to_mission(mission_id: str, body: MissionEntityAdd):
    if not mission_store.add_entity_to_mission(mission_id, body.entity_id):
        raise HTTPException(status_code=404, detail="Mission not found or entity already linked")
    return {"success": True, "data": {"mission_id": mission_id, "entity_id": body.entity_id}}


@app.delete("/api/missions/{mission_id}/entities/{entity_id}")
async def remove_entity_from_mission(mission_id: str, entity_id: str):
    if not mission_store.remove_entity_from_mission(mission_id, entity_id):
        raise HTTPException(status_code=404, detail="Link not found")
    return {"success": True, "data": {"removed": entity_id, "from_mission": mission_id}}


@app.post("/api/missions/{mission_id}/notes", status_code=201)
async def add_mission_note(mission_id: str, body: MissionNoteAdd):
    note = mission_store.add_note(mission_id, body.content)
    if not note:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": note}


@app.get("/api/missions/{mission_id}/notes")
async def get_mission_notes(mission_id: str):
    if not mission_store.get_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")
    notes = mission_store.get_notes(mission_id)
    return {"success": True, "data": notes, "metadata": {"count": len(notes)}}


@app.delete("/api/missions/{mission_id}/notes/{note_id}")
async def delete_mission_note(mission_id: str, note_id: str):
    if not mission_store.delete_note(note_id):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "data": {"deleted": note_id}}


# ─── REST: Connectors ────────────────────────────────────────


@app.get("/api/connectors/adsb")
async def get_adsb_aircraft(
    lat_min: float = Query(37.0),
    lon_min: float = Query(-123.0),
    lat_max: float = Query(38.0),
    lon_max: float = Query(-122.0),
):
    """Fetch live ADS-B aircraft from OpenSky Network."""
    aircraft = opensky.fetch_aircraft(bbox=[lat_min, lon_min, lat_max, lon_max])
    return {
        "success": True,
        "data": aircraft,
        "metadata": {"count": len(aircraft), "source": "OpenSky"},
    }


@app.get("/api/connectors/adsb/entities")
async def get_adsb_entities():
    """Fetch ADS-B aircraft as SkyDash entities."""
    aircraft = opensky.fetch_aircraft()
    entities = opensky.to_entities(aircraft)
    return {"success": True, "data": entities}


@app.get("/api/connectors/shodan")
async def search_shodan(
    query: str = Query("webcam"),
    limit: int = Query(10, ge=1, le=50),
):
    """Search Shodan for IoT devices. Falls back to mock data without API key."""
    results = shodan.search(query, limit)
    return {
        "success": True,
        "data": results,
        "metadata": {
            "count": len(results),
            "source": "Shodan" if shodan.available else "Mock",
        },
    }


@app.get("/api/connectors/shodan/entities")
async def get_shodan_entities(query: str = Query("webcam")):
    """Search Shodan and return results as SkyDash entities."""
    results = shodan.search(query)
    entities = shodan.to_entities(results)
    return {"success": True, "data": entities}


@app.get("/api/connectors/status")
async def connector_status():
    """Get status of all data connectors."""
    return {
        "success": True,
        "data": {
            "opensky": {
                "available": True,
                "cached": len(opensky.cache),
                "last_fetch": opensky.last_fetch,
            },
            "shodan": {
                "available": shodan.available,
                "mode": "live" if shodan.available else "mock",
            },
        },
    }


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
