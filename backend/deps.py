"""Shared dependencies for SkyDash backend route modules."""

import logging
import os
import time
from collections import deque
from typing import Dict

from simulation import FleetSimulator
from entities import EntityStore
from missions import MissionStore
from connectors import OpenSkyConnector, ShodanConnector
from auth import UserStore
import database

# ── Config ───────────────────────────────────────────────────

PORT = int(os.getenv("SKYDASH_PORT", "8001"))
HOST = os.getenv("SKYDASH_HOST", "0.0.0.0")
API_KEY = os.getenv("SKYDASH_API_KEY", "")
AUTH_ENABLED = bool(
    os.getenv("SKYDASH_AUTH_ENABLED") or os.getenv("SKYDASH_JWT_SECRET")
)
DB_PATH = os.getenv("SKYDASH_DB_PATH", "skydash.db")
CORS_ORIGINS = os.getenv(
    "SKYDASH_CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,"
    "http://127.0.0.1:5173,http://127.0.0.1:5174,"
    "http://localhost:4173,http://localhost:80,http://localhost",
).split(",")

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
)
log = logging.getLogger("skydash")

# ── Shared instances ─────────────────────────────────────────

fleet = FleetSimulator()
entity_store = EntityStore()
mission_store = MissionStore()

database.check_migrations()

user_store = UserStore() if AUTH_ENABLED else None
opensky = OpenSkyConnector()
shodan = ShodanConnector(api_key=os.getenv("SHODAN_API_KEY"))
start_time = time.time()

# ── Telemetry ring buffer (O(1) eviction via deque) ──────────

MAX_HISTORY = 300  # 5 minutes at 1 sample/sec
telemetry_history: deque = deque(maxlen=MAX_HISTORY)

HISTORY_FIELDS = {
    "altitude",
    "battery_percentage",
    "signal_strength",
    "ground_speed",
}
