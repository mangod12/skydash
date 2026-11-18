"""Demo reset: put a demo or training instance back to a known state."""

import logging

import database as db

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, StrictBool
from starlette.concurrency import run_in_threadpool

from deps import entity_store, fleet, mission_store, telemetry_history

log = logging.getLogger("skydash")
router = APIRouter()


class DemoResetRequest(BaseModel):
    confirm: StrictBool = False


def _reset_stores():
    conn = db.get_connection()
    with db.get_lock(), conn:
        mission_store._clear_all(conn)
        entity_store._reset_demo(conn)
        return entity_store.count()


@router.post("/api/demo/reset")
async def demo_reset(body: DemoResetRequest):
    """Wipe entities, relationships, events and missions, restore the demo seed
    and restart the simulated fleet. Users and the audit trail are kept.
    Requires {"confirm": true}; commander role when auth is on."""
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Send {\"confirm\": true} to reset demo data")
    count = await run_in_threadpool(_reset_stores)
    fleet.reset()
    telemetry_history.clear()
    log.warning("Demo data reset")
    return {"success": True, "data": {"entities": count, "missions": 0}}
