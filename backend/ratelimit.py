"""Optional per-client request rate limit.

Off by default so existing deployments behave as before. Set
SKYDASH_RATE_LIMIT_PER_MIN (for example 600) to cap /api requests per client address per
minute; excess requests get 429 with Retry-After. /health and WebSockets are exempt.
Client address comes from client_ip (see SKYDASH_TRUST_PROXY).
"""

import os
import time
from collections import defaultdict, deque

WINDOW_SECONDS = 60
_MAX_TRACKED = 10000
_hits = defaultdict(deque)


def limit_per_minute() -> int:
    try:
        return max(0, int(os.getenv("SKYDASH_RATE_LIMIT_PER_MIN", "0")))
    except ValueError:
        return 0


def check(client: str, path: str, now: float = None):
    """Return seconds to wait if the client is over the limit, else None."""
    limit = limit_per_minute()
    if not limit or not path.startswith("/api/"):
        return None
    now = time.monotonic() if now is None else now
    if len(_hits) > _MAX_TRACKED:
        for k in [k for k, d in _hits.items() if not d or d[-1] < now - WINDOW_SECONDS]:
            _hits.pop(k, None)
    q = _hits[client]
    while q and q[0] <= now - WINDOW_SECONDS:
        q.popleft()
    if len(q) >= limit:
        return max(1, int(q[0] + WINDOW_SECONDS - now) + 1)
    q.append(now)
    return None
