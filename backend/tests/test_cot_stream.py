import asyncio
import os
import shutil
import socket
import ssl
import subprocess
import tempfile
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

    def test_invalid_xml_characters_do_not_break_cot_batch(self):
        from copy import deepcopy

        for char in ("\x00", "\x01", "\x0b", "\x1f", "\ud800", "\udfff", "\ufffe", "\uffff"):
            with self.subTest(codepoint=ord(char)):
                entity = {**ENTITY, "id": "id" + char, "name": "name" + char,
                          "threatLevel": "high" + char}
                drone = deepcopy(DRONE)
                drone["drone_id"] = "drone" + char
                drone["status"] = "status" + char
                events = cot_stream.build_events([entity, ENTITY], [drone], NOW)
                self.assertEqual(len(events), 3)
                roots = [ET.fromstring(event) for event in events]
                self.assertEqual(roots[0].get("uid"), "skydash-drone-drone\ufffd")
                self.assertEqual(roots[1].get("uid"), "id\ufffd")
                self.assertEqual(roots[1].find("detail/contact").get("callsign"), "name\ufffd")
                self.assertIn("status\ufffd", roots[0].find("detail/remarks").text)
                self.assertEqual(roots[2].get("uid"), ENTITY["id"])

    def test_valid_international_and_special_characters_are_preserved(self):
        name = 'Café विमान 🚁 <A&B> "quoted"'
        event = cot_stream.build_events([{**ENTITY, "name": name}], [], NOW)[0]
        self.assertEqual(ET.fromstring(event).find("detail/contact").get("callsign"), name)
        self.assertEqual(cot_stream._xml_text("line\nnext\tcolumn\rreturn"), "line\nnext\tcolumn\rreturn")

    def test_skips_entities_and_drones_without_valid_position(self):
        bad = [{"id": "x", "coordinates": None}, {"id": "y", "coordinates": [200, 0]}]
        self.assertEqual(cot_stream.build_events(bad, [{"drone_id": "d", "gps": {}}], NOW), [])

    def test_bad_drone_numeric_fields_do_not_drop_other_events(self):
        from copy import deepcopy

        for value in (None, "invalid", float("nan"), float("inf"), True, '\"/><invalid/>'):
            with self.subTest(value=repr(value)):
                bad = deepcopy(DRONE)
                bad["drone_id"] = "BAD"
                bad["gps"]["altitude"] = value
                bad["attitude"]["yaw"] = value
                bad["ground_speed"] = value
                events = cot_stream.build_events([ENTITY], [bad, DRONE], NOW)
                self.assertEqual(len(events), 3)
                root = ET.fromstring(events[0])
                self.assertEqual(root.find("point").get("hae"), "9999999.0")
                self.assertIsNone(root.find("detail/track"))
                self.assertIsNone(root.find("invalid"))
                self.assertEqual(ET.fromstring(events[1]).get("uid"), "skydash-drone-ALPHA-1")
                self.assertEqual(ET.fromstring(events[2]).get("uid"), ENTITY["id"])

    def test_zero_altitude_and_null_attitude_are_supported(self):
        from copy import deepcopy

        drone = deepcopy(DRONE)
        drone["gps"]["altitude"] = 0
        drone["attitude"] = None
        root = ET.fromstring(cot_stream.build_events([], [drone], NOW)[0])
        self.assertEqual(root.find("point").get("hae"), "0.0")
        self.assertIsNone(root.find("detail/track").get("course"))

    def test_bad_record_containers_do_not_discard_valid_batch(self):
        for malformed in (None, [], "invalid", 42, True):
            with self.subTest(record=repr(malformed)):
                events = cot_stream.build_events([malformed, ENTITY], [malformed, DRONE], NOW)
                self.assertEqual(len(events), 2)
                self.assertEqual(ET.fromstring(events[0]).get("uid"), "skydash-drone-ALPHA-1")
                self.assertEqual(ET.fromstring(events[1]).get("uid"), ENTITY["id"])

    def test_bad_gps_is_skipped_and_bad_attitude_keeps_position(self):
        for malformed in (None, [], "invalid", 42, True):
            with self.subTest(value=repr(malformed)):
                bad_gps = {**DRONE, "gps": malformed}
                bad_attitude = {**DRONE, "drone_id": "NO-ATTITUDE", "attitude": malformed}
                events = cot_stream.build_events([ENTITY], [bad_gps, bad_attitude, DRONE], NOW)
                self.assertEqual(len(events), 3)
                root = ET.fromstring(events[0])
                self.assertEqual(root.get("uid"), "skydash-drone-NO-ATTITUDE")
                self.assertEqual(root.find("point").get("lat"), "37.7")
                self.assertIsNone(root.find("detail/track").get("course"))
                self.assertEqual(root.find("detail/track").get("speed"), "5.5")
                self.assertEqual(ET.fromstring(events[1]).get("uid"), "skydash-drone-ALPHA-1")
                self.assertEqual(ET.fromstring(events[2]).get("uid"), ENTITY["id"])

    def test_boolean_and_nonfinite_positions_are_rejected(self):
        for coords in ([True, 1], [1, False], [float("nan"), 1], [1, float("inf")]):
            with self.subTest(coords=coords):
                self.assertEqual(cot_stream.build_events([{**ENTITY, "coordinates": coords}], [], NOW), [])


class TestTarget(unittest.TestCase):
    def test_parse_target(self):
        self.assertEqual(cot_stream.parse_target("udp://239.2.3.1:6969"), ("udp", "239.2.3.1", 6969))
        self.assertEqual(cot_stream.parse_target("tcp://tak.local:8087"), ("tcp", "tak.local", 8087))
        self.assertEqual(cot_stream.parse_target("tls://tak.local:8089"), ("tls", "tak.local", 8089))
        self.assertIsNone(cot_stream.parse_target("http://x:1"))
        self.assertIsNone(cot_stream.parse_target("udp://nohost"))
        self.assertIsNone(cot_stream.parse_target(None))

    def test_malformed_targets_are_ignored_without_crashing_startup(self):
        for value in ("udp://host:not-a-port", "tcp://host:65536", "tls://host:-1", "udp://[::1", "tcp://host:0"):
            with self.subTest(target=value):
                self.assertIsNone(cot_stream.parse_target(value))

    def test_ipv6_and_trimmed_targets_remain_supported(self):
        self.assertEqual(cot_stream.parse_target(" udp://[::1]:6969 "), ("udp", "::1", 6969))

    def test_interval_rejects_nonfinite_values_and_keeps_minimum(self):
        from unittest.mock import patch

        for value, expected in (("inf", 5.0), ("-inf", 5.0), ("nan", 5.0),
                                ("1e9999", 5.0), ("bad", 5.0), ("0", 1.0),
                                ("-3", 1.0), ("0.2", 1.0), ("2.5", 2.5)):
            with self.subTest(value=value), patch.dict(os.environ, {"SKYDASH_COT_INTERVAL": value}):
                self.assertEqual(cot_stream.interval_from_env(), expected)


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


@unittest.skipUnless(shutil.which("openssl"), "openssl not available")
class TestTlsStream(unittest.TestCase):
    def test_streams_events_over_verified_tls(self):
        tmp = tempfile.mkdtemp(prefix="skydash-cot-tls-")
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        crt, key = os.path.join(tmp, "s.crt"), os.path.join(tmp, "s.key")
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
                        "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost",
                        "-keyout", key, "-out", crt], check=True, capture_output=True)
        received = []

        async def go():
            sctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            sctx.load_cert_chain(crt, key)

            async def handle(reader, writer):
                received.append(await reader.read(100000))
                writer.close()

            server = await asyncio.start_server(handle, "127.0.0.1", 0, ssl=sctx)
            port = server.sockets[0].getsockname()[1]
            old = os.environ.get("SKYDASH_COT_CA")
            os.environ["SKYDASH_COT_CA"] = crt
            try:
                task = asyncio.create_task(cot_stream.run_stream(
                    lambda: [ENTITY], lambda: [DRONE], ("tls", "localhost", port), 1.0))
                await asyncio.sleep(0.8)
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            finally:
                if old is None:
                    os.environ.pop("SKYDASH_COT_CA", None)
                else:
                    os.environ["SKYDASH_COT_CA"] = old
                server.close()
                await server.wait_closed()

        asyncio.run(go())
        data = b"".join(received)
        self.assertIn(b'uid="ent-1"', data)
        self.assertIn(b'uid="skydash-drone-ALPHA-1"', data)

    def test_untrusted_server_is_rejected_by_default(self):
        ctx = cot_stream.build_ssl_context({})
        self.assertEqual(ctx.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(ctx.check_hostname)


if __name__ == "__main__":
    unittest.main()
