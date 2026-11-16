import csv
import io
import os
import shutil
import tempfile
import unittest

from fastapi.testclient import TestClient

import database
from deps import entity_store, telemetry_history
import main


def snapshot(ts, drone_ids):
    return {
        "timestamp": ts,
        "drones": [
            {
                "drone_id": d,
                "gps": {"lat": 37.1, "lng": -122.1, "satellites": 11, "hdop": 0.9},
                "attitude": {"roll": 1, "pitch": 2, "yaw": 3},
                "wind": {"speed": 4, "direction": 90},
                "altitude": 80,
                "battery_voltage": 15.5,
                "battery_percentage": 88,
                "ground_speed": 7,
                "signal_strength": 95,
            }
            for d in drone_ids
        ],
    }


class TestExportRoutes(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-export-routes-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        self.client = TestClient(main.app)
        telemetry_history.clear()

    def tearDown(self):
        telemetry_history.clear()
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def rows(self, response):
        return list(csv.reader(io.StringIO(response.text)))

    def test_geojson_swaps_to_lng_lat_and_skips_entities_without_coordinates(self):
        self.client.post("/api/entities", json={"name": "Pinned", "coordinates": [20.5, 85.5]})
        self.client.post("/api/entities", json={"name": "Floating"})
        body = self.client.post("/api/export/geojson").json()
        self.assertEqual(body["type"], "FeatureCollection")
        pinned = [f for f in body["features"] if f["properties"]["name"] == "Pinned"]
        self.assertEqual(len(pinned), 1)
        self.assertEqual(pinned[0]["geometry"]["coordinates"], [85.5, 20.5])
        self.assertFalse([f for f in body["features"] if f["properties"]["name"] == "Floating"])

    def test_telemetry_csv_without_history_reports_no_data(self):
        body = self.client.get("/api/export/telemetry/csv").json()
        self.assertFalse(body["success"])
        self.assertIn("No telemetry", body["error"])

    def test_telemetry_csv_rows_and_headers(self):
        telemetry_history.append(snapshot(1000, ["D1", "D2"]))
        resp = self.client.get("/api/export/telemetry/csv")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp.headers["content-type"])
        self.assertIn("attachment; filename=skydash_telemetry_", resp.headers["content-disposition"])
        rows = self.rows(resp)
        self.assertEqual(rows[0][:3], ["timestamp", "drone_id", "latitude"])
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1][:5], ["1000", "D1", "37.1", "-122.1", "80"])

    def test_telemetry_csv_filters_by_drone_and_limits_snapshots(self):
        for ts in (1, 2, 3):
            telemetry_history.append(snapshot(ts, ["D1", "D2"]))
        rows = self.rows(self.client.get("/api/export/telemetry/csv", params={"drone_id": "D2", "limit": 2}))
        self.assertEqual([r[:2] for r in rows[1:]], [["2", "D2"], ["3", "D2"]])

    def test_telemetry_csv_validates_limit(self):
        self.assertEqual(self.client.get("/api/export/telemetry/csv", params={"limit": 0}).status_code, 422)
        self.assertEqual(self.client.get("/api/export/telemetry/csv", params={"limit": 1001}).status_code, 422)

    def test_entities_csv_joins_tags(self):
        self.client.post("/api/entities", json={"name": "Tagged", "tags": ["a", "b"], "coordinates": [1.5, 2.5]})
        rows = self.rows(self.client.get("/api/export/entities/csv"))
        self.assertEqual(rows[0][:3], ["id", "name", "type"])
        tagged = [r for r in rows[1:] if r[1] == "Tagged"][0]
        self.assertEqual((tagged[5], tagged[6], tagged[7]), ("1.5", "2.5", "a, b"))


if __name__ == "__main__":
    unittest.main()
