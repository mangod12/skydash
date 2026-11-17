import pytest
from pydantic import ValidationError

from models import (
    DroneCommand, EntityCreate, EntityUpdate, MissionCreate, MissionUpdate, MissionNoteAdd, RelationshipCreate,
)


def test_entity_defaults_and_valid_input_still_work():
    e = EntityCreate(name="x", coordinates=[37.7, -122.4], threatLevel="high", tags=["a"])
    assert e.type == "event" and e.threatLevel == "high"
    EntityCreate(name="y", coordinates=[37.7, -122.4, 120.0])
    EntityCreate(name="z")  # no coordinates
    assert EntityCreate(name="origin", coordinates=[0, 0]).coordinates == [0.0, 0.0]
    assert EntityUpdate(coordinates=None).coordinates is None
    assert EntityCreate(name="numeric", coordinates=["20.5", "80.5"]).coordinates == [20.5, 80.5]
    assert EntityUpdate(coordinates=["20.5", "80.5"]).coordinates == [20.5, 80.5]


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


def test_mission_map_compatibility():
    for model in (MissionCreate, MissionUpdate):
        kwargs = {"name": "Map"} if model is MissionCreate else {}
        result = model(center_lat=0, center_lng=0, zoom_level=0, **kwargs)
        assert (result.center_lat, result.center_lng, result.zoom_level) == (0, 0, 0)
        result = model(center_lat="20.5", center_lng="80.5", zoom_level="12", **kwargs)
        assert (result.center_lat, result.center_lng, result.zoom_level) == (20.5, 80.5, 12)
        result = model(center_lat=None, center_lng=None, zoom_level=None, **kwargs)
        assert result.center_lat is None and result.center_lng is None and result.zoom_level is None


def test_other_bodies():
    with pytest.raises(ValidationError):
        MissionNoteAdd(content="")
    with pytest.raises(ValidationError):
        MissionNoteAdd(content="n" * 10001)
    with pytest.raises(ValidationError):
        RelationshipCreate(to_entity="e1", type="linked", confidence=150)
    with pytest.raises(ValidationError):
        DroneCommand(command="")


@pytest.mark.parametrize("coords", [[90, 180], [-90, -180], [0, 0], [90, -180, 120.0]])
def test_entity_accepts_latitude_longitude_boundaries(coords):
    assert EntityCreate(name="x", coordinates=coords).coordinates == coords
    assert EntityUpdate(coordinates=coords).coordinates == coords
