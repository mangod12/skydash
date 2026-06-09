"""Mission routes: CRUD, entity linking, notes."""

import logging
from typing import Dict, Optional

from fastapi import APIRouter, Query, HTTPException

from deps import mission_store
from models import MissionCreate, MissionEntityAdd, MissionNoteAdd

log = logging.getLogger("skydash")
router = APIRouter()


@router.post("/api/missions", status_code=201)
async def create_mission(body: MissionCreate):
    try:
        mission = mission_store.create_mission(body.model_dump())
        log.info(f"Mission created: {mission['id']} ({mission['name']})")
        return {"success": True, "data": mission}
    except Exception as exc:
        log.error(f"Error creating mission: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/missions")
async def list_missions(status: Optional[str] = Query(None)):
    try:
        data = mission_store.list_missions(status=status)
        return {"success": True, "data": data, "metadata": {"count": len(data)}}
    except Exception as exc:
        log.error(f"Error listing missions: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/missions/{mission_id}")
async def get_mission(mission_id: str):
    mission = mission_store.get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission["entities"] = mission_store.get_mission_entities(mission_id)
    mission["notes"] = mission_store.get_notes(mission_id)
    mission["detections"] = mission_store.get_detections(mission_id)
    return {"success": True, "data": mission}


@router.put("/api/missions/{mission_id}")
async def update_mission(mission_id: str, body: Dict):
    mission = mission_store.update_mission(mission_id, body)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": mission}


@router.delete("/api/missions/{mission_id}")
async def delete_mission(mission_id: str):
    if not mission_store.delete_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": {"deleted": mission_id}}


@router.post("/api/missions/{mission_id}/entities")
async def add_entity_to_mission(mission_id: str, body: MissionEntityAdd):
    if not mission_store.add_entity_to_mission(mission_id, body.entity_id):
        raise HTTPException(
            status_code=404, detail="Mission not found or entity already linked"
        )
    return {
        "success": True,
        "data": {"mission_id": mission_id, "entity_id": body.entity_id},
    }


@router.delete("/api/missions/{mission_id}/entities/{entity_id}")
async def remove_entity_from_mission(mission_id: str, entity_id: str):
    if not mission_store.remove_entity_from_mission(mission_id, entity_id):
        raise HTTPException(status_code=404, detail="Link not found")
    return {
        "success": True,
        "data": {"removed": entity_id, "from_mission": mission_id},
    }


@router.post("/api/missions/{mission_id}/notes", status_code=201)
async def add_mission_note(mission_id: str, body: MissionNoteAdd):
    note = mission_store.add_note(mission_id, body.content)
    if not note:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": note}


@router.get("/api/missions/{mission_id}/notes")
async def get_mission_notes(mission_id: str):
    if not mission_store.get_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")
    notes = mission_store.get_notes(mission_id)
    return {"success": True, "data": notes, "metadata": {"count": len(notes)}}


@router.delete("/api/missions/{mission_id}/notes/{note_id}")
async def delete_mission_note(mission_id: str, note_id: str):
    if not mission_store.delete_note(note_id):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "data": {"deleted": note_id}}
