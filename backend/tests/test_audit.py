import asyncio
import threading
import os
import secrets
import shutil
import tempfile
import unittest
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient
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

    def test_slow_audit_reads_do_not_block_other_api_requests(self):
        for path in ("/api/audit", "/api/audit/export"):
            entered, release, finished = threading.Event(), threading.Event(), threading.Event()
            def slow(*args, **kwargs):
                entered.set()
                try:
                    release.wait(3)
                    return []
                finally:
                    finished.set()
            async def exercise():
                async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
                    pending = asyncio.create_task(client.get(path, headers=self.h["commander"]))
                    try:
                        self.assertTrue(await asyncio.to_thread(entered.wait, 2))
                        response = await client.get("/api/connectors/status", headers=self.h["commander"])
                        self.assertEqual(response.status_code, 200)
                        self.assertFalse(finished.is_set(), "Audit read blocked the API event loop")
                    finally:
                        release.set()
                        response = await pending
                    self.assertEqual(response.status_code, 200)
            with self.subTest(path=path), patch.object(audit, "query", side_effect=slow):
                asyncio.run(exercise())

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

    def test_failed_login_records_attempted_username_without_role(self):
        self.client.post("/api/auth/login", json={"username": "intruder", "password": "wrong-password-1"})
        rows = self.client.get("/api/audit", headers=self.h["commander"]).json()["data"]
        hit = [r for r in rows if r["path"] == "/api/auth/login" and r["username"] == "intruder"]
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0]["status"], 401)
        self.assertIsNone(hit[0]["role"])
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
        import csv
        import io

        rows = list(csv.reader(io.StringIO(r.text, newline="")))
        self.assertEqual(tuple(rows[0]), audit.CSV_COLUMNS)
        self.assertTrue(any(row[2] == "u-operator" and row[5] == "/api/drone/ALPHA-1/command" for row in rows[1:]))

    def test_csv_cells_cannot_inject_formulas(self):
        row = {"id": 1, "ts": 0, "username": "=cmd|' /C calc'!A0", "role": "analyst", "method": "POST",
               "path": "/x", "status": 200, "client": None}
        text = audit.to_csv([row])
        self.assertIn("'=cmd", text)
        self.assertNotIn(",=cmd", text)

    def test_csv_control_characters_preserve_record_boundaries(self):
        import csv
        import io

        for username in ("normal\r=1+1", "normal\n=1+1", 'quoted,"name', "\r=1+1"):
            with self.subTest(username=username):
                row = {"id": 1, "ts": 0, "username": username, "role": "analyst",
                       "method": "POST", "path": "/api/auth/login", "status": 401, "client": None}
                text = audit.to_csv([row])
                parsed = list(csv.reader(io.StringIO(text, newline="")))
                self.assertEqual(len(parsed), 2)
                self.assertEqual(tuple(parsed[0]), audit.CSV_COLUMNS)
                self.assertEqual(len(parsed[1]), len(audit.CSV_COLUMNS))
                self.assertEqual(parsed[1][2], audit._safe_cell(username))
                self.assertEqual(parsed[1][5], "/api/auth/login")
                self.assertTrue(text.endswith("\r\n"))

    def test_filter_by_username_and_limit(self):
        for _ in range(3):
            self.client.post("/api/drone/ALPHA-1/command",
                             json={"command": "set_mode", "params": {"mode": "HOLD"}}, headers=self.h["operator"])
        rows = self.client.get("/api/audit?username=u-operator&limit=2", headers=self.h["commander"]).json()["data"]
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r["username"] == "u-operator" for r in rows))


if __name__ == "__main__":
    unittest.main()
