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


if __name__ == "__main__":
    unittest.main()
