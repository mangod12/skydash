"""Telemetry routes: REST endpoints, history, stats, WebSocket stream."""

import asyncio
import contextlib
import logging
import math
import time
from typing import Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.responses import JSONResponse

from auth import redeem_ws_ticket, verify_token
from deps import (
    API_KEY,
    AUTH_ENABLED,
    HISTORY_FIELDS,
    fleet,
    telemetry_history,
)
from models import DroneCommand

log = logging.getLogger("skydash")
router = APIRouter()


@router.get("/telemetry")
async def get_all_telemetry():
    try:
        return {"success": True, "data": _json_safe(fleet.get_all_telemetry())}
    except Exception as exc:
        log.error(f"Error fetching telemetry: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": "Internal server error"})


@router.get("/telemetry/{drone_id}")
async def get_drone_telemetry(drone_id: str):
    data = fleet.get_drone_telemetry(drone_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Drone {drone_id} not found")
    return {"success": True, "data": _json_safe(data)}


@router.post("/api/drone/{drone_id}/command")
async def send_drone_command(drone_id: str, body: DroneCommand):
    try:
        result = fleet.send_command(drone_id, body.command, body.params)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Drone {drone_id} not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log.info(f"Command confirmed for {drone_id}: {body.model_dump()}")
    return {"success": True, "data": result}


@router.post("/reset")
async def reset_simulation():
    fleet.reset()
    telemetry_history.clear()
    log.info("Simulation reset")
    return {"success": True, "data": {"message": "Simulation reset"}}


# ── History & Stats ──────────────────────────────────────────


def _finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def _json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _history_samples():
    """Isolate malformed adapter records before serving chart history or aggregates."""
    samples = []
    for snapshot in list(telemetry_history):
        if (not isinstance(snapshot, dict) or not _finite_number(snapshot.get("timestamp"))
                or abs(snapshot["timestamp"]) > 8.64e12
                or not isinstance(snapshot.get("drones"), (list, tuple))):
            continue
        drones = [drone for drone in snapshot["drones"]
                  if isinstance(drone, dict) and isinstance(drone.get("drone_id"), str)
                  and drone["drone_id"]]
        samples.append(_json_safe({**snapshot, "drones": drones}))
    return samples


@router.get("/api/telemetry/history")
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

    data = _history_samples()[-limit:]

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


@router.get("/api/telemetry/stats")
async def get_telemetry_stats():
    """Get aggregate statistics for fleet."""
    history_list = _history_samples()
    if not history_list:
        return {"success": True, "data": {}}

    latest = history_list[-1]["drones"]
    drone_count = len(latest)
    if drone_count == 0:
        return {
            "success": True,
            "data": {
                "active_drones": 0,
                "total_samples": len(history_list),
            },
        }

    def average(field, digits):
        values = [drone[field] for drone in latest if _finite_number(drone.get(field))]
        return round(sum(value / len(values) for value in values), digits) if values else None

    stats = {
        "active_drones": drone_count,
        "avg_altitude": average("altitude", 2),
        "avg_battery": average("battery_percentage", 1),
        "avg_signal": average("signal_strength", 1),
        "total_samples": len(history_list),
        "recording_duration_s": round(
            max(0, history_list[-1]["timestamp"] - history_list[0]["timestamp"]), 1
        )
        if len(history_list) > 1
        else 0,
    }
    return {"success": True, "data": stats}


# ── WebSocket ────────────────────────────────────────────────


WS_RECHECK_SECONDS = 5.0


@router.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    ws_token = websocket.query_params.get("token", "")
    ticket = websocket.query_params.get("ticket", "")
    if ticket and AUTH_ENABLED:
        ws_token = redeem_ws_ticket(ticket) or ""
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
    last_check = time.monotonic()
    try:
        while True:
            # A token revoked (logout), expired or disabled mid-stream must end the stream.
            if AUTH_ENABLED and time.monotonic() - last_check >= WS_RECHECK_SECONDS:
                last_check = time.monotonic()
                if not verify_token(ws_token):
                    await websocket.close(code=4001, reason="Session ended")
                    return
            payload = _json_safe(fleet.get_all_telemetry())
            await websocket.send_json(
                {"type": "telemetry", "data": payload, "timestamp": time.time()}
            )
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        log.info(f"WebSocket client disconnected: {websocket.client}")
    except Exception as exc:
        log.warning(f"WebSocket error: {exc}")
        # An accepted socket needs an explicit failure close so clients can reconnect.
        # A broken transport may reject the close too; do not hide the original error.
        with contextlib.suppress(Exception):
            await websocket.close(code=1011, reason="Telemetry unavailable")
