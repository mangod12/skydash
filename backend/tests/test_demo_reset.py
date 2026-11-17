import os
import shutil
import tempfile
import unittest

from fastapi.testclient import TestClient

import database
from deps import entity_store, mission_store
import main
from rbac import required_role


class TestDemoReset(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-demo-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        entity_store._seed()
        self.client = TestClient(main.app)

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_requires_confirm(self):
        r = self.client.post("/api/demo/reset", json={})
        self.assertEqual(r.status_code, 400)

    def test_reset_restores_seed_and_clears_missions(self):
        entity_store.create_entity({"id": "extra-1", "type": "device", "name": "Extra", "coordinates": [1, 1]})
        self.client.post("/api/missions", json={"name": "Op Test"})
        self.assertIsNotNone(entity_store.get_entity("extra-1"))
        r = self.client.post("/api/demo/reset", json={"confirm": True})
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(entity_store.get_entity("extra-1"))
        self.assertIsNotNone(entity_store.get_entity("ent-001"))
        self.assertEqual(self.client.get("/api/missions").json()["data"], [])

    def test_commander_only(self):
        self.assertEqual(required_role("POST", "/api/demo/reset"), "commander")


if __name__ == "__main__":
    unittest.main()
