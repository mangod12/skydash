import os
import secrets
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import audit
import auth
import database
import main
from deps import entity_store, mission_store
from routes import auth_routes


class TestAuditLog(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-audit-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.users = auth.UserStore()
        auth_routes._login_failures.clear()
        self.pw = secrets.token_urlsafe(12)
        self.h = {}
        for role in ("analyst", "operator", "commander"):
            uid = self.users.create_user(f"u-{role}", self.pw, role)
            self.h[role] = {"Authorization": f"Bearer {auth.create_token(self.users.get_user(uid))}"}
        self.patches = [
            patch.object(main, "AUTH_ENABLED", True),
            patch.object(main, "API_KEY", ""),
            patch.object(auth_routes, "user_store", self.users),
        ]
        for p in self.patches:
            p.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_should_audit(self):
        self.assertTrue(audit.should_audit("POST", "/api/entities"))
        self.assertTrue(audit.should_audit("POST", "/api/auth/login"))
        self.assertFalse(audit.should_audit("GET", "/api/entities"))
        self.assertFalse(audit.should_audit("POST", "/ws/telemetry"))

    def test_mutations_and_denials_are_recorded_without_bodies(self):
        self.client.post("/api/drone/ALPHA-1/command",
                         json={"command": "set_mode", "params": {"mode": "HOLD"}}, headers=self.h["operator"])
        self.client.post("/api/drone/ALPHA-1/command",
                         json={"command": "set_mode", "params": {"mode": "HOLD"}}, headers=self.h["analyst"])
        self.client.post("/api/auth/login", json={"username": "u-analyst", "password": "wrong-password-1"})
        self.client.get("/api/entities", headers=self.h["analyst"])  # reads are not audited

        rows = self.client.get("/api/audit", headers=self.h["commander"]).json()["data"]
        summary = [(r["username"], r["method"], r["path"], r["status"]) for r in rows]
        self.assertIn(("u-operator", "POST", "/api/drone/ALPHA-1/command", 200), summary)
        self.assertIn(("u-analyst", "POST", "/api/drone/ALPHA-1/command", 403), summary)
        self.assertTrue(any(p == "/api/auth/login" and s == 401 for _, _, p, s in summary))
        self.assertFalse(any(m == "GET" and p == "/api/entities" for _, m, p, _ in summary))
        self.assertNotIn("wrong-password-1", str(rows))

    def test_audit_endpoint_is_commander_only(self):
        self.assertEqual(self.client.get("/api/audit", headers=self.h["operator"]).status_code, 403)
        self.assertEqual(self.client.get("/api/audit", headers=self.h["analyst"]).status_code, 403)
        self.assertEqual(self.client.get("/api/audit", headers=self.h["commander"]).status_code, 200)

    def test_csv_export_is_commander_only_and_safe(self):
        self.assertEqual(self.client.get("/api/audit/export", headers=self.h["operator"]).status_code, 403)
        self.client.post("/api/drone/ALPHA-1/command",
                         json={"command": "set_mode", "params": {"mode": "HOLD"}}, headers=self.h["operator"])
        r = self.client.get("/api/audit/export", headers=self.h["commander"])
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r.headers["content-type"])
        lines = r.text.strip().split("\n")
        self.assertEqual(lines[0], "id,time_utc,username,role,method,path,status,client")
        self.assertTrue(any("u-operator" in line and "/api/drone/ALPHA-1/command" in line for line in lines[1:]))

    def test_csv_cells_cannot_inject_formulas(self):
        row = {"id": 1, "ts": 0, "username": "=cmd|' /C calc'!A0", "role": "analyst", "method": "POST",
               "path": "/x", "status": 200, "client": None}
        text = audit.to_csv([row])
        self.assertIn("'=cmd", text)
        self.assertNotIn(",=cmd", text)

    def test_filter_by_username_and_limit(self):
        for _ in range(3):
            self.client.post("/api/drone/ALPHA-1/command",
                             json={"command": "set_mode", "params": {"mode": "HOLD"}}, headers=self.h["operator"])
        rows = self.client.get("/api/audit?username=u-operator&limit=2", headers=self.h["commander"]).json()["data"]
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r["username"] == "u-operator" for r in rows))


if __name__ == "__main__":
    unittest.main()
