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


class TestTokenRevocation(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-rev-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.users = auth.UserStore()
        auth_routes._login_failures.clear()
        self.pw = "tide-Harbor-" + secrets.token_hex(3)
        self.users.create_user("rev-user", self.pw, "viewer")
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

    def login(self):
        r = self.client.post("/api/auth/login", json={"username": "rev-user", "password": self.pw})
        return {"Authorization": f"Bearer {r.json()['data']['token']}"}

    def test_logout_revokes_token(self):
        h = self.login()
        self.assertEqual(self.client.get("/api/auth/me", headers=h).status_code, 200)
        self.assertTrue(self.client.post("/api/auth/logout", headers=h).json()["success"])
        self.assertEqual(self.client.get("/api/auth/me", headers=h).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/logout", headers=h).status_code, 401)

    def test_other_sessions_survive(self):
        a, b = self.login(), self.login()
        self.client.post("/api/auth/logout", headers=a)
        self.assertEqual(self.client.get("/api/auth/me", headers=b).status_code, 200)

    def test_logout_requires_token(self):
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 401)

    def test_revoke_unit(self):
        t = auth.create_token({"id": "u1", "username": "x", "role": "viewer"})
        p = auth.verify_token(t)
        self.assertTrue(p["jti"])
        auth.revoke_token(p)
        self.assertIsNone(auth.verify_token(t))
