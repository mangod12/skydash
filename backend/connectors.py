"""OSINT data source connectors for SkyDash.

Each connector fetches from external APIs and normalizes to SkyDash entity format.
- OpenSky: live ADS-B aircraft tracking (no API key required)
- Shodan: IoT device search (API key optional, falls back to mock)
"""

import logging
import random
import time
from typing import Dict, List, Optional

import requests

log = logging.getLogger("skydash.connectors")

# ─── OpenSky ADS-B Connector ─────────────────────────────────


class OpenSkyConnector:
    """Live ADS-B aircraft tracking via OpenSky Network API."""

    BASE_URL = "https://opensky-network.org/api"

    def __init__(self):
        self.last_fetch = 0
        self.cache: List[Dict] = []
        self.cache_ttl = 15  # seconds

    def fetch_aircraft(self, bbox: Optional[List[float]] = None) -> List[Dict]:
        """Fetch aircraft states.

        Args:
            bbox: [lat_min, lon_min, lat_max, lon_max] bounding box filter.

        Returns:
            List of aircraft dicts with position and flight data.
        """
        now = time.time()
        if now - self.last_fetch < self.cache_ttl and self.cache:
            return self.cache

        try:
            params = {}
            if bbox:
                params = {
                    "lamin": bbox[0],
                    "lomin": bbox[1],
                    "lamax": bbox[2],
                    "lomax": bbox[3],
                }

            resp = requests.get(
                f"{self.BASE_URL}/states/all", params=params, timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                states = data.get("states", []) or []
                aircraft = []
                for s in states[:50]:
                    if s[5] is not None and s[6] is not None:
                        aircraft.append({
                            "icao24": s[0],
                            "callsign": (s[1] or "").strip(),
                            "origin_country": s[2],
                            "longitude": s[5],
                            "latitude": s[6],
                            "altitude": s[7] or s[13] or 0,
                            "velocity": s[9] or 0,
                            "heading": s[10] or 0,
                            "vertical_rate": s[11] or 0,
                            "on_ground": s[8],
                            "last_contact": s[4],
                        })
                self.cache = aircraft
                self.last_fetch = now
                log.info(f"OpenSky: fetched {len(aircraft)} aircraft")
                return aircraft
            else:
                log.warning(f"OpenSky API returned {resp.status_code}")
                return self.cache
        except Exception as e:
            log.warning(f"OpenSky fetch failed: {e}")
            return self.cache

    def to_entities(self, aircraft: List[Dict]) -> List[Dict]:
        """Convert aircraft list to SkyDash entity format."""
        return [
            {
                "id": f"adsb-{a['icao24']}",
                "type": "aircraft",
                "name": a["callsign"] or a["icao24"],
                "coordinates": [a["latitude"], a["longitude"]],
                "properties": {
                    "icao24": a["icao24"],
                    "origin_country": a["origin_country"],
                    "altitude_m": round(a["altitude"]),
                    "velocity_ms": round(a["velocity"], 1),
                    "heading": round(a["heading"]),
                    "on_ground": a["on_ground"],
                },
                "confidence": 95,
                "source": "OpenSky ADS-B",
                "tags": ["adsb", "aircraft", "live"],
                "threatLevel": "none",
            }
            for a in aircraft
        ]


# ─── Shodan IoT Connector ────────────────────────────────────


class ShodanConnector:
    """Shodan IoT device search (requires API key for live data)."""

    BASE_URL = "https://api.shodan.io"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.available = bool(api_key)

    def search(self, query: str, limit: int = 10) -> List[Dict]:
        """Search Shodan for IoT devices.

        Args:
            query: Shodan search query string.
            limit: Max results to return (1-50).

        Returns:
            List of device dicts. Falls back to mock data without API key.
        """
        if not self.api_key:
            return self._mock_results(query, limit)

        try:
            resp = requests.get(
                f"{self.BASE_URL}/shodan/host/search",
                params={"key": self.api_key, "query": query, "minify": True},
                timeout=10,
            )
            if resp.status_code == 200:
                results = resp.json().get("matches", [])[:limit]
                return self._normalize(results)
            log.warning(f"Shodan API returned {resp.status_code}")
            return []
        except Exception as e:
            log.warning(f"Shodan fetch failed: {e}")
            return []

    def _normalize(self, matches: List[Dict]) -> List[Dict]:
        """Normalize live Shodan API results to a flat dict."""
        results = []
        for m in matches:
            location = m.get("location", {})
            results.append({
                "ip": m.get("ip_str", ""),
                "port": m.get("port", 0),
                "org": m.get("org", "Unknown"),
                "product": m.get("product", "Unknown"),
                "lat": location.get("latitude"),
                "lon": location.get("longitude"),
            })
        return results

    def _mock_results(self, query: str, limit: int) -> List[Dict]:
        """Return realistic mock results when no API key is configured."""
        all_mocks = [
            {
                "ip": "192.168.1.100",
                "port": 8080,
                "org": "Industrial Corp",
                "product": "Webcam",
                "lat": 37.78,
                "lon": -122.41,
            },
            {
                "ip": "10.0.0.50",
                "port": 554,
                "org": "Security Systems",
                "product": "RTSP Camera",
                "lat": 37.77,
                "lon": -122.42,
            },
            {
                "ip": "172.16.0.25",
                "port": 502,
                "org": "SCADA Inc",
                "product": "Modbus PLC",
                "lat": 37.775,
                "lon": -122.415,
            },
            {
                "ip": "203.0.113.10",
                "port": 443,
                "org": "Telecom Group",
                "product": "Router Admin",
                "lat": 37.785,
                "lon": -122.405,
            },
            {
                "ip": "198.51.100.44",
                "port": 1883,
                "org": "Smart Building Ltd",
                "product": "MQTT Broker",
                "lat": 37.765,
                "lon": -122.43,
            },
        ]
        random.shuffle(all_mocks)
        return all_mocks[:limit]

    def to_entities(self, results: List[Dict]) -> List[Dict]:
        """Convert Shodan results to SkyDash entity format."""
        return [
            {
                "id": f"shodan-{r.get('ip', 'unknown').replace('.', '_')}",
                "type": "device",
                "name": f"{r.get('product', 'Unknown')} @ {r.get('ip', '')}",
                "coordinates": (
                    [r["lat"], r["lon"]] if r.get("lat") and r.get("lon") else None
                ),
                "properties": {
                    "ip": r.get("ip"),
                    "port": r.get("port"),
                    "org": r.get("org"),
                    "product": r.get("product"),
                },
                "confidence": 70,
                "source": "Shodan" if self.api_key else "Shodan (Mock)",
                "tags": ["iot", "shodan"],
                "threatLevel": "medium",
            }
            for r in results
        ]
