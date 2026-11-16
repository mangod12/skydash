"""Pydantic models for SkyDash API request bodies."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AuthLogin(BaseModel):
    username: str
    password: str


class AuthRegister(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)
    role: str = "analyst"


class EntityCreate(BaseModel):
    id: Optional[str] = None
    type: str = "event"
    name: str = Field(min_length=1, max_length=200)
    coordinates: Optional[List[float]] = None
    properties: Dict = {}
    confidence: int = Field(default=50, ge=0, le=100)
    source: str = "Manual"
    tags: List[str] = []
    threatLevel: str = "none"


class RelationshipCreate(BaseModel):
    to_entity: str
    type: str
    confidence: int = 50


class MissionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
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


class DroneCommand(BaseModel):
    command: str
    params: Dict[str, Any] = {}
