"""Connector routes: OpenSky ADS-B, Shodan IoT search."""

import logging

from fastapi import APIRouter, Query

from deps import opensky, shodan

log = logging.getLogger("skydash")
router = APIRouter()


@router.get("/api/connectors/adsb")
async def get_adsb_aircraft(
    lat_min: float = Query(37.0),
    lon_min: float = Query(-123.0),
    lat_max: float = Query(38.0),
    lon_max: float = Query(-122.0),
):
    """Fetch live ADS-B aircraft from OpenSky Network."""
    try:
        aircraft = opensky.fetch_aircraft(
            bbox=[lat_min, lon_min, lat_max, lon_max]
        )
        return {
            "success": True,
            "data": aircraft,
            "metadata": {"count": len(aircraft), "source": "OpenSky"},
        }
    except Exception as exc:
        log.error(f"Error fetching ADS-B data: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/connectors/adsb/entities")
async def get_adsb_entities():
    """Fetch ADS-B aircraft as SkyDash entities."""
    try:
        aircraft = opensky.fetch_aircraft()
        entities = opensky.to_entities(aircraft)
        return {"success": True, "data": entities}
    except Exception as exc:
        log.error(f"Error converting ADS-B entities: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/connectors/shodan")
async def search_shodan(
    query: str = Query("webcam"),
    limit: int = Query(10, ge=1, le=50),
):
    """Search Shodan for IoT devices."""
    try:
        results = shodan.search(query, limit)
        return {
            "success": True,
            "data": results,
            "metadata": {
                "count": len(results),
                "source": "Shodan" if shodan.available else "Mock",
            },
        }
    except Exception as exc:
        log.error(f"Error searching Shodan: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/connectors/shodan/entities")
async def get_shodan_entities(query: str = Query("webcam")):
    """Search Shodan and return results as SkyDash entities."""
    try:
        results = shodan.search(query)
        entities = shodan.to_entities(results)
        return {"success": True, "data": entities}
    except Exception as exc:
        log.error(f"Error converting Shodan entities: {exc}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/api/connectors/status")
async def connector_status():
    """Get status of all data connectors."""
    return {
        "success": True,
        "data": {
            "opensky": {
                "available": True,
                "cached": len(opensky.cache),
                "last_fetch": opensky.last_fetch,
            },
            "shodan": {
                "available": shodan.available,
                "mode": "live" if shodan.available else "mock",
            },
        },
    }
