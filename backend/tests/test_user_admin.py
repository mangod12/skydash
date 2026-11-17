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
from routes import auth_routes


class TestUserAdmin(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-ua-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.users = auth.UserStore()
        auth_routes._login_failures.clear()
        self.pw = "tide-Harbor-" + secrets.token_hex(3)
        self.ids = {r: self.users.create_user(f"ua-{r}", self.pw, r) for r in ("viewer", "analyst", "commander")}
        self.patches = [
            patch.object(main, "AUTH_ENABLED", True),
            patch.object(main, "API_KEY", ""),
            patch.object(auth_routes, "AUTH_ENABLED", True),
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

    def hdr(self, role):
        t = auth.create_token(self.users.get_user(self.ids[role]))
        return {"Authorization": f"Bearer {t}"}

    def test_only_commander_can_list_or_update(self):
        for role in ("viewer", "analyst"):
            self.assertEqual(self.client.get("/api/users", headers=self.hdr(role)).status_code, 403)
            r = self.client.patch(f"/api/users/{self.ids['viewer']}", json={"role": "operator"}, headers=self.hdr(role))
            self.assertEqual(r.status_code, 403)
        r = self.client.get("/api/users", headers=self.hdr("commander"))
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()["data"]), 3)
        self.assertNotIn("password_hash", r.text)

    def test_role_change_applies_to_existing_token(self):
        h = self.hdr("viewer")
        self.assertEqual(self.client.post("/api/entities", json={"name": "x", "type": "device"}, headers=h).status_code, 403)
        r = self.client.patch(f"/api/users/{self.ids['viewer']}", json={"role": "analyst"}, headers=self.hdr("commander"))
        self.assertEqual(r.json()["data"]["role"], "analyst")
        self.assertNotEqual(self.client.post("/api/entities", json={"name": "x", "type": "device"}, headers=h).status_code, 403)

    def test_disable_blocks_login_and_token(self):
        h = self.hdr("analyst")
        self.client.patch(f"/api/users/{self.ids['analyst']}", json={"disabled": True}, headers=self.hdr("commander"))
        self.assertEqual(self.client.get("/api/auth/me", headers=h).status_code, 401)
        r = self.client.post("/api/auth/login", json={"username": "ua-analyst", "password": self.pw})
        self.assertEqual(r.status_code, 401)
        self.client.patch(f"/api/users/{self.ids['analyst']}", json={"disabled": False}, headers=self.hdr("commander"))
        r = self.client.post("/api/auth/login", json={"username": "ua-analyst", "password": self.pw})
        self.assertEqual(r.status_code, 200)

    def test_guards(self):
        c = self.hdr("commander")
        self.assertEqual(self.client.patch(f"/api/users/{self.ids['commander']}", json={"disabled": True}, headers=c).status_code, 409)
        self.assertEqual(self.client.patch(f"/api/users/{self.ids['commander']}", json={"role": "viewer"}, headers=c).status_code, 409)
        self.assertEqual(self.client.patch(f"/api/users/{self.ids['viewer']}", json={"role": "god"}, headers=c).status_code, 422)
        self.assertEqual(self.client.patch("/api/users/nope", json={"role": "viewer"}, headers=c).status_code, 404)
