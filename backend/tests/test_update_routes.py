import os
import shutil
import tempfile
import unittest

from fastapi.testclient import TestClient

import database
from deps import entity_store, mission_store
import main


class TestUpdateRoutes(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-update-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.client = TestClient(main.app)
        self.eid = self.client.post("/api/entities", json={"name": "Alpha"}).json()["data"]["id"]
        self.mid = self.client.post("/api/missions", json={"name": "Recon"}).json()["data"]["id"]

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_entity_partial_update_keeps_other_fields(self):
        resp = self.client.put(f"/api/entities/{self.eid}", json={"confidence": 80})
        data = resp.json()["data"]
        self.assertEqual(data["confidence"], 80)
        self.assertEqual(data["name"], "Alpha")

    def test_entity_update_rejects_invalid_values(self):
        for body in ({"name": ""}, {"confidence": 101}, {"confidence": -5}):
            resp = self.client.put(f"/api/entities/{self.eid}", json=body)
            self.assertEqual(resp.status_code, 422, body)
        self.assertEqual(self.client.get(f"/api/entities/{self.eid}").json()["data"]["name"], "Alpha")

    def test_entity_update_cannot_change_id(self):
        self.client.put(f"/api/entities/{self.eid}", json={"id": "hijack", "name": "Beta"})
        self.assertEqual(self.client.get(f"/api/entities/{self.eid}").json()["data"]["name"], "Beta")
        self.assertEqual(self.client.get("/api/entities/hijack").status_code, 404)

    def test_entity_update_missing_is_404(self):
        self.assertEqual(self.client.put("/api/entities/nope", json={"name": "x"}).status_code, 404)

    def test_mission_update_and_validation(self):
        ok = self.client.put(f"/api/missions/{self.mid}", json={"status": "complete"})
        self.assertEqual(ok.json()["data"]["status"], "complete")
        self.assertEqual(ok.json()["data"]["name"], "Recon")
        bad = self.client.put(f"/api/missions/{self.mid}", json={"name": ""})
        self.assertEqual(bad.status_code, 422)
        self.assertEqual(self.client.put("/api/missions/nope", json={"name": "x"}).status_code, 404)

    def test_mission_entity_linking(self):
        url = f"/api/missions/{self.mid}/entities"
        self.assertLess(self.client.post(url, json={"entity_id": self.eid}).status_code, 300)
        self.assertEqual(self.client.post(url, json={"entity_id": self.eid}).status_code, 409)
        self.assertEqual(self.client.post(url, json={"entity_id": "nope"}).status_code, 404)
        self.assertEqual(
            self.client.post("/api/missions/nope/entities", json={"entity_id": self.eid}).status_code, 404
        )
        got = self.client.get(f"/api/missions/{self.mid}").json()["data"]
        self.assertEqual(len(got["entities"]), 1)
        self.assertEqual(self.client.delete(f"{url}/{self.eid}").status_code, 200)

    def test_required_update_fields_reject_explicit_null(self):
        cases = (
            (f"/api/entities/{self.eid}", ("name", "type", "properties", "confidence", "source", "tags", "threatLevel")),
            (f"/api/missions/{self.mid}", ("name", "description", "status", "tags")),
        )
        for url, fields in cases:
            original = self.client.get(url).json()["data"]
            for field in fields:
                with self.subTest(url=url, field=field):
                    response = self.client.put(url, json={field: None})
                    self.assertEqual(response.status_code, 422)
                    self.assertEqual(self.client.get(url).json()["data"], original)

    def test_nullable_update_fields_can_still_be_cleared(self):
        entity_url = f"/api/entities/{self.eid}"
        self.client.put(entity_url, json={"coordinates": [20.3, 85.8]})
        response = self.client.put(entity_url, json={"coordinates": None})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["data"]["coordinates"])

        mission_url = f"/api/missions/{self.mid}"
        map_fields = {"center_lat": 20.3, "center_lng": 85.8, "zoom_level": 12}
        self.client.put(mission_url, json=map_fields)
        response = self.client.put(mission_url, json=dict.fromkeys(map_fields))
        self.assertEqual(response.status_code, 200)
        for field in map_fields:
            self.assertIsNone(response.json()["data"][field])

    def test_failed_entity_delete_restores_relationships_and_events(self):
        import sqlite3

        other = entity_store.create_entity({"name": "Other"})
        entity_store.add_relationship(self.eid, other["id"], "observed_with")
        before_events = entity_store.get_timeline()
        before_edges = entity_store.relationships
        conn = database.get_connection()
        conn.execute("""CREATE TRIGGER reject_entity_delete BEFORE DELETE ON entities
                        BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END""")
        conn.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            entity_store.delete_entity(self.eid)
        self.assertFalse(conn.in_transaction)
        # An unrelated commit must not make a partial deletion permanent.
        mission_store.add_note(self.mid, "Unrelated write")
        self.assertIsNotNone(entity_store.get_entity(self.eid))
        self.assertEqual(entity_store.relationships, before_edges)
        self.assertEqual(entity_store.get_timeline(), before_events)
        conn.execute("DROP TRIGGER reject_entity_delete")
        conn.commit()
        self.assertTrue(entity_store.delete_entity(self.eid))
        self.assertFalse(entity_store.relationships)

    def test_failed_mission_delete_restores_all_children(self):
        import sqlite3

        mission_store.add_entity_to_mission(self.mid, self.eid)
        note = mission_store.add_note(self.mid, "Keep this")
        detection = mission_store.add_detection(self.mid, {"source_name": "test", "model": "test"})
        conn = database.get_connection()
        conn.execute("""CREATE TRIGGER reject_mission_delete BEFORE DELETE ON missions
                        BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END""")
        conn.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            mission_store.delete_mission(self.mid)
        self.assertFalse(conn.in_transaction)
        entity_store.add_event({"description": "Unrelated write"})
        self.assertIsNotNone(mission_store.get_mission(self.mid))
        self.assertEqual(mission_store.get_notes(self.mid), [note])
        self.assertEqual(mission_store.get_detections(self.mid), [detection])
        self.assertEqual(len(mission_store.get_mission_entities(self.mid)), 1)
        conn.execute("DROP TRIGGER reject_mission_delete")
        conn.commit()
        self.assertTrue(mission_store.delete_mission(self.mid))
        self.assertEqual(mission_store.get_notes(self.mid), [])
        self.assertEqual(mission_store.get_detections(self.mid), [])
        self.assertEqual(mission_store.get_mission_entities(self.mid), [])

    def test_relationship_requires_both_entities_and_recovers(self):
        for source, target in ((self.eid, "missing"), ("missing", self.eid), ("missing", "also-missing")):
            with self.subTest(source=source, target=target):
                response = self.client.post(f"/api/entities/{source}/relate", json={
                    "to_entity": target, "type": "observed_with"
                })
                self.assertEqual(response.status_code, 404)
                self.assertEqual(entity_store.relationships, [])
        other = self.client.post("/api/entities", json={"name": "Bravo"}).json()["data"]["id"]
        response = self.client.post(f"/api/entities/{self.eid}/relate", json={
            "to_entity": other, "type": "observed_with"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(entity_store.relationships), 1)

    def test_relationship_store_error_returns_500(self):
        from unittest.mock import patch

        with patch.object(entity_store, "add_relationship", side_effect=RuntimeError("private error")):
            response = self.client.post(f"/api/entities/{self.eid}/relate", json={
                "to_entity": self.eid, "type": "test"
            })
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private error", response.text)

    def test_duplicate_relationship_returns_stored_confidence(self):
        other = self.client.post("/api/entities", json={"name": "Bravo"}).json()["data"]["id"]
        url = f"/api/entities/{self.eid}/relate"
        payload = {"to_entity": other, "type": "observed_with", "confidence": 25}
        first = self.client.post(url, json=payload)
        self.assertEqual(first.status_code, 200)
        duplicate = self.client.post(url, json={**payload, "confidence": 95})
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(duplicate.json()["data"], first.json()["data"])
        graph = self.client.get(f"/api/entities/{self.eid}/graph").json()["data"]
        self.assertEqual(graph["edges"], [first.json()["data"]])
        self.assertEqual(graph["edges"][0]["confidence"], 25)

    def test_note_delete_is_scoped_to_mission(self):
        other = self.client.post("/api/missions", json={"name": "Other"}).json()["data"]["id"]
        note = self.client.post(
            f"/api/missions/{self.mid}/notes", json={"content": "Keep this note"}
        ).json()["data"]
        original = mission_store.get_mission(self.mid)["updated_at"]
        other_original = mission_store.get_mission(other)["updated_at"]
        for wrong_mission in (other, "missing-mission"):
            response = self.client.delete(f"/api/missions/{wrong_mission}/notes/{note['id']}")
            self.assertEqual(response.status_code, 404)
            self.assertEqual(mission_store.get_notes(self.mid), [note])
            self.assertEqual(mission_store.get_mission(self.mid)["updated_at"], original)
            self.assertEqual(mission_store.get_mission(other)["updated_at"], other_original)

        url = f"/api/missions/{self.mid}/notes/{note['id']}"
        self.assertEqual(self.client.delete(url).status_code, 200)
        self.assertEqual(mission_store.get_notes(self.mid), [])
        self.assertEqual(self.client.delete(url).status_code, 404)


if __name__ == "__main__":
    unittest.main()
