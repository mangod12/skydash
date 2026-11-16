import os
import secrets
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import auth
import database
from deps import entity_store, mission_store
from routes import auth_routes
import main


class TestAuthHardening(unittest.TestCase):
    def setUp(self):
        self.good_pw = secrets.token_urlsafe(12)
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-auth-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.users = auth.UserStore()
        auth_routes._login_failures.clear()
        self.patches = [
            patch.object(auth_routes, "user_store", self.users),
        ]
        for p in self.patches:
            p.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        auth_routes._login_failures.clear()
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_register_ignores_requested_role(self):
        resp = self.client.post(
            "/api/auth/register",
            json={"username": "mallory", "password": secrets.token_urlsafe(12), "role": "admin"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["user"]["role"], "analyst")

    def test_register_rejects_short_password(self):
        resp = self.client.post(
            "/api/auth/register", json={"username": "bob", "password": "abc"}
        )
        self.assertEqual(resp.status_code, 422)

    def test_login_succeeds_with_valid_credentials(self):
        self.users.create_user("alice", self.good_pw)
        resp = self.client.post(
            "/api/auth/login", json={"username": "alice", "password": self.good_pw}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.json()["data"])

    def test_login_is_throttled_after_repeated_failures(self):
        self.users.create_user("alice", self.good_pw)
        bad = {"username": "alice", "password": "x" + secrets.token_hex(2)}
        for _ in range(auth_routes.LOGIN_MAX_FAILURES):
            self.assertEqual(self.client.post("/api/auth/login", json=bad).status_code, 401)
        blocked = self.client.post("/api/auth/login", json=bad)
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("Retry-After", blocked.headers)
        # Even the right password waits out the window.
        good = {"username": "alice", "password": self.good_pw}
        self.assertEqual(self.client.post("/api/auth/login", json=good).status_code, 429)

    def test_successful_login_resets_failure_count(self):
        self.users.create_user("alice", self.good_pw)
        bad = {"username": "alice", "password": "x" + secrets.token_hex(2)}
        for _ in range(auth_routes.LOGIN_MAX_FAILURES - 1):
            self.client.post("/api/auth/login", json=bad)
        good = {"username": "alice", "password": self.good_pw}
        self.assertEqual(self.client.post("/api/auth/login", json=good).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/login", json=bad).status_code, 401)


class TestPayloadValidation(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-validate-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.client = TestClient(main.app)

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_entity_rejects_empty_name(self):
        self.assertEqual(self.client.post("/api/entities", json={"name": ""}).status_code, 422)

    def test_entity_rejects_out_of_range_confidence(self):
        for value in (-1, 101):
            resp = self.client.post("/api/entities", json={"name": "x", "confidence": value})
            self.assertEqual(resp.status_code, 422)

    def test_entity_accepts_valid_payload(self):
        resp = self.client.post("/api/entities", json={"name": "x", "confidence": 100})
        self.assertEqual(resp.status_code, 201)

    def test_mission_rejects_empty_name(self):
        self.assertEqual(self.client.post("/api/missions", json={"name": ""}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
