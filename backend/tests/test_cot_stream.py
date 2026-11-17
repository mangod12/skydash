import asyncio
import socket
import unittest
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import cot_stream

NOW = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
ENTITY = {"id": "ent-1", "type": "vehicle", "name": 'Truck "A" <1>', "coordinates": [37.77, -122.41],
          "threatLevel": "high", "confidence": 80}
DRONE = {"drone_id": "ALPHA-1", "status": "ARMED", "battery_percentage": 90, "ground_speed": 5.5,
         "attitude": {"yaw": 180}, "gps": {"latitude": 37.7, "longitude": -122.4, "altitude": 50}}


class TestBuildEvents(unittest.TestCase):
    def test_entity_and_drone_events_are_valid_xml(self):
        events = cot_stream.build_events([ENTITY], [DRONE], NOW)
        self.assertEqual(len(events), 2)
        drone, ent = (ET.fromstring(e) for e in events)
        self.assertEqual(drone.get("type"), "a-f-A-M-F-Q")
        self.assertEqual(drone.find("detail/track").get("speed"), "5.5")
        self.assertEqual(ent.get("type"), "a-h-G-E-V")
        self.assertEqual(ent.find("detail/contact").get("callsign"), 'Truck "A" <1>')
        self.assertEqual(ent.get("stale"), "2026-01-01T12:00:30.000Z")

    def test_skips_entities_and_drones_without_valid_position(self):
        bad = [{"id": "x", "coordinates": None}, {"id": "y", "coordinates": [200, 0]}]
        self.assertEqual(cot_stream.build_events(bad, [{"drone_id": "d", "gps": {}}], NOW), [])


class TestTarget(unittest.TestCase):
    def test_parse_target(self):
        self.assertEqual(cot_stream.parse_target("udp://239.2.3.1:6969"), ("udp", "239.2.3.1", 6969))
        self.assertEqual(cot_stream.parse_target("tcp://tak.local:8087"), ("tcp", "tak.local", 8087))
        self.assertIsNone(cot_stream.parse_target("http://x:1"))
        self.assertIsNone(cot_stream.parse_target("udp://nohost"))
        self.assertIsNone(cot_stream.parse_target(None))


class TestUdpStream(unittest.TestCase):
    def test_streams_events_over_udp(self):
        rx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        rx.bind(("127.0.0.1", 0))
        rx.settimeout(3)
        port = rx.getsockname()[1]

        async def go():
            task = asyncio.create_task(cot_stream.run_stream(
                lambda: [ENTITY], lambda: [DRONE], ("udp", "127.0.0.1", port), 1.0))
            await asyncio.sleep(0.3)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        asyncio.run(go())
        got = {ET.fromstring(rx.recv(65535)).get("uid") for _ in range(2)}
        rx.close()
        self.assertEqual(got, {"skydash-drone-ALPHA-1", "ent-1"})


if __name__ == "__main__":
    unittest.main()
