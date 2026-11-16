import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import database
from deps import entity_store
import main
from routes import connectors as connector_routes


def aircraft_entity(entity_id):
    return {
        "id": entity_id,
        "name": "TEST FLIGHT",
        "type": "aircraft",
        "coordinates": [37.5, -122.4],
        "threatLevel": "low",
    }


class TestConnectorRoutes(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-connectors-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        self.client = TestClient(main.app)
        self.created = []

    def tearDown(self):
        for entity_id in self.created:
            entity_store.entities.pop(entity_id, None)
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_status_reports_both_connectors(self):
        body = self.client.get("/api/connectors/status").json()
        self.assertTrue(body["success"])
        self.assertTrue(body["data"]["opensky"]["available"])
        self.assertIn(body["data"]["shodan"]["mode"], ("live", "mock"))

    def test_adsb_passes_bbox_and_reports_count(self):
        with patch.object(connector_routes.opensky, "fetch_aircraft", return_value=[{"icao24": "a"}, {"icao24": "b"}]) as fetch:
            body = self.client.get(
                "/api/connectors/adsb",
                params={"lat_min": 1, "lon_min": 2, "lat_max": 3, "lon_max": 4},
            ).json()
        fetch.assert_called_once_with(bbox=[1.0, 2.0, 3.0, 4.0])
        self.assertEqual(body["metadata"], {"count": 2, "source": "OpenSky"})

    def test_adsb_failure_hides_internal_error_details(self):
        with patch.object(connector_routes.opensky, "fetch_aircraft", side_effect=RuntimeError("secret detail")):
            body = self.client.get("/api/connectors/adsb").json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"], "Internal server error")
        self.assertNotIn("secret", str(body))

    def test_adsb_entities_converts_aircraft(self):
        with patch.object(connector_routes.opensky, "fetch_aircraft", return_value=[]), \
             patch.object(connector_routes.opensky, "to_entities", return_value=[aircraft_entity("adsb-test-1")]):
            body = self.client.get("/api/connectors/adsb/entities").json()
        self.assertEqual(body["data"][0]["id"], "adsb-test-1")

    def test_adsb_ingest_dry_run_does_not_store(self):
        with patch.object(connector_routes.opensky, "fetch_aircraft", return_value=[]), \
             patch.object(connector_routes.opensky, "to_entities", return_value=[aircraft_entity("adsb-test-2")]):
            body = self.client.post("/api/connectors/adsb/ingest", params={"dry_run": True}).json()
        self.assertEqual(body["metadata"]["mode"], "preview")
        self.assertEqual(body["metadata"]["created"], 0)
        self.assertNotIn("adsb-test-2", entity_store.entities)

    def test_adsb_ingest_creates_then_updates(self):
        self.created.append("adsb-test-3")
        patches = (
            patch.object(connector_routes.opensky, "fetch_aircraft", return_value=[]),
            patch.object(connector_routes.opensky, "to_entities", return_value=[aircraft_entity("adsb-test-3")]),
        )
        with patches[0], patches[1]:
            first = self.client.post("/api/connectors/adsb/ingest").json()
            second = self.client.post("/api/connectors/adsb/ingest").json()
        self.assertEqual((first["metadata"]["created"], first["metadata"]["updated"]), (1, 0))
        self.assertEqual((second["metadata"]["created"], second["metadata"]["updated"]), (0, 1))
        self.assertIn("adsb-test-3", entity_store.entities)

    def test_shodan_mock_mode_without_key(self):
        with patch.object(connector_routes.shodan, "api_key", None), \
             patch.object(connector_routes.shodan, "available", False):
            body = self.client.get("/api/connectors/shodan", params={"query": "camera", "limit": 3}).json()
        self.assertTrue(body["success"])
        self.assertEqual(body["metadata"]["source"], "Mock")
        self.assertLessEqual(body["metadata"]["count"], 3)

    def test_shodan_limit_is_validated(self):
        self.assertEqual(self.client.get("/api/connectors/shodan", params={"limit": 0}).status_code, 422)
        self.assertEqual(self.client.get("/api/connectors/shodan", params={"limit": 51}).status_code, 422)

    def test_shodan_ingest_dry_run_and_import(self):
        with patch.object(connector_routes.shodan, "api_key", None), \
             patch.object(connector_routes.shodan, "available", False):
            before = set(entity_store.entities)
            preview = self.client.post("/api/connectors/shodan/ingest", params={"dry_run": True, "limit": 2}).json()
            self.assertEqual(set(entity_store.entities), before)
            self.assertEqual(preview["metadata"]["mode"], "preview")
            imported = self.client.post("/api/connectors/shodan/ingest", params={"limit": 2}).json()
            self.created.extend(set(entity_store.entities) - before)
        self.assertEqual(imported["metadata"]["mode"], "import")
        self.assertEqual(imported["metadata"]["created"] + imported["metadata"]["updated"], imported["metadata"]["count"])


if __name__ == "__main__":
    unittest.main()
