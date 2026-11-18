import asyncio
import os
import threading
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

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

    def test_shodan_invalid_live_positions_are_missing_in_raw_search(self):
        from connectors import ShodanConnector
        from unittest.mock import Mock

        live = ShodanConnector(api_key="test-key")
        for lat, lon in ((float("nan"), 1), (1, float("inf")), (True, 1),
                         (91, 1), (1, -181), ("20.5", 80), (None, 1)):
            upstream = Mock(status_code=200)
            upstream.json.return_value = {"matches": [
                {"ip_str": "192.0.2.1", "location": {"latitude": lat, "longitude": lon}},
                {"ip_str": "192.0.2.2", "location": {"latitude": 0, "longitude": 0}},
            ]}
            with self.subTest(lat=lat, lon=lon), \
                    patch.object(connector_routes, "shodan", live), \
                    patch("connectors.requests.get", return_value=upstream):
                response = self.client.get("/api/connectors/shodan")
                self.assertEqual(response.status_code, 200)
                rows = response.json()["data"]
                self.assertEqual(len(rows), 2)
                self.assertIsNone(rows[0]["lat"])
                self.assertIsNone(rows[0]["lon"])
                self.assertEqual((rows[1]["lat"], rows[1]["lon"]), (0, 0))

    def test_status_reports_both_connectors(self):
        body = self.client.get("/api/connectors/status").json()
        self.assertTrue(body["success"])
        self.assertTrue(body["data"]["opensky"]["available"])
        self.assertIn(body["data"]["shodan"]["mode"], ("live", "mock"))

    def test_slow_upstream_does_not_block_other_api_requests(self):
        cases = (
            ("get", "/api/connectors/adsb", connector_routes.opensky, "fetch_aircraft"),
            ("get", "/api/connectors/adsb/entities", connector_routes.opensky, "fetch_aircraft"),
            ("post", "/api/connectors/adsb/ingest", connector_routes.opensky, "fetch_aircraft"),
            ("get", "/api/connectors/shodan", connector_routes.shodan, "search"),
            ("get", "/api/connectors/shodan/entities", connector_routes.shodan, "search"),
            ("post", "/api/connectors/shodan/ingest", connector_routes.shodan, "search"),
        )
        for method, path, connector, name in cases:
            with self.subTest(path=path):
                entered, release, finished = threading.Event(), threading.Event(), threading.Event()

                def slow(*args, **kwargs):
                    entered.set()
                    try:
                        release.wait(3)
                        return []
                    finally:
                        finished.set()

                async def exercise():
                    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
                        pending = asyncio.create_task(getattr(client, method)(path))
                        try:
                            self.assertTrue(await asyncio.to_thread(entered.wait, 2))
                            status = await client.get("/api/connectors/status")
                            self.assertEqual(status.status_code, 200)
                            self.assertFalse(finished.is_set(), "Upstream request blocked the server event loop")
                        finally:
                            release.set()
                            response = await pending
                        self.assertTrue(response.json()["success"])
                with patch.object(connector, name, side_effect=slow):
                    asyncio.run(exercise())

    def test_adsb_passes_bbox_and_reports_count(self):
        with patch.object(connector_routes.opensky, "fetch_aircraft", return_value=[{"icao24": "a"}, {"icao24": "b"}]) as fetch:
            body = self.client.get(
                "/api/connectors/adsb",
                params={"lat_min": 1, "lon_min": 2, "lat_max": 3, "lon_max": 4},
            ).json()
        fetch.assert_called_once_with(bbox=[1.0, 2.0, 3.0, 4.0])
        self.assertEqual(body["metadata"], {"count": 2, "source": "OpenSky"})

    def test_invalid_adsb_bounds_are_rejected_before_upstream_calls(self):
        cases = [{"lat_min": -91}, {"lat_max": 91}, {"lon_min": -181}, {"lon_max": 181},
                 {"lat_min": "nan"}, {"lon_max": "inf"},
                 {"lat_min": 40, "lat_max": 30}, {"lon_min": 20, "lon_max": 10}]
        with patch.object(connector_routes.opensky, "fetch_aircraft") as fetch:
            for method, path in (("get", "/api/connectors/adsb"), ("post", "/api/connectors/adsb/ingest")):
                for params in cases:
                    with self.subTest(path=path, params=params):
                        self.assertEqual(getattr(self.client, method)(path, params=params).status_code, 422)
            fetch.assert_not_called()

    def test_adsb_world_boundary_is_valid(self):
        params = {"lat_min": -90, "lon_min": -180, "lat_max": 90, "lon_max": 180}
        with patch.object(connector_routes.opensky, "fetch_aircraft", return_value=[]) as fetch:
            self.assertTrue(self.client.get("/api/connectors/adsb", params=params).json()["success"])
        fetch.assert_called_once_with(bbox=[-90.0, -180.0, 90.0, 180.0])

    def test_adsb_failure_hides_internal_error_details(self):
        with patch.object(connector_routes.opensky, "fetch_aircraft", side_effect=RuntimeError("secret detail")):
            body = self.client.get("/api/connectors/adsb").json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"], "Internal server error")
        self.assertNotIn("secret", str(body))

    def test_failed_refresh_never_serves_or_ingests_expired_aircraft(self):
        from connectors import OpenSkyConnector
        from unittest.mock import Mock

        row = ["abc123", "TEST", "Test country", None, 1700000000,
               -122.4, 37.5, 1000, False, 100, 90, 0, None, None]
        successful = Mock(status_code=200)
        successful.json.return_value = {"states": [row]}
        unavailable = Mock(status_code=503)

        for method, path, bbox in (
            ("get", "/api/connectors/adsb", [37.0, -123.0, 38.0, -122.0]),
            ("get", "/api/connectors/adsb/entities", None),
            ("post", "/api/connectors/adsb/ingest", [37.0, -123.0, 38.0, -122.0]),
        ):
            connector = OpenSkyConnector()
            with patch("connectors.requests.get", return_value=successful):
                connector.fetch_aircraft(bbox)
            connector._cache_time = None
            with self.subTest(path=path), patch.object(connector_routes, "opensky", connector), \
                    patch("connectors.requests.get", return_value=unavailable), \
                    patch.object(entity_store, "upsert_entity") as upsert:
                body = getattr(self.client, method)(path).json()
                self.assertFalse(body["success"])
                self.assertNotIn("data", body)
                upsert.assert_not_called()
                self.assertEqual(len(connector.cache), 1)

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
