import pytest
from pydantic import ValidationError

from models import (
    DroneCommand, EntityCreate, EntityUpdate, MissionCreate, MissionNoteAdd, RelationshipCreate,
)


def test_entity_defaults_and_valid_input_still_work():
    e = EntityCreate(name="x", coordinates=[-122.4, 37.7], threatLevel="high", tags=["a"])
    assert e.type == "event" and e.threatLevel == "high"
    EntityCreate(name="y", coordinates=[-122.4, 37.7, 120.0])
    EntityCreate(name="z")  # no coordinates


@pytest.mark.parametrize("bad", [
    {"threatLevel": "apocalyptic"},
    {"coordinates": [1.0]},
    {"coordinates": [1, 2, 3, 4]},
    {"coordinates": [float("nan"), 1.0]},
    {"coordinates": [500.0, 1.0]},
    {"tags": ["t"] * 51},
    {"tags": ["x" * 65]},
    {"type": ""},
    {"type": "t" * 65},
])
def test_entity_rejects_bad_fields(bad):
    with pytest.raises(ValidationError):
        EntityCreate(name="x", **bad)
    with pytest.raises(ValidationError):
        EntityUpdate(**bad)


def test_mission_bounds():
    MissionCreate(name="m", center_lat=37.7, center_lng=-122.4, zoom_level=12)
    for bad in ({"center_lat": 91}, {"center_lng": -181}, {"zoom_level": 40}, {"description": "d" * 5001}, {"status": ""}):
        with pytest.raises(ValidationError):
            MissionCreate(name="m", **bad)


def test_other_bodies():
    with pytest.raises(ValidationError):
        MissionNoteAdd(content="")
    with pytest.raises(ValidationError):
        MissionNoteAdd(content="n" * 10001)
    with pytest.raises(ValidationError):
        RelationshipCreate(to_entity="e1", type="linked", confidence=150)
    with pytest.raises(ValidationError):
        DroneCommand(command="")
