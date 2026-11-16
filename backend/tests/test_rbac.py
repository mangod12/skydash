import os
import secrets
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import auth
import database
import main
from deps import entity_store, mission_store
from rbac import has_role, required_role
from routes import auth_routes


class TestRbacRules(unittest.TestCase):
    def test_required_role(self):
        self.assertIsNone(required_role("GET", "/api/entities"))
        self.assertIsNone(required_role("POST", "/api/auth/login"))
        self.assertEqual(required_role("POST", "/api/entities"), "analyst")
        self.assertEqual(required_role("DELETE", "/api/missions/m1"), "analyst")
        self.assertEqual(required_role("POST", "/api/drone/ALPHA-1/command"), "operator")
        self.assertEqual(required_role("POST", "/reset"), "operator")

    def test_has_role(self):
        self.assertTrue(has_role("commander", "operator"))
        self.assertTrue(has_role("operator", "operator"))
        self.assertFalse(has_role("analyst", "operator"))
        self.assertFalse(has_role("viewer", "analyst"))
        self.assertFalse(has_role("unknown-role", "analyst"))
        self.assertFalse(has_role(None, "analyst"))
        self.assertTrue(has_role(None, None))


class TestRbacEnforcement(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-rbac-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.users = auth.UserStore()
        auth_routes._login_failures.clear()
        pw = secrets.token_urlsafe(12)
        self.headers = {}
        for role in ("viewer", "analyst", "operator", "commander"):
            uid = self.users.create_user(f"u-{role}", pw, role)
            token = auth.create_token(self.users.get_user(uid))
            self.headers[role] = {"Authorization": f"Bearer {token}"}
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

    def command(self, role):
        return self.client.post(
            "/api/drone/ALPHA-1/command",
            json={"command": "set_mode", "params": {"mode": "HOLD"}},
            headers=self.headers[role],
        )

    def test_viewer_can_read_but_not_mutate(self):
        self.assertEqual(self.client.get("/api/entities", headers=self.headers["viewer"]).status_code, 200)
        resp = self.client.post("/api/entities", json={"name": "x", "type": "device"}, headers=self.headers["viewer"])
        self.assertEqual(resp.status_code, 403)
        self.assertIn("analyst", resp.json()["error"])

    def test_analyst_cannot_command_drones(self):
        resp = self.command("analyst")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("operator", resp.json()["error"])
        self.assertEqual(self.client.post("/reset", headers=self.headers["analyst"]).status_code, 403)

    def test_operator_and_commander_can_command(self):
        self.assertEqual(self.command("operator").status_code, 200)
        self.assertEqual(self.command("commander").status_code, 200)

    def test_missing_token_still_401(self):
        resp = self.client.post("/api/drone/ALPHA-1/command", json={"command": "set_mode", "params": {}})
        self.assertEqual(resp.status_code, 401)


if __name__ == "__main__":
    unittest.main()
