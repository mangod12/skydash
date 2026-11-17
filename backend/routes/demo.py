"""Demo reset: put a demo or training instance back to a known state."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, StrictBool

from deps import entity_store, fleet, mission_store, telemetry_history

log = logging.getLogger("skydash")
router = APIRouter()


class DemoResetRequest(BaseModel):
    confirm: StrictBool = False


@router.post("/api/demo/reset")
async def demo_reset(body: DemoResetRequest):
    """Wipe entities, relationships, events and missions, restore the demo seed
    and restart the simulated fleet. Users and the audit trail are kept.
    Requires {"confirm": true}; commander role when auth is on."""
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Send {\"confirm\": true} to reset demo data")
    mission_store.clear_all()
    entity_store.reset_demo()
    fleet.reset()
    telemetry_history.clear()
    log.warning("Demo data reset")
    return {"success": True, "data": {"entities": len(entity_store.entities), "missions": 0}}
