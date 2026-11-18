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
