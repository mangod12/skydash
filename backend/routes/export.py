"""Export routes: GeoJSON entity export, CSV telemetry export."""

import csv
import io
import logging
import math
import time
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse

from audit import _safe_cell
from deps import entity_store, fleet, telemetry_history

log = logging.getLogger("skydash")
router = APIRouter()


def _valid_position(coords):
    return (isinstance(coords, (list, tuple)) and len(coords) in (2, 3)
            and all(type(v) in (int, float) and math.isfinite(v) for v in coords)
            and abs(coords[0]) <= 90 and abs(coords[1]) <= 180)


def _csv_value(value):
    # Type-corrupt legacy fields must not bypass text formula neutralisation.
    if isinstance(value, str):
        return _safe_cell(value)
    return value


@router.post("/api/export/geojson")
def export_geojson():
    """Export all geo-located entities as a GeoJSON FeatureCollection."""
    try:
        features = []
        for entity in entity_store.list_entities():
            if not isinstance(entity, dict):
                continue
            if _valid_position(entity.get("coordinates")):
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
        return JSONResponse(status_code=500, content={"success": False, "error": "Internal server error"})


@router.get("/api/export/telemetry/csv")
async def export_telemetry_csv(
    drone_id: Optional[str] = Query(None, description="Filter by drone ID"),
    limit: int = Query(100, ge=1, le=1000, description="Number of snapshots to export"),
):
    """Export telemetry history as a downloadable CSV file.

    Returns a CSV with columns for each drone's telemetry fields.
    If drone_id is specified, only that drone's data is included.
    """
    try:
        data = list(telemetry_history)[-limit:]
        if not data:
            return {"success": False, "error": "No telemetry data available"}

        output = io.StringIO()
        writer = csv.writer(output)

        # Header row
        headers = [
            "timestamp", "drone_id",
            "latitude", "longitude", "altitude",
            "battery_voltage", "battery_percentage",
            "ground_speed", "signal_strength",
            "roll", "pitch", "yaw",
            "wind_speed", "wind_direction",
            "gps_satellites", "gps_hdop",
        ]
        writer.writerow(headers)

        # Data rows
        rows_written = 0
        for snapshot in data:
            if not isinstance(snapshot, dict):
                continue
            ts = snapshot.get("timestamp", "")
            drones = snapshot.get("drones")
            if not isinstance(drones, (list, tuple)):
                continue
            for drone in drones:
                if not isinstance(drone, dict):
                    continue
                if drone_id and drone.get("drone_id") != drone_id:
                    continue

                gps = drone.get("gps")
                gps = gps if isinstance(gps, dict) else {}
                attitude = drone.get("attitude")
                attitude = attitude if isinstance(attitude, dict) else {}
                wind = drone.get("wind")
                wind = wind if isinstance(wind, dict) else {}

                row = [
                    ts,
                    drone.get("drone_id", ""),
                    gps.get("latitude", gps.get("lat", "")),
                    gps.get("longitude", gps.get("lng", "")),
                    drone.get("altitude", ""),
                    drone.get("battery_voltage", ""),
                    drone.get("battery_percentage", ""),
                    drone.get("ground_speed", ""),
                    drone.get("signal_strength", ""),
                    attitude.get("roll", ""),
                    attitude.get("pitch", ""),
                    attitude.get("yaw", ""),
                    wind.get("speed", ""),
                    wind.get("direction", ""),
                    gps.get("satellites", ""),
                    gps.get("hdop", ""),
                ]
                # Connector-provided text must not become spreadsheet formulas.
                # Keep real numeric telemetry (including negative coordinates) numeric.
                writer.writerow([_safe_cell(value) if isinstance(value, str) else value for value in row])
                rows_written += 1

        output.seek(0)
        filename = f"skydash_telemetry_{int(time.time())}.csv"

        log.info(f"Telemetry CSV export: {rows_written} rows, drone_id={drone_id}")

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as exc:
        log.error(f"Error exporting telemetry CSV: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": "Internal server error"})


@router.get("/api/export/entities/csv")
def export_entities_csv():
    """Export all entities as a downloadable CSV file."""
    try:
        output = io.StringIO()
        writer = csv.writer(output)

        headers = [
            "id", "name", "type", "threat_level", "confidence",
            "latitude", "longitude", "tags", "source", "last_seen",
        ]
        writer.writerow(headers)

        entities = entity_store.list_entities()
        for entity in entities:
            if not isinstance(entity, dict):
                continue
            coords = entity.get("coordinates")
            coords = coords if _valid_position(coords) else []
            tags = entity.get("tags")
            tags = ", ".join(str(tag) for tag in tags) if isinstance(tags, (list, tuple)) else ""

            row = [
                entity.get("id", ""),
                entity.get("name", ""),
                entity.get("type", ""),
                entity.get("threatLevel", ""),
                entity.get("confidence", ""),
                coords[0] if len(coords) > 0 else "",
                coords[1] if len(coords) > 1 else "",
                tags,
                entity.get("source", ""),
                entity.get("lastSeen", ""),
            ]
            writer.writerow([_csv_value(value) for value in row])

        output.seek(0)
        filename = f"skydash_entities_{int(time.time())}.csv"

        log.info(f"Entities CSV export: {len(entities)} entities")

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as exc:
        log.error(f"Error exporting entities CSV: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": "Internal server error"})
