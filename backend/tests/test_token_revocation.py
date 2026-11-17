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
        t = self.login()["Authorization"].removeprefix("Bearer ")
        p = auth.verify_token(t)
        self.assertTrue(p["jti"])
        auth.revoke_token(p)
        self.assertIsNone(auth.verify_token(t))

    def test_deleted_account_token_is_rejected(self):
        h = self.login()
        database.execute("DELETE FROM users WHERE username=?", ("rev-user",), commit=True)
        self.assertEqual(self.client.get("/api/auth/me", headers=h).status_code, 401)

    def test_missing_revocation_table_rejects_session(self):
        h = self.login()
        database.execute("DROP TABLE revoked_tokens", commit=True)
        self.assertEqual(self.client.get("/api/auth/me", headers=h).status_code, 401)

    def test_missing_account_table_rejects_session(self):
        h = self.login()
        database.execute("DROP TABLE users", commit=True)
        self.assertEqual(self.client.get("/api/auth/me", headers=h).status_code, 401)

    def test_database_outage_rejects_session(self):
        token = self.login()["Authorization"].removeprefix("Bearer ")
        with patch.object(database, "get_connection", side_effect=RuntimeError("unavailable")):
            self.assertIsNone(auth.verify_token(token))

    def test_failed_revocation_rolls_back_cleanup_and_insert(self):
        import sqlite3

        token = self.login()["Authorization"].removeprefix("Bearer ")
        payload = auth.verify_token(token)
        conn = database.get_connection()
        conn.execute("INSERT INTO revoked_tokens (jti, exp) VALUES (?, ?)", ("expired-fixture", 1))
        conn.execute("""CREATE TRIGGER reject_revocation AFTER INSERT ON revoked_tokens
                        BEGIN SELECT RAISE(FAIL, 'synthetic failure'); END""")
        conn.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            auth.revoke_token(payload)
        self.assertFalse(conn.in_transaction)
        entity_store.add_event({"description": "Unrelated commit"})
        rows = conn.execute("SELECT jti FROM revoked_tokens").fetchall()
        self.assertEqual([row[0] for row in rows], ["expired-fixture"])
        self.assertIsNotNone(auth.verify_token(token))
        conn.execute("DROP TRIGGER reject_revocation")
        conn.commit()
        self.assertTrue(auth.revoke_token(payload))
        self.assertIsNone(auth.verify_token(token))

    def test_revocation_waits_for_existing_writer(self):
        import threading
        from concurrent.futures import ThreadPoolExecutor

        token = self.login()["Authorization"].removeprefix("Bearer ")
        payload = auth.verify_token(token)
        started = threading.Event()
        finished = threading.Event()

        def revoke():
            started.set()
            try:
                return auth.revoke_token(payload)
            finally:
                finished.set()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with database.get_lock():
                future = executor.submit(revoke)
                self.assertTrue(started.wait(2))
                finished_early = finished.wait(0.1)
            self.assertTrue(future.result(timeout=2))
        self.assertFalse(finished_early)
        self.assertIsNone(auth.verify_token(token))
