import os
import asyncio
import threading
from unittest.mock import patch
import shutil
import tempfile
import unittest

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from routes import demo

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

    def test_slow_database_reset_does_not_block_other_requests(self):
        for target, method in ((demo.mission_store, "_clear_all"), (demo.entity_store, "_reset_demo")):
            entered, release, finished = threading.Event(), threading.Event(), threading.Event()

            def slow(*args):
                entered.set()
                try:
                    release.wait(2)
                finally:
                    finished.set()

            async def exercise():
                async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
                    pending = asyncio.create_task(client.post("/api/demo/reset", json={"confirm": True}))
                    try:
                        self.assertTrue(await asyncio.to_thread(entered.wait, 1))
                        self.assertEqual((await client.get("/")).status_code, 200)
                        self.assertFalse(finished.is_set(), "Demo database reset blocked event loop")
                    finally:
                        release.set()
                        response = await pending
                    self.assertTrue(response.json()["success"])

            with self.subTest(method=method), patch.object(target, method, side_effect=slow):
                asyncio.run(exercise())

    def test_requires_confirm(self):
        r = self.client.post("/api/demo/reset", json={})
        self.assertEqual(r.status_code, 400)

    def test_confirmation_requires_literal_true_before_any_reset(self):
        from unittest.mock import patch
        from routes import demo

        for value in ("true", "yes", "on", "1", 1, 1.0, [], {}, None):
            with self.subTest(value=value), \
                    patch.object(demo.mission_store, "clear_all") as clear, \
                    patch.object(demo.entity_store, "reset_demo") as reset, \
                    patch.object(demo.fleet, "reset") as fleet_reset:
                response = self.client.post("/api/demo/reset", json={"confirm": value})
                self.assertEqual(response.status_code, 422)
                clear.assert_not_called()
                reset.assert_not_called()
                fleet_reset.assert_not_called()

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

    def test_seed_failure_restores_previous_entity_data_and_mission_links(self):
        import sqlite3
        extra = entity_store.create_entity({"name": "Keep on failed reset"})["id"]
        entity_store.add_relationship(extra, "ent-001", "associated_with")
        mission = mission_store.create_mission({"name": "Keep links"})["id"]
        mission_store.add_entity_to_mission(mission, extra)
        before_entities = entity_store.list_entities()
        before_relationships = entity_store.relationships
        before_events = entity_store.get_timeline(limit=1000)
        conn = database.get_connection()
        conn.execute("""CREATE TRIGGER reject_seed BEFORE INSERT ON entities
                        WHEN NEW.id = 'ent-004'
                        BEGIN SELECT RAISE(ABORT, 'synthetic seed failure'); END""")
        conn.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            entity_store.reset_demo()
        self.assertFalse(conn.in_transaction)
        conn.execute("DROP TRIGGER reject_seed")
        conn.commit()
        entity_store.add_event({"description": "Unrelated later commit"})
        self.assertEqual(entity_store.list_entities(), before_entities)
        self.assertEqual(entity_store.relationships, before_relationships)
        self.assertEqual(entity_store.get_timeline(limit=1000)[1:], before_events)
        self.assertEqual(mission_store.get_mission_entities(mission), [extra])
        entity_store.reset_demo()
        self.assertEqual(entity_store.count(), 8)
        self.assertIsNone(entity_store.get_entity(extra))

    def test_demo_endpoint_seed_failure_preserves_all_stores_and_runtime(self):
        import sqlite3
        entity = entity_store.create_entity({"name": "Preserve contact"})["id"]
        mission = mission_store.create_mission({"name": "Preserve mission"})["id"]
        mission_store.add_entity_to_mission(mission, entity)
        mission_store.add_note(mission, "Preserve note")
        mission_store.add_detection(mission, {"source_name": "fixture", "summary": {"count": 1}})
        conn = database.get_connection()
        tables = ("entities", "relationships", "events", "missions", "mission_entities", "mission_notes", "mission_detections")
        before = {table: [tuple(row) for row in conn.execute(f"SELECT * FROM {table}")] for table in tables}
        conn.execute("""CREATE TRIGGER reject_api_seed BEFORE INSERT ON entities
                        WHEN NEW.id = 'ent-004'
                        BEGIN SELECT RAISE(ABORT, 'synthetic seed failure'); END""")
        conn.commit()
        with patch.object(demo.fleet, "reset") as reset_fleet, \
                patch.object(demo, "telemetry_history") as history:
            client = TestClient(main.app, raise_server_exceptions=False)
            response = client.post("/api/demo/reset", json={"confirm": True})
            self.assertEqual(response.status_code, 500)
            reset_fleet.assert_not_called()
            history.clear.assert_not_called()
        self.assertFalse(conn.in_transaction)
        conn.execute("DROP TRIGGER reject_api_seed")
        conn.commit()
        after = {table: [tuple(row) for row in conn.execute(f"SELECT * FROM {table}")] for table in tables}
        self.assertEqual(after, before)
        self.assertEqual(self.client.post("/api/demo/reset", json={"confirm": True}).status_code, 200)
        self.assertEqual(mission_store.count(), 0)
        self.assertEqual(entity_store.count(), 8)

    def test_commander_only(self):
        self.assertEqual(required_role("POST", "/api/demo/reset"), "commander")


if __name__ == "__main__":
    unittest.main()
