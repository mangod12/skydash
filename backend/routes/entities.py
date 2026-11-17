"""Entity routes: CRUD, relationships, graph, timeline, events."""

import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from deps import entity_store
from entities import EntityAlreadyExists
from models import EntityCreate, EntityUpdate, EventCreate, RelationshipCreate

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


@router.get("/api/entities/graph")
async def get_intel_graph():
    try:
        graph = entity_store.get_graph()
        return {
            "success": True,
            "data": graph,
            "metadata": {
                "nodes": len(graph["nodes"]),
                "edges": len(graph["edges"]),
            },
        }
    except Exception as exc:
        log.error(f"Error fetching intel graph: {exc}", exc_info=True)
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
    except EntityAlreadyExists as exc:
        raise HTTPException(status_code=409, detail="Entity ID already exists") from exc
    except Exception as exc:
        log.error(f"Error creating entity: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.put("/api/entities/{entity_id}")
async def update_entity(entity_id: str, body: EntityUpdate):
    entity = entity_store.update_entity(entity_id, body.model_dump(exclude_unset=True))
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
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Relationship entity not found") from exc
    except Exception as exc:
        log.error(f"Error creating relationship: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


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
async def get_timeline(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0, le=9223372036854775807),
):
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
async def create_event(body: EventCreate):
    if body.entityId is not None and not entity_store.get_entity(body.entityId):
        raise HTTPException(status_code=404, detail="Entity not found")
    try:
        event = entity_store.add_event(body.model_dump())
        return {"success": True, "data": event}
    except Exception as exc:
        log.error(f"Error creating event: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") from exc
