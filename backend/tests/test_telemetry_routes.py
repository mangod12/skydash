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

    def test_live_rest_and_websocket_serialise_nonfinite_values_as_missing(self):
        import json
        from unittest.mock import patch
        from routes import telemetry

        drone = {"drone_id": "D1", "altitude": float("nan"), "ground_speed": 0,
                 "battery_percentage": 80, "gps": {"latitude": float("inf"), "longitude": 0},
                 "attitude": {"yaw": float("-inf")}, "extra": [float("nan"), 0, None]}
        expected = {"drone_id": "D1", "altitude": None, "ground_speed": 0,
                    "battery_percentage": 80, "gps": {"latitude": None, "longitude": 0},
                    "attitude": {"yaw": None}, "extra": [None, 0, None]}

        def strict_json(raw):
            def reject_constant(value):
                raise ValueError("Non-JSON numeric constant: " + value)
            return json.loads(raw, parse_constant=reject_constant)

        with patch.object(fleet, "get_all_telemetry", return_value=[drone]), \
                patch.object(fleet, "get_drone_telemetry", return_value=drone), \
                patch.object(telemetry, "AUTH_ENABLED", False), \
                patch.object(telemetry, "API_KEY", ""):
            for path, value in (("/telemetry", [expected]), ("/telemetry/D1", expected)):
                with self.subTest(path=path):
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(strict_json(response.text)["data"], value)
            with self.client.websocket_connect("/ws/telemetry") as ws:
                self.assertEqual(strict_json(ws.receive_text())["data"], [expected])
        # Serialization must not rewrite the source adapter's nested objects.
        import math
        self.assertTrue(math.isnan(drone["altitude"]))
        self.assertTrue(math.isinf(drone["gps"]["latitude"]))

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

    def test_history_isolates_malformed_samples_and_drone_records(self):
        telemetry_history.clear()
        for value in (None, {}, {"timestamp": "1", "drones": []}, {"timestamp": float("inf"), "drones": []},
                      {"timestamp": 1, "drones": {}}, {"timestamp": 2, "drones": [None, {}, {"drone_id": "D1", "altitude": 10}]}):
            telemetry_history.append(value)
        body = self.client.get("/api/telemetry/history").json()
        self.assertEqual(body["metadata"]["count"], 1)
        self.assertEqual(body["data"][0]["drones"], [{"drone_id": "D1", "altitude": 10}])
        filtered = self.client.get("/api/telemetry/history", params={"drone_id": "D1", "field": "altitude"}).json()
        self.assertEqual(filtered["data"], [{"timestamp": 2, "value": 10}])

    def test_history_serialises_nonfinite_metrics_as_missing_including_nested_fields(self):
        telemetry_history.clear()
        telemetry_history.append({"timestamp": 1, "drones": [{"drone_id": "D1", "altitude": float("nan"), "gps": {"latitude": float("inf")}}]})
        response = self.client.get("/api/telemetry/history")
        self.assertEqual(response.status_code, 200)
        drone = response.json()["data"][0]["drones"][0]
        self.assertIsNone(drone["altitude"])
        self.assertIsNone(drone["gps"]["latitude"])
        response = self.client.get("/api/telemetry/history", params={"drone_id": "D1", "field": "altitude"})
        self.assertIsNone(response.json()["data"][0]["value"])

    def test_stats_average_only_available_finite_metrics_without_treating_missing_as_zero(self):
        telemetry_history.clear()
        telemetry_history.append({"timestamp": 2, "drones": [{"drone_id": "D1", "altitude": 20, "battery_percentage": 80},
                                {"drone_id": "D2", "altitude": None, "battery_percentage": float("nan"), "signal_strength": True},
                                {"drone_id": "D3", "altitude": "50"}, None]})
        data = self.client.get("/api/telemetry/stats").json()["data"]
        self.assertEqual(data["active_drones"], 3)
        self.assertEqual(data["avg_altitude"], 20)
        self.assertEqual(data["avg_battery"], 80)
        self.assertIsNone(data["avg_signal"])
        self.assertEqual(data["total_samples"], 1)

    def test_stats_ignore_invalid_samples_and_do_not_report_negative_duration(self):
        telemetry_history.clear()
        telemetry_history.append(None)
        self.assertEqual(self.client.get("/api/telemetry/stats").json()["data"], {})
        telemetry_history.extend([{"timestamp": 20, "drones": [{"drone_id": "D1"}]}, {"timestamp": 10, "drones": [{"drone_id": "D1"}]}])
        data = self.client.get("/api/telemetry/stats").json()["data"]
        self.assertEqual(data["total_samples"], 2)
        self.assertEqual(data["recording_duration_s"], 0)

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

    def test_invalid_numeric_commands_are_rejected_without_changing_state(self):
        from unittest.mock import patch
        from routes import telemetry
        from simulation import FleetSimulator

        simulated = FleetSimulator()
        drone = simulated.drones["ALPHA-1"]
        cases = [("adjust_altitude", "delta"), ("set_altitude", "value"),
                 ("set_altitude", "altitude"), ("adjust_yaw", "delta"),
                 ("set_speed", "value"), ("set_speed", "speed"),
                 ("set_orbit_radius", "value"), ("set_orbit_radius", "radius")]
        with patch.object(telemetry, "fleet", simulated):
            before = drone.get_command_state()
            for command, key in cases:
                for value in ("nan", "inf", "-inf", "1e999", None, True, [], {}):
                    with self.subTest(command=command, key=key, value=value):
                        response = self.client.post("/api/drone/ALPHA-1/command", json={
                            "command": command, "params": {key: value},
                        })
                        self.assertEqual(response.status_code, 400)
                        self.assertIn("finite number", response.json()["detail"])
                        self.assertEqual(drone.get_command_state(), before)
            self.assertEqual(self.client.get("/telemetry").status_code, 200)
            # Valid zero/numeric strings and clamping remain backward compatible.
            for command, params in (("set_altitude", {"value": 0}),
                                    ("set_speed", {"value": "5.5"}),
                                    ("adjust_yaw", {"delta": -10}),
                                    ("set_orbit_radius", {"radius": 100000})):
                self.assertEqual(self.client.post("/api/drone/ALPHA-1/command", json={
                    "command": command, "params": params,
                }).status_code, 200)
            self.assertEqual(drone.commanded_altitude, 0)
            self.assertEqual(drone.yaw_offset, 350)
            self.assertEqual(drone.get_command_state()["orbit_radius_m"], 3000)

    def test_websocket_api_key_exact_token_acceptance(self):
        from unittest.mock import patch
        from starlette.websockets import WebSocketDisconnect
        from routes import telemetry

        with patch.object(telemetry, "AUTH_ENABLED", False), \
                patch.object(telemetry, "API_KEY", "fixture-api-key"):
            for token in ("", "wrong", "fixture-api-key-extra", "Bearer%20fixture-api-key"):
                with self.subTest(token=token), self.assertRaises(WebSocketDisconnect) as cm:
                    with self.client.websocket_connect("/ws/telemetry?token=" + token):
                        pass
                self.assertEqual(cm.exception.code, 4001)
            with self.client.websocket_connect("/ws/telemetry?token=fixture-api-key") as ws:
                self.assertEqual(ws.receive_json()["type"], "telemetry")

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
