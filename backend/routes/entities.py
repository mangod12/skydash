"""Entity routes: CRUD, relationships, graph, timeline, events."""

import logging
from typing import Dict, Optional

from fastapi import APIRouter, Query, HTTPException

from deps import entity_store
from models import EntityCreate, RelationshipCreate

log = logging.getLogger("skydash")
router = APIRouter()


@router.get("/api/entities")
async def list_entities(
    type: Optional[str] = Query(None),
    threat: Optional[str] = Query(None),
):
    try:
        data = entity_store.list_entities(entity_type=type, threat=threat)
        return {"success": True, "data": data, "metadata": {"count": len(data)}}
    except Exception as exc:
        log.error(f"Error listing entities: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/entities/{entity_id}")
async def get_entity(entity_id: str):
    entity = entity_store.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True, "data": entity}


@router.post("/api/entities", status_code=201)
async def create_entity(body: EntityCreate):
    try:
        entity = entity_store.create_entity(body.model_dump())
        log.info(f"Entity created: {entity['id']} ({entity['name']})")
        return {"success": True, "data": entity}
    except Exception as exc:
        log.error(f"Error creating entity: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.put("/api/entities/{entity_id}")
async def update_entity(entity_id: str, body: Dict):
    entity = entity_store.update_entity(entity_id, body)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True, "data": entity}


@router.delete("/api/entities/{entity_id}")
async def delete_entity(entity_id: str):
    if not entity_store.delete_entity(entity_id):
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True, "data": {"deleted": entity_id}}


@router.post("/api/entities/{entity_id}/relate")
async def create_relationship(entity_id: str, body: RelationshipCreate):
    try:
        rel = entity_store.add_relationship(
            entity_id, body.to_entity, body.type, body.confidence
        )
        return {"success": True, "data": rel}
    except Exception as exc:
        log.error(f"Error creating relationship: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/entities/{entity_id}/graph")
async def get_entity_graph(entity_id: str):
    try:
        graph = entity_store.get_entity_graph(entity_id)
        return {"success": True, "data": graph}
    except Exception as exc:
        log.error(f"Error fetching entity graph: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


# ── Timeline & Events ───────────────────────────────────────


@router.get("/api/timeline")
async def get_timeline(limit: int = 50, offset: int = 0):
    try:
        events = entity_store.get_timeline(limit, offset)
        return {
            "success": True,
            "data": events,
            "metadata": {"limit": limit, "offset": offset},
        }
    except Exception as exc:
        log.error(f"Error fetching timeline: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.post("/api/events", status_code=201)
async def create_event(body: Dict):
    try:
        event = entity_store.add_event(body)
        return {"success": True, "data": event}
    except Exception as exc:
        log.error(f"Error creating event: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}
