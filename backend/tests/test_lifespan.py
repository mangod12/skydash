import os
import shutil
import tempfile
import time
import unittest

from fastapi.testclient import TestClient

import database
from deps import entity_store, mission_store, telemetry_history
import main


class TestLifespan(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-lifespan-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_recorder_runs_while_app_is_up(self):
        start = time.time()
        with TestClient(main.app) as client:
            time.sleep(1.3)
            self.assertEqual(client.get("/health").status_code, 200)
        self.assertTrue(telemetry_history)
        self.assertGreaterEqual(telemetry_history[-1]["timestamp"], start)

    def test_recorder_recovers_after_transient_fleet_failure(self):
        import asyncio
        from unittest.mock import patch

        telemetry_history.clear()
        calls = []

        def sample():
            calls.append(1)
            if len(calls) == 1:
                raise RuntimeError("synthetic adapter failure")
            return [{"drone_id": "RECOVERED"}]

        async def check():
            async with main.lifespan(main.app):
                deadline = asyncio.get_running_loop().time() + 3
                while not telemetry_history and asyncio.get_running_loop().time() < deadline:
                    await asyncio.sleep(0.02)
                self.assertTrue(telemetry_history)
                self.assertEqual(telemetry_history[0]["drones"], [{"drone_id": "RECOVERED"}])
                self.assertEqual(len(telemetry_history), 1)

        with patch.object(main.fleet, "get_all_telemetry", side_effect=sample), \
                patch.object(main.cot_stream, "parse_target", return_value=None):
            asyncio.run(check())
        call_count = len(calls)
        time.sleep(0.05)
        self.assertEqual(len(calls), call_count)
        telemetry_history.clear()


if __name__ == "__main__":
    unittest.main()
