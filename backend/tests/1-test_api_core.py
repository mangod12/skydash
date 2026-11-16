"""API tests for core routes: telemetry, entities, missions, export, auth.

Follows the style of test_vision_routes.py: unittest + TestClient on a
throwaway SQLite database per test.
"""

import os
import shutil
import tempfile
import unittest

from fastapi.testclient import TestClient

import database
import main
from deps import mission_store, entity_store


class _ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-api-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        conn = database.get_connection()
        conn.execute("DROP TABLE IF EXISTS schema_meta")
        conn.execute("CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT)")
        conn.commit()
        mission_store._init_tables()
        entity_store._init_tables()

        conn.execute("INSERT INTO schema_meta (key, value) VALUES ('version', '3')")
        conn.commit()
        self.client = TestClient(main.app)

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)


class TestHealthAndTelemetry(_ApiTestCase):
    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "healthy")

    def test_telemetry_returns_fleet(self):
        r = self.client.get("/telemetry")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["success"])
        self.assertEqual(len(body["data"]), 3)

    def test_telemetry_history_limit_validation(self):
        r = self.client.get("/api/telemetry/history?limit=0")
        self.assertEqual(r.status_code, 422)


class TestEntities(_ApiTestCase):
    def test_entity_crud_roundtrip(self):
        payload = {"name": "Test Contact", "type": "vehicle"}
        r = self.client.post("/api/entities", json=payload)
        self.assertEqual(r.status_code, 201, r.text)
        entity = r.json()["data"]
        eid = entity["id"]

        got = self.client.get(f"/api/entities/{eid}")
        self.assertEqual(got.status_code, 200)
        self.assertEqual(got.json()["data"]["name"], "Test Contact")

        listed = self.client.get("/api/entities").json()
        self.assertIn(eid, [e["id"] for e in listed["data"]])

        deleted = self.client.delete(f"/api/entities/{eid}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get(f"/api/entities/{eid}").status_code, 404)

    def test_unknown_entity_is_404(self):
        self.assertEqual(self.client.get("/api/entities/does-not-exist").status_code, 404)


class TestMissions(_ApiTestCase):
    def test_mission_create_get_delete(self):
        r = self.client.post("/api/missions", json={"name": "Alpha"})
        self.assertEqual(r.status_code, 201)
        mid = r.json()["data"]["id"]
        self.assertEqual(self.client.get(f"/api/missions/{mid}").status_code, 200)
        self.client.delete(f"/api/missions/{mid}")
        self.assertEqual(self.client.get(f"/api/missions/{mid}").status_code, 404)

    def test_notes_roundtrip(self):
        mid = self.client.post("/api/missions", json={"name": "Notes"}).json()["data"]["id"]
        n = self.client.post(f"/api/missions/{mid}/notes", json={"content": "hello"})
        self.assertEqual(n.status_code, 201, n.text)
        notes = self.client.get(f"/api/missions/{mid}/notes").json()["data"]
        self.assertEqual(len(notes), 1)


class TestExport(_ApiTestCase):
    def test_geojson_is_feature_collection(self):
        r = self.client.post("/api/export/geojson")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["type"], "FeatureCollection")

    def test_entities_csv_has_header(self):
        r = self.client.get("/api/export/entities/csv")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r.headers["content-type"])


class TestAuthDisabledByDefault(_ApiTestCase):
    def test_login_rejected_when_auth_off(self):
        import deps
        if deps.AUTH_ENABLED:
            self.skipTest("auth enabled in this environment")
        r = self.client.post("/api/auth/login", json={"username": "a", "password": "b"})
        self.assertEqual(r.status_code, 400)


if __name__ == "__main__":
    unittest.main()
