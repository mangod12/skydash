"""Export routes: GeoJSON entity export."""

import logging

from fastapi import APIRouter

from deps import entity_store

log = logging.getLogger("skydash")
router = APIRouter()


@router.post("/api/export/geojson")
async def export_geojson():
    """Export all geo-located entities as a GeoJSON FeatureCollection."""
    try:
        features = []
        for entity in entity_store.list_entities():
            if entity.get("coordinates"):
                features.append(
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                entity["coordinates"][1],
                                entity["coordinates"][0],
                            ],
                        },
                        "properties": {
                            "id": entity["id"],
                            "name": entity["name"],
                            "type": entity["type"],
                            "threatLevel": entity["threatLevel"],
                            "confidence": entity["confidence"],
                        },
                    }
                )
        return {"type": "FeatureCollection", "features": features}
    except Exception as exc:
        log.error(f"Error exporting GeoJSON: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}
