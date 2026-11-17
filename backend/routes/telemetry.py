"""Telemetry routes: REST endpoints, history, stats, WebSocket stream."""

import asyncio
import contextlib
import logging
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
        return {"success": True, "data": fleet.get_all_telemetry()}
    except Exception as exc:
        log.error(f"Error fetching telemetry: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": "Internal server error"})


@router.get("/telemetry/{drone_id}")
async def get_drone_telemetry(drone_id: str):
    data = fleet.get_drone_telemetry(drone_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Drone {drone_id} not found")
    return {"success": True, "data": data}


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

    data = list(telemetry_history)[-limit:]

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
    if not telemetry_history:
        return {"success": True, "data": {}}

    latest = telemetry_history[-1]["drones"]
    drone_count = len(latest)
    if drone_count == 0:
        return {
            "success": True,
            "data": {
                "active_drones": 0,
                "total_samples": len(telemetry_history),
            },
        }

    history_list = list(telemetry_history)
    stats = {
        "active_drones": drone_count,
        "avg_altitude": round(
            sum(d["altitude"] for d in latest) / drone_count, 2
        ),
        "avg_battery": round(
            sum(d["battery_percentage"] for d in latest) / drone_count, 1
        ),
        "avg_signal": round(
            sum(d["signal_strength"] for d in latest) / drone_count, 1
        ),
        "total_samples": len(telemetry_history),
        "recording_duration_s": round(
            history_list[-1]["timestamp"] - history_list[0]["timestamp"], 1
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
            payload = fleet.get_all_telemetry()
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
