"""Black-box smoke test for a backend running with authentication on.

    python scripts/auth_smoke.py http://localhost:8002

Needs a server started with SKYDASH_JWT_SECRET set (and, ideally,
SKYDASH_DISABLE_DEMO_USERS=1). Creates one throwaway analyst account via
self-registration, so registration must be open. Uses only the standard library.
"""

import json
import secrets
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001").rstrip("/")


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def check(name, cond):
    print(("ok   " if cond else "FAIL ") + name)
    if not cond:
        sys.exit(1)


status, _ = call("GET", "/health")
check("health is public", status == 200)
status, _ = call("GET", "/api/entities")
check("API requires a token", status == 401)
status, _ = call("POST", "/api/auth/login", {"username": "nobody", "password": "wrong-Pass-1"})
check("bad login is refused", status == 401)

name = "smoke-" + secrets.token_hex(3)
pw = "Smoke-" + secrets.token_hex(6)
status, body = call("POST", "/api/auth/register", {"username": name, "password": pw})
check("registration works and gives an analyst", status == 200 and body["data"]["user"]["role"] == "analyst")
status, _ = call("POST", "/api/auth/register", {"username": name + "x", "password": "password123"})
check("weak password is rejected", status == 422)

status, body = call("POST", "/api/auth/login", {"username": name, "password": pw})
check("login works", status == 200)
token = body["data"]["token"]

status, _ = call("GET", "/api/entities", token=token)
check("analyst can read", status == 200)
status, _ = call("POST", "/api/drone/ALPHA-1/command", {"command": "set_mode", "params": {"mode": "HOLD"}}, token)
check("analyst cannot send flight commands", status == 403)
status, _ = call("GET", "/api/users", token=token)
check("analyst cannot list users", status == 403)
status, _ = call("GET", "/api/audit", token=token)
check("analyst cannot read the audit trail", status == 403)

status, body = call("POST", "/api/auth/ws-ticket", token=token)
check("ws ticket issued", status == 200 and body["data"]["ticket"])

status, _ = call("POST", "/api/auth/logout", token=token)
check("logout works", status == 200)
status, _ = call("GET", "/api/auth/me", token=token)
check("token is revoked after logout", status == 401)
print("auth smoke passed")
