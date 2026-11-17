import os
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


class TestHardening(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-hard-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.client = TestClient(main.app)

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_security_headers_present(self):
        h = self.client.get("/health").headers
        self.assertEqual(h["x-content-type-options"], "nosniff")
        self.assertEqual(h["x-frame-options"], "DENY")
        self.assertEqual(h["referrer-policy"], "no-referrer")
        self.assertNotIn("strict-transport-security", h)

    def test_hsts_only_behind_https(self):
        h = self.client.get("/health", headers={"x-forwarded-proto": "https"}).headers
        self.assertIn("max-age", h["strict-transport-security"])

    def test_oversized_body_rejected(self):
        with patch.object(main, "MAX_BODY_BYTES", 10):
            resp = self.client.post("/api/entities", content=b"x" * 50,
                                    headers={"content-type": "application/json"})
        self.assertEqual(resp.status_code, 413)

    def test_chunked_body_rejected(self):
        def gen():
            yield b'{"id": "a"}'
        resp = self.client.post("/api/entities", content=gen(),
                                headers={"content-type": "application/json"})
        self.assertEqual(resp.status_code, 411)

    def test_demo_users_can_be_disabled(self):
        with patch.dict(os.environ, {"SKYDASH_DISABLE_DEMO_USERS": "1"}):
            auth.UserStore()
        count = database.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        self.assertEqual(count, 0)

    def test_demo_users_seeded_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SKYDASH_DISABLE_DEMO_USERS", None)
            auth.UserStore()
        count = database.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        self.assertEqual(count, 3)

    def test_registration_can_be_closed(self):
        store = auth.UserStore()
        with patch.object(auth_routes, "user_store", store), \
                patch.dict(os.environ, {"SKYDASH_ALLOW_REGISTRATION": "false"}):
            resp = self.client.post("/api/auth/register",
                                    json={"username": "newuser", "password": "a-long-enough-pw-1"})
        self.assertEqual(resp.status_code, 403)


if __name__ == "__main__":
    unittest.main()
