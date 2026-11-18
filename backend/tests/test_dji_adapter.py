"""DJI bridge contract tests. No network or hardware connections."""
import unittest
from unittest.mock import Mock

import requests

from dji_adapter import DJIDrone


class TestDJIBridge(unittest.TestCase):
    def test_every_bridge_read_has_timeout_and_checks_http_status(self):
        adapter = DJIDrone("http://bridge.invalid")
        replies = [Mock() for _ in range(4)]
        for reply in replies:
            reply.json.return_value = {}
        adapter.session.get = Mock(side_effect=replies)
        telemetry = adapter.get_telemetry()
        self.assertEqual(telemetry["flight_mode"], "UNKNOWN")
        self.assertEqual(adapter.session.get.call_count, 4)
        for call, reply in zip(adapter.session.get.call_args_list, replies):
            self.assertEqual(call.kwargs.get("timeout"), (3.05, 5))
            reply.raise_for_status.assert_called_once_with()
            reply.json.assert_called_once_with()

    def test_failed_http_status_is_not_parsed_as_successful_telemetry(self):
        adapter = DJIDrone("http://bridge.invalid")
        reply = Mock()
        reply.raise_for_status.side_effect = requests.HTTPError("fixture unavailable")
        reply.json.return_value = {"altitude": 120, "yaw": 20}
        adapter.session.get = Mock(return_value=reply)
        telemetry = adapter.get_telemetry()
        self.assertEqual(telemetry["status"], "DISCONNECTED")
        reply.json.assert_not_called()
        self.assertEqual(adapter.session.get.call_count, 1)

    def test_timeout_returns_disconnected_without_more_requests(self):
        adapter = DJIDrone("http://bridge.invalid")
        adapter.session.get = Mock(side_effect=requests.Timeout("fixture timeout"))
        self.assertEqual(adapter.get_telemetry()["status"], "DISCONNECTED")
        self.assertEqual(adapter.session.get.call_count, 1)

    def test_missing_and_failed_readings_are_unknown_not_zero_or_disarmed(self):
        adapter = DJIDrone()
        for failed in (False, True):
            with self.subTest(failed=failed):
                reply = Mock()
                reply.json.return_value = {}
                adapter.session.get = Mock(return_value=reply, side_effect=requests.Timeout() if failed else None)
                row = adapter.get_telemetry()
                for field in ("altitude", "battery_voltage", "signal_strength", "ground_speed", "armed"):
                    self.assertIsNone(row[field], field)
                self.assertEqual(row["attitude"], {"roll": None, "pitch": None, "yaw": None})
                self.assertEqual(row["gps"], {"satellites": None, "latitude": None, "longitude": None, "altitude": None})

    def test_genuine_zero_readings_and_disarmed_state_are_preserved(self):
        adapter = DJIDrone()
        payloads = [{"roll": 0, "pitch": 0, "yaw": 0}, {"voltage": 0},
                    {"latitude": 0, "longitude": 0, "altitude": 0, "satellite_count": 0, "speed": 0},
                    {"signal_strength": 0, "motors_on": False, "flight_mode": "HOLD"}]
        replies = [Mock() for _ in payloads]
        for reply, payload in zip(replies, payloads):
            reply.json.return_value = payload
        adapter.session.get = Mock(side_effect=replies)
        row = adapter.get_telemetry()
        for field in ("altitude", "battery_voltage", "signal_strength", "ground_speed"):
            self.assertEqual(row[field], 0)
        self.assertIs(row["armed"], False)
        self.assertEqual(row["gps"]["latitude"], 0)
        self.assertEqual(row["gps"]["longitude"], 0)
        self.assertEqual(row["attitude"]["yaw"], 0)

    def test_invalid_readings_are_missing_and_position_pair_is_not_partial(self):
        adapter = DJIDrone()
        for bad in (True, "20", float("nan"), float("inf"), [], {}):
            replies = [Mock() for _ in range(4)]
            payloads = [{"roll": bad, "pitch": bad, "yaw": bad}, {"voltage": bad},
                        {"latitude": bad, "longitude": 30, "altitude": bad, "satellite_count": bad, "speed": bad},
                        {"signal_strength": bad, "motors_on": bad}]
            for reply, payload in zip(replies, payloads):
                reply.json.return_value = payload
            adapter.session.get = Mock(side_effect=replies)
            with self.subTest(bad=repr(bad)):
                row = adapter.get_telemetry()
                self.assertIsNone(row["gps"]["latitude"])
                self.assertIsNone(row["gps"]["longitude"])
                for field in ("altitude", "battery_voltage", "signal_strength", "ground_speed"):
                    self.assertIsNone(row[field], field)
                self.assertIs(row["armed"], True if bad is True else None)
                self.assertTrue(all(value is None for value in row["attitude"].values()))

    def test_bounded_numeric_fields_reject_out_of_range_values(self):
        self.assertIsNone(DJIDrone._number(-1, 0))
        self.assertIsNone(DJIDrone._number(101, 0, 100))
        self.assertEqual(DJIDrone._number(-90, -90, 90), -90)
        self.assertEqual(DJIDrone._number(180, -180, 180), 180)

    def test_malformed_bridge_containers_return_disconnected(self):
        for body in (None, [], "invalid", 42):
            adapter = DJIDrone()
            reply = Mock()
            reply.json.return_value = body
            adapter.session.get = Mock(return_value=reply)
            with self.subTest(body=body):
                row = adapter.get_telemetry()
                self.assertEqual(row["status"], "DISCONNECTED")
                self.assertIsNone(row["gps"]["latitude"])
                self.assertIsNone(row["armed"])
