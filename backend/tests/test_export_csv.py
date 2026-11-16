import os
import shutil
import tempfile
import unittest

from fastapi.testclient import TestClient

import database
from deps import entity_store
import main


class TestEntitiesCsvExport(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-export-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        self.client = TestClient(main.app)

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_export_entity_without_coordinates(self):
        self.client.post("/api/entities", json={"name": "NoCoords"})
        resp = self.client.get("/api/export/entities/csv")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp.headers["content-type"])
        self.assertIn("NoCoords", resp.text)

    def test_export_entity_with_coordinates(self):
        self.client.post(
            "/api/entities", json={"name": "Pinned", "coordinates": [20.3, 85.8]}
        )
        resp = self.client.get("/api/export/entities/csv")
        self.assertIn("20.3,85.8", resp.text)


if __name__ == "__main__":
    unittest.main()
