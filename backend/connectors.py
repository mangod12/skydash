"""OSINT data source connectors for SkyDash.

Each connector fetches from external APIs and normalizes to SkyDash entity format.
- OpenSky: live ADS-B aircraft tracking (no API key required)
- Shodan: IoT device search (API key optional, falls back to mock)
"""

import logging
import math
import random
import time
import threading
from typing import Dict, List, Optional

import requests

log = logging.getLogger("skydash.connectors")

# ─── OpenSky ADS-B Connector ─────────────────────────────────


class OpenSkyUnavailable(RuntimeError):
    """An upstream refresh failed; expired aircraft must not be treated as live."""


class OpenSkyConnector:
    """Live ADS-B aircraft tracking via OpenSky Network API."""

    BASE_URL = "https://opensky-network.org/api"

    def __init__(self):
        self.last_fetch = 0
        self._cache_time = None
        self.cache: List[Dict] = []
        self.cache_ttl = 15  # seconds
        self.cache_bbox = None
        self._fetch_lock = threading.Lock()

    def fetch_aircraft(self, bbox: Optional[List[float]] = None) -> List[Dict]:
        """Fetch aircraft states.

        Args:
            bbox: [lat_min, lon_min, lat_max, lon_max] bounding box filter.

        Returns:
            List of aircraft dicts with position and flight data.

        Raises:
            OpenSkyUnavailable: A required upstream refresh failed. The last
                successful cache is retained internally, but never returned
                beyond its TTL on a failed refresh.
        """
        # Requests can run in separate API worker threads. Keep region/cache state
        # together and coalesce simultaneous refreshes for the same region.
        with self._fetch_lock:
            return self._fetch_aircraft(bbox)

    def _fetch_aircraft(self, bbox: Optional[List[float]]) -> List[Dict]:
        now = time.monotonic()
        bbox_key = tuple(bbox) if bbox else None
        same_region = bbox_key == self.cache_bbox
        if same_region and self._cache_time is not None and 0 <= now - self._cache_time < self.cache_ttl:
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
                if not isinstance(data, dict) or "states" not in data:
                    raise ValueError("Invalid OpenSky response envelope")
                states = data["states"]
                if states is None:
                    states = []
                if not isinstance(states, (list, tuple)):
                    raise ValueError("Invalid OpenSky state collection")
                aircraft = []
                for s in states[:50]:
                    # A malformed upstream row must not discard the valid batch.
                    if not isinstance(s, (list, tuple)) or len(s) < 14:
                        continue
                    lon, lat = s[5], s[6]
                    if (type(lat) not in (int, float) or type(lon) not in (int, float)
                            or not math.isfinite(lat) or not math.isfinite(lon)
                            or abs(lat) > 90 or abs(lon) > 180):
                        continue
                    if not isinstance(s[0], str) or not s[0]:
                        continue
                    if s[1] is not None and not isinstance(s[1], str):
                        continue
                    altitude = s[7] if s[7] is not None else s[13]
                    altitude = 0 if altitude is None else altitude
                    velocity = 0 if s[9] is None else s[9]
                    heading = 0 if s[10] is None else s[10]
                    vertical_rate = 0 if s[11] is None else s[11]
                    if any(type(value) not in (int, float) or not math.isfinite(value)
                           for value in (altitude, velocity, heading, vertical_rate)):
                        continue
                    aircraft.append({
                        "icao24": s[0],
                        "callsign": (s[1] or "").strip(),
                        "origin_country": s[2],
                        "longitude": lon,
                        "latitude": lat,
                        "altitude": altitude,
                        "velocity": velocity,
                        "heading": heading,
                        "vertical_rate": vertical_rate,
                        "on_ground": s[8],
                        "last_contact": s[4],
                    })
                self.cache = aircraft
                self.cache_bbox = bbox_key
                self._cache_time = time.monotonic()
                self.last_fetch = time.time()
                log.info(f"OpenSky: fetched {len(aircraft)} aircraft")
                return aircraft
            else:
                log.warning("OpenSky API returned HTTP %s", resp.status_code)
                raise ValueError("OpenSky returned an unsuccessful status")
        except Exception as e:
            log.warning("OpenSky fetch failed (%s)", type(e).__name__)
            raise OpenSkyUnavailable("OpenSky feed unavailable") from None

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
            # Request exceptions can include the full URL, including the API key
            # passed in query parameters. Keep diagnostics without logging it.
            log.warning("Shodan fetch failed (%s)", type(e).__name__)
            return []

    def _normalize(self, matches: List[Dict]) -> List[Dict]:
        """Normalize live Shodan API results to a flat dict."""
        results = []
        for m in matches:
            if not isinstance(m, dict):
                continue
            ip = m.get("ip_str")
            if not isinstance(ip, str) or not ip.strip():
                continue
            location = m.get("location")
            if not isinstance(location, dict):
                location = {}
            lat, lon = location.get("latitude"), location.get("longitude")
            if not self._valid_position(lat, lon):
                lat, lon = None, None
            results.append({
                "ip": ip.strip(),
                "port": m.get("port", 0),
                "org": m.get("org", "Unknown"),
                "product": m.get("product", "Unknown"),
                "lat": lat,
                "lon": lon,
            })
        return results

    def _mock_results(self, query: str, limit: int) -> List[Dict]:
        """Return realistic mock results when no API key is configured."""
        all_mocks = [
            {
                "ip": "203.0.113.24",
                "port": 8080,
                "org": "Example Industrial Corp",
                "product": "Webcam",
                "lat": 37.78,
                "lon": -122.41,
            },
            {
                "ip": "198.51.100.37",
                "port": 554,
                "org": "Example Security Systems",
                "product": "RTSP Camera",
                "lat": 37.77,
                "lon": -122.42,
            },
            {
                "ip": "192.0.2.61",
                "port": 502,
                "org": "Example SCADA Inc",
                "product": "Modbus PLC",
                "lat": 37.775,
                "lon": -122.415,
            },
            {
                "ip": "203.0.113.80",
                "port": 443,
                "org": "Example Telecom Group",
                "product": "Router Admin",
                "lat": 37.785,
                "lon": -122.405,
            },
            {
                "ip": "198.51.100.144",
                "port": 1883,
                "org": "Example Smart Building Ltd",
                "product": "MQTT Broker",
                "lat": 37.765,
                "lon": -122.43,
            },
        ]
        random.shuffle(all_mocks)
        return all_mocks[:limit]

    @staticmethod
    def _valid_position(lat, lon):
        return (type(lat) in (int, float) and type(lon) in (int, float)
                and math.isfinite(lat) and math.isfinite(lon)
                and abs(lat) <= 90 and abs(lon) <= 180)

    def to_entities(self, results: List[Dict]) -> List[Dict]:
        """Convert Shodan results to SkyDash entity format."""
        return [
            {
                "id": f"shodan-{r.get('ip', 'unknown').replace('.', '_')}",
                "type": "device",
                "name": f"{r.get('product', 'Unknown')} @ {r.get('ip', '')}",
                "coordinates": (
                    [r["lat"], r["lon"]] if self._valid_position(r.get("lat"), r.get("lon")) else None
                ),
                "properties": {
                    "ip": r.get("ip"),
                    "port": r.get("port"),
                    "org": r.get("org"),
                    "product": r.get("product"),
                    "mode": "live" if self.api_key else "mock",
                },
                "confidence": 70,
                "source": "Shodan" if self.api_key else "Shodan (Mock)",
                "tags": ["iot", "shodan"],
                "threatLevel": "medium",
            }
            for r in results
        ]
