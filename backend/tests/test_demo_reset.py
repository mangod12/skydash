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

    def test_failed_entity_reset_rolls_back_deleted_events_and_relationships(self):
        import sqlite3

        extra = entity_store.create_entity({"name": "Preserve contact"})["id"]
        entity_store.add_relationship(extra, "ent-001", "associated_with")
        before_entities = entity_store.list_entities()
        before_relationships = entity_store.relationships
        before_events = entity_store.get_timeline(limit=1000)
        conn = database.get_connection()
        conn.execute("""CREATE TRIGGER reject_entity_reset BEFORE DELETE ON entities
                        BEGIN SELECT RAISE(ABORT, 'synthetic reset failure'); END""")
        conn.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            entity_store.reset_demo()
        self.assertFalse(conn.in_transaction)
        conn.execute("DROP TRIGGER reject_entity_reset")
        conn.commit()
        self.assertEqual(entity_store.list_entities(), before_entities)
        self.assertEqual(entity_store.relationships, before_relationships)
        self.assertEqual(entity_store.get_timeline(limit=1000), before_events)
        entity_store.reset_demo()
        self.assertEqual(entity_store.count(), 8)
        self.assertIsNone(entity_store.get_entity(extra))
        self.assertFalse(conn.in_transaction)

    def test_commander_only(self):
        self.assertEqual(required_role("POST", "/api/demo/reset"), "commander")


if __name__ == "__main__":
    unittest.main()
