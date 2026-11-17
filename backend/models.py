"""Pydantic models for SkyDash API request bodies."""

from typing import Any, Dict, List, Optional

import math

from pydantic import BaseModel, Field, field_validator

THREAT_LEVELS = ("none", "low", "medium", "high", "critical")


def _check_coordinates(v):
    if v is None:
        return v
    if len(v) not in (2, 3) or not all(math.isfinite(x) for x in v):
        raise ValueError("coordinates must be 2 or 3 finite numbers")
    if abs(v[0]) > 180 or abs(v[1]) > 180:
        raise ValueError("coordinates out of range")
    return v


def _check_tags(v):
    if v is None:
        return v
    if len(v) > 50 or any(len(t) > 64 for t in v):
        raise ValueError("at most 50 tags of up to 64 characters")
    return v


def _check_threat(v):
    if v is not None and v not in THREAT_LEVELS:
        raise ValueError(f"threatLevel must be one of {', '.join(THREAT_LEVELS)}")
    return v


def _reject_null(v):
    """An omitted update field is allowed; an explicit null is not."""
    if v is None:
        raise ValueError("field cannot be null; omit it to keep its current value")
    return v


class AuthLogin(BaseModel):
    username: str
    password: str


class AuthRegister(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)
    role: str = "analyst"


class EntityCreate(BaseModel):
    id: Optional[str] = Field(default=None, max_length=128)
    type: str = Field(default="event", min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    coordinates: Optional[List[float]] = None
    properties: Dict = {}
    confidence: int = Field(default=50, ge=0, le=100)
    source: str = "Manual"
    tags: List[str] = []
    threatLevel: str = "none"

    _coords = field_validator("coordinates")(_check_coordinates)
    _tags = field_validator("tags")(_check_tags)
    _threat = field_validator("threatLevel")(_check_threat)


class EntityUpdate(BaseModel):
    """Partial entity update. Unknown keys are ignored."""
    type: Optional[str] = Field(default=None, min_length=1, max_length=64)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    coordinates: Optional[List[float]] = None
    properties: Optional[Dict] = None
    confidence: Optional[int] = Field(default=None, ge=0, le=100)
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    threatLevel: Optional[str] = None

    _not_null = field_validator(
        "type", "name", "properties", "confidence", "source", "tags", "threatLevel",
        mode="before",
    )(_reject_null)
    _coords = field_validator("coordinates")(_check_coordinates)
    _tags = field_validator("tags")(_check_tags)
    _threat = field_validator("threatLevel")(_check_threat)


class RelationshipCreate(BaseModel):
    to_entity: str = Field(min_length=1, max_length=128)
    type: str = Field(min_length=1, max_length=64)
    confidence: int = Field(default=50, ge=0, le=100)


class MissionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    status: str = Field(default="active", min_length=1, max_length=32)
    center_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    center_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    zoom_level: Optional[int] = Field(default=None, ge=0, le=24)
    tags: List[str] = []

    _tags = field_validator("tags")(_check_tags)


class MissionUpdate(BaseModel):
    """Partial mission update. Unknown keys are ignored."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[str] = Field(default=None, min_length=1, max_length=32)
    center_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    center_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    zoom_level: Optional[int] = Field(default=None, ge=0, le=24)
    tags: Optional[List[str]] = None

    _not_null = field_validator("name", "description", "status", "tags", mode="before")(_reject_null)
    _tags = field_validator("tags")(_check_tags)


class MissionEntityAdd(BaseModel):
    entity_id: str = Field(min_length=1, max_length=128)


class MissionNoteAdd(BaseModel):
    content: str = Field(min_length=1, max_length=10000)


class DroneCommand(BaseModel):
    command: str = Field(min_length=1, max_length=64)
    params: Dict[str, Any] = {}
