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
