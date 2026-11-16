"""Role-based access control for SkyDash API routes.

Role ladder (low to high): viewer < analyst < operator < commander.
Reads need any authenticated user. Mutations need analyst or higher.
Flight control (drone commands, simulation reset) needs operator or higher.
Auth endpoints are exempt (login and register handle their own checks).
"""

import re

ROLE_LEVEL = {"viewer": 0, "analyst": 1, "operator": 2, "commander": 3}

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

_FLIGHT_CONTROL = (
    re.compile(r"^/api/drone/[^/]+/command/?$"),
    re.compile(r"^/reset/?$"),
)


def required_role(method: str, path: str):
    """Minimum role for this request, or None when no role is required."""
    if path.startswith("/api/auth/"):
        return None
    if method.upper() in SAFE_METHODS:
        return None
    if any(p.match(path) for p in _FLIGHT_CONTROL):
        return "operator"
    return "analyst"


def has_role(user_role, needed) -> bool:
    if needed is None:
        return True
    return ROLE_LEVEL.get(user_role, -1) >= ROLE_LEVEL[needed]
