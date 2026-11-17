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
from deps import mission_store, entity_store, fleet


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

    def test_health_counts_entities_without_materialising_payloads(self):
        from unittest.mock import patch

        for name in ("Alpha", "Beta", "Gamma"):
            self.client.post("/api/entities", json={"name": name})
        with patch.object(entity_store, "_row_to_entity", side_effect=AssertionError("Do not load rows")):
            response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["entities"], 3)
        self.assertEqual(response.json()["status"], "healthy")

    def test_health_reports_an_empty_entity_store(self):
        self.assertEqual(self.client.get("/health").json()["entities"], 0)

    def test_telemetry_returns_fleet(self):
        r = self.client.get("/telemetry")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["success"])
        self.assertEqual(len(body["data"]), 3)

    def test_telemetry_history_limit_validation(self):
        r = self.client.get("/api/telemetry/history?limit=0")
        self.assertEqual(r.status_code, 422)


class TestReadFailures(_ApiTestCase):
    def test_failed_reads_return_500_without_private_details(self):
        from unittest.mock import patch

        cases = [
            ("/api/entities", entity_store, "list_entities"),
            ("/api/entities/graph", entity_store, "get_graph"),
            ("/api/entities/contact/graph", entity_store, "get_entity_graph"),
            ("/api/timeline", entity_store, "get_timeline"),
            ("/api/missions", mission_store, "list_missions"),
            ("/telemetry", fleet, "get_all_telemetry"),
        ]
        for path, store, method in cases:
            with self.subTest(path=path), patch.object(
                store, method, side_effect=RuntimeError("private database/adapter details")
            ):
                response = self.client.get(path)
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.json(), {
                "success": False, "error": "Internal server error",
            })
            self.assertNotIn("private", response.text)
        # Empty data is still a successful read, distinct from unavailable data.
        for path in ("/api/entities", "/api/missions", "/api/timeline"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["success"])
            self.assertEqual(response.json()["data"], [])


class TestCreationFailures(_ApiTestCase):
    def test_entity_and_creation_event_roll_back_together(self):
        conn = database.get_connection()
        conn.execute("""CREATE TRIGGER reject_events BEFORE INSERT ON events
                        BEGIN SELECT RAISE(ABORT, 'synthetic event failure'); END""")
        conn.commit()
        response = self.client.post("/api/entities", json={"id": "atomic-contact", "name": "Failed"})
        self.assertEqual(response.status_code, 500)
        self.assertIsNone(entity_store.get_entity("atomic-contact"))
        self.assertEqual(entity_store.get_timeline(), [])
        self.assertFalse(conn.in_transaction)
        conn.execute("DROP TRIGGER reject_events")
        conn.commit()
        response = self.client.post("/api/entities", json={"id": "atomic-contact", "name": "Retry"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(entity_store.count(), 1)
        self.assertEqual(len(entity_store.get_timeline()), 1)
        self.assertFalse(conn.in_transaction)

    def test_failed_standalone_event_leaves_connection_clean(self):
        conn = database.get_connection()
        response = self.client.post("/api/events", json={"description": "Valid"})
        self.assertEqual(response.status_code, 201)
        import sqlite3

        with self.assertRaises(sqlite3.IntegrityError):
            entity_store.add_event({"entityId": "missing", "description": "Invalid FK"})
        self.assertFalse(conn.in_transaction)
        self.assertEqual(len(entity_store.get_timeline()), 1)
        entity_store.add_event({"description": "Next"})
        self.assertEqual(len(entity_store.get_timeline()), 2)

    def test_entity_and_mission_storage_errors_are_not_created(self):
        from unittest.mock import patch

        cases = (("/api/entities", entity_store, "create_entity"),
                 ("/api/missions", mission_store, "create_mission"))
        for url, store, method in cases:
            with self.subTest(url=url), patch.object(
                store, method, side_effect=RuntimeError("private storage path")
            ):
                response = self.client.post(url, json={"name": "Valid"})
                self.assertEqual(response.status_code, 500)
                self.assertEqual(response.json()["detail"], "Internal server error")
                self.assertNotIn("private storage path", response.text)
        self.assertEqual(entity_store.count(), 0)
        self.assertEqual(mission_store.count(), 0)


class TestEventRecordIntegrity(_ApiTestCase):
    def test_invalid_event_fields_are_rejected_without_writes(self):
        from unittest.mock import patch

        with patch.object(entity_store, "add_event") as write:
            for payload in ({"type": {"nested": "object"}}, {"description": ["list"]},
                            {"description": "x" * 10001}, {"entityId": ""},
                            {"severity": None}, {"severity": "x" * 33}):
                with self.subTest(payload_type=list(payload)):
                    self.assertEqual(self.client.post("/api/events", json=payload).status_code, 422)
            write.assert_not_called()

    def test_missing_entity_reference_is_404_without_writes(self):
        response = self.client.post("/api/events", json={"entityId": "missing"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get("/api/timeline").json()["data"], [])

    def test_linked_event_roundtrip(self):
        entity = self.client.post("/api/entities", json={"name": "Contact"}).json()["data"]
        response = self.client.post("/api/events", json={
            "entityId": entity["id"], "description": "Contact updated", "severity": "warning"
        })
        self.assertEqual(response.status_code, 201)
        event = response.json()["data"]
        self.assertEqual(event["entityId"], entity["id"])
        self.assertIn(event, self.client.get("/api/timeline").json()["data"])

    def test_event_store_failure_is_not_reported_as_created(self):
        from unittest.mock import patch

        with patch.object(entity_store, "add_event", side_effect=RuntimeError("private error")):
            response = self.client.post("/api/events", json={"description": "Valid"})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private error", response.text)

    def test_client_cannot_override_generated_identity_or_timestamp(self):
        payload = {
            "id": "spoofed-event", "time": -1, "type": "test",
            "description": "Identity integrity", "severity": "warning",
            "unpersisted": "not a stored field",
        }
        response = self.client.post("/api/events", json=payload)
        self.assertEqual(response.status_code, 201)
        event = response.json()["data"]
        self.assertNotEqual(event["id"], payload["id"])
        self.assertGreater(event["time"], 0)
        self.assertNotIn("unpersisted", event)
        stored = self.client.get("/api/timeline").json()["data"]
        self.assertEqual(stored, [event])

    def test_response_includes_persisted_defaults(self):
        response = self.client.post("/api/events", json={"description": "Default severity"})
        self.assertEqual(response.status_code, 201)
        event = response.json()["data"]
        self.assertEqual(event["severity"], "info")
        self.assertIsNone(event["type"])
        self.assertIsNone(event["entityId"])
        self.assertEqual(self.client.get("/api/timeline").json()["data"], [event])


class TestTimelinePagination(_ApiTestCase):
    def test_invalid_pagination_does_not_reach_store(self):
        from unittest.mock import patch

        with patch.object(entity_store, "get_timeline") as query:
            for params in ({"limit": -1}, {"limit": 0}, {"limit": 1001},
                           {"offset": -1}, {"offset": 9223372036854775808}):
                with self.subTest(params=params):
                    response = self.client.get("/api/timeline", params=params)
                    self.assertEqual(response.status_code, 422)
            query.assert_not_called()

    def test_pages_are_bounded_and_newest_first(self):
        database.executemany(
            "INSERT INTO events (id, time, description) VALUES (?,?,?)",
            [(f"event-{i}", i, "Timeline test") for i in range(1005)],
        )
        default = self.client.get("/api/timeline").json()
        self.assertEqual(len(default["data"]), 50)
        self.assertEqual(default["metadata"], {"limit": 50, "offset": 0})
        maximum = self.client.get("/api/timeline?limit=1000").json()["data"]
        self.assertEqual(len(maximum), 1000)
        first = self.client.get("/api/timeline?limit=2&offset=0").json()["data"]
        second = self.client.get("/api/timeline?limit=2&offset=2").json()["data"]
        self.assertEqual([row["time"] for row in first + second], [1004, 1003, 1002, 1001])
        empty = self.client.get("/api/timeline?offset=9223372036854775807")
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.json()["data"], [])


class TestEntities(_ApiTestCase):
    def test_duplicate_id_returns_conflict_without_overwriting_or_adding_events(self):
        original = self.client.post("/api/entities", json={
            "id": "stable-contact", "name": "Original", "confidence": 25
        }).json()["data"]
        timeline = self.client.get("/api/timeline").json()["data"]
        response = self.client.post("/api/entities", json={
            "id": "stable-contact", "name": "Replacement", "confidence": 99
        })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.get("/api/entities/stable-contact").json()["data"], original)
        self.assertEqual(self.client.get("/api/timeline").json()["data"], timeline)
        self.assertEqual(entity_store.count(), 1)
        # A rejected duplicate must not poison subsequent database writes.
        self.assertEqual(self.client.post("/api/entities", json={"name": "Next"}).status_code, 201)

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
