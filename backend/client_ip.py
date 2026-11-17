"""Client address resolution.

Behind the bundled nginx every request arrives from the proxy's address, which
would make the login throttle and the audit trail see one client. Set
SKYDASH_TRUST_PROXY=1 only when the backend is reachable solely through a proxy
that sets X-Real-IP (do not publish port 8001 in that case).
"""

import os


def client_ip(request) -> str:
    if os.getenv("SKYDASH_TRUST_PROXY", "").lower() in ("1", "true", "yes"):
        real = request.headers.get("x-real-ip", "").strip()
        if real:
            return real[:64]
    return request.client.host if request.client else "unknown"
