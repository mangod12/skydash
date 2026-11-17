import os
import secrets
import shutil
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
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

    @unittest.skipUnless(hasattr(time, "tzset"), "requires process timezone support")
    def test_account_creation_time_is_utc_on_non_utc_hosts(self):
        for zone in ("Asia/Kolkata", "America/Los_Angeles"):
            with self.subTest(zone=zone):
                try:
                    with patch.dict(os.environ, {"TZ": zone}):
                        time.tzset()
                        before = int(time.time())
                        uid = self.users.create_user("utc-" + secrets.token_hex(3), self.good_pw)
                        after = int(time.time())
                        created = self.users.get_user(uid)["created_at"]
                        self.assertTrue(created.endswith("Z"))
                        parsed = datetime.strptime(created, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                        self.assertGreaterEqual(parsed.timestamp(), before)
                        self.assertLessEqual(parsed.timestamp(), after)
                finally:
                    time.tzset()

    def test_duplicate_user_creation_closes_failed_transaction(self):
        self.users.create_user("alice", self.good_pw)
        with self.assertRaises(sqlite3.IntegrityError):
            self.users.create_user("alice", self.good_pw)
        self.assertFalse(database.get_connection().in_transaction)
        uid = self.users.create_user("next-user", self.good_pw)
        self.assertEqual(self.users.get_user(uid)["username"], "next-user")

    def test_registration_race_returns_conflict(self):
        self.users.create_user("alice", self.good_pw)
        # Simulate the name being available at precheck, but taken at insert.
        with patch.object(self.users, "username_exists", side_effect=[False, True]):
            response = self.client.post("/api/auth/register", json={
                "username": "alice", "password": self.good_pw,
            })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "Username taken")
        self.assertFalse(database.get_connection().in_transaction)
        self.assertEqual(len([u for u in self.users.list_users() if u["username"] == "alice"]), 1)

    def test_unrelated_registration_constraint_is_not_a_name_conflict(self):
        conn = database.get_connection()
        conn.execute("""CREATE TRIGGER reject_registration BEFORE INSERT ON users
                        BEGIN SELECT RAISE(ABORT, 'synthetic private failure'); END""")
        conn.commit()
        response = self.client.post("/api/auth/register", json={
            "username": "new-user", "password": self.good_pw,
        })
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("synthetic private failure", response.text)
        self.assertFalse(conn.in_transaction)
        self.assertFalse(self.users.username_exists("new-user"))

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

    def test_oversized_login_username_is_rejected_before_tracking(self):
        response = self.client.post(
            "/api/auth/login", json={"username": "x" * 65, "password": "wrong"}
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(auth_routes._login_failures, {})

    def test_login_tracking_cap_does_not_evict_active_lockouts(self):
        with patch.object(auth_routes, "LOGIN_MAX_TRACKED", 2):
            bad = {"username": "first", "password": "wrong"}
            for _ in range(auth_routes.LOGIN_MAX_FAILURES):
                self.assertEqual(self.client.post("/api/auth/login", json=bad).status_code, 401)
            self.assertEqual(self.client.post(
                "/api/auth/login", json={"username": "second", "password": "wrong"}
            ).status_code, 401)
            for i in range(5):
                self.assertEqual(self.client.post(
                    "/api/auth/login", json={"username": f"extra-{i}", "password": "wrong"}
                ).status_code, 429)
            self.assertEqual(len(auth_routes._login_failures), 2)
            self.assertEqual(self.client.post("/api/auth/login", json=bad).status_code, 429)

    def test_expired_login_buckets_are_reclaimed(self):
        with patch.object(auth_routes.time, "monotonic", return_value=100.0), \
                patch.object(auth_routes, "_last_login_sweep", 0.0):
            auth_routes._recent_failures("old").append(100.0)
            self.assertEqual(len(auth_routes._login_failures), 1)
        with patch.object(auth_routes.time, "monotonic", return_value=160.0), \
                patch.object(auth_routes, "_last_login_sweep", 100.0):
            self.assertIsNotNone(auth_routes._recent_failures("new"))
            self.assertNotIn("old", auth_routes._login_failures)

    def test_successful_login_releases_tracking_bucket(self):
        self.users.create_user("alice", self.good_pw)
        response = self.client.post(
            "/api/auth/login", json={"username": "alice", "password": self.good_pw}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(auth_routes._login_failures, {})

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
