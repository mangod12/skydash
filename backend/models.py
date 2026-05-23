"""Pydantic models for SkyDash API request bodies."""

from typing import Dict, List, Optional

from pydantic import BaseModel


class AuthLogin(BaseModel):
    username: str
    password: str


class AuthRegister(BaseModel):
    username: str
    password: str
    role: str = "analyst"


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
