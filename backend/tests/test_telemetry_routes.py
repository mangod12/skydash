import time
import unittest

from fastapi.testclient import TestClient

from deps import fleet, telemetry_history
import main


class TestTelemetryRoutes(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        telemetry_history.clear()
        for _ in range(3):
            telemetry_history.append(
                {"timestamp": time.time(), "drones": fleet.get_all_telemetry()}
            )
        self.drone_id = fleet.get_all_telemetry()[0]["drone_id"]

    def tearDown(self):
        telemetry_history.clear()

    def test_single_drone_found_and_missing(self):
        ok = self.client.get(f"/telemetry/{self.drone_id}")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["data"]["drone_id"], self.drone_id)
        self.assertEqual(self.client.get("/telemetry/NOPE").status_code, 404)

    def test_history_for_one_drone_with_field(self):
        resp = self.client.get(
            "/api/telemetry/history",
            params={"drone_id": self.drone_id, "field": "altitude", "limit": 2},
        )
        body = resp.json()
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(body["metadata"]["count"], 2)
        self.assertIn("value", body["data"][0])

    def test_history_rejects_unknown_field_and_bad_limit(self):
        self.assertEqual(
            self.client.get("/api/telemetry/history", params={"field": "bogus"}).status_code, 400
        )
        self.assertEqual(
            self.client.get("/api/telemetry/history", params={"limit": 0}).status_code, 422
        )

    def test_history_all_drones(self):
        body = self.client.get("/api/telemetry/history").json()
        self.assertTrue(body["success"])
        self.assertEqual(body["metadata"]["count"], 3)

    def test_stats_empty_and_filled(self):
        telemetry_history.clear()
        self.assertEqual(self.client.get("/api/telemetry/stats").json()["data"], {})
        telemetry_history.append({"timestamp": time.time(), "drones": fleet.get_all_telemetry()})
        data = self.client.get("/api/telemetry/stats").json()["data"]
        self.assertEqual(data["active_drones"], 3)
        self.assertEqual(data["total_samples"], 1)

    def test_command_unknown_drone_is_404(self):
        resp = self.client.post("/api/drone/NOPE/command", json={"command": "hold"})
        self.assertEqual(resp.status_code, 404)

    def test_command_confirmed_for_known_drone(self):
        resp = self.client.post(
            f"/api/drone/{self.drone_id}/command",
            json={"command": "set_mode", "params": {"mode": "HOLD"}},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["ack"], "confirmed")

    def test_command_rejects_unsupported_command(self):
        resp = self.client.post(
            f"/api/drone/{self.drone_id}/command", json={"command": "self_destruct"}
        )
        self.assertEqual(resp.status_code, 400)

    def test_websocket_failure_closes_and_allows_reconnect(self):
        from unittest.mock import patch
        from starlette.websockets import WebSocketDisconnect
        from routes import telemetry

        for failure in (RuntimeError("private adapter failure"), ValueError("nonfinite payload")):
            with self.subTest(failure=type(failure).__name__), \
                    patch.object(telemetry, "AUTH_ENABLED", False), \
                    patch.object(telemetry, "API_KEY", ""), \
                    patch.object(fleet, "get_all_telemetry", side_effect=failure):
                with self.client.websocket_connect("/ws/telemetry") as ws:
                    with self.assertRaises(WebSocketDisconnect) as cm:
                        ws.receive_json()
                    self.assertEqual(cm.exception.code, 1011)
                    self.assertEqual(cm.exception.reason, "Telemetry unavailable")
        with patch.object(telemetry, "AUTH_ENABLED", False), patch.object(telemetry, "API_KEY", ""):
            with self.client.websocket_connect("/ws/telemetry") as ws:
                self.assertEqual(ws.receive_json()["type"], "telemetry")

    def test_reset_clears_prior_session_history_and_stats(self):
        self.assertTrue(telemetry_history)
        self.assertTrue(self.client.post("/reset").json()["success"])
        self.assertFalse(telemetry_history)
        self.assertEqual(self.client.get("/api/telemetry/history").json()["data"], [])
        self.assertEqual(self.client.get("/api/telemetry/stats").json()["data"], {})
        self.assertFalse(self.client.get("/api/export/telemetry/csv").json()["success"])
        # Fresh samples still appear after reset rather than being mixed with old ones.
        telemetry_history.append({"timestamp": 12345, "drones": fleet.get_all_telemetry()})
        history = self.client.get("/api/telemetry/history").json()
        self.assertEqual(history["metadata"]["count"], 1)
        self.assertEqual(history["data"][0]["timestamp"], 12345)
        self.assertEqual(self.client.get("/api/telemetry/stats").json()["data"]["total_samples"], 1)


if __name__ == "__main__":
    unittest.main()
