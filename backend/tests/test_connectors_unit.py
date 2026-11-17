import unittest
from unittest.mock import MagicMock, patch

from connectors import OpenSkyConnector, ShodanConnector


def state(icao="abc123", callsign="UAL1 ", lon=-122.4, lat=37.7, baro=1000.0, geo=None):
    row = [None] * 17
    row[0], row[1], row[2] = icao, callsign, "United States"
    row[4], row[5], row[6] = 1700000000, lon, lat
    row[7], row[8], row[9], row[10], row[11] = baro, False, 120.5, 270.0, 0.0
    row[13] = geo
    return row


def response(status=200, body=None):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body or {}
    return r


class TestOpenSky(unittest.TestCase):
    def test_parses_states_and_skips_rows_without_position(self):
        rows = [state(), state(icao="nopos", lon=None)]
        with patch("connectors.requests.get", return_value=response(200, {"states": rows})):
            aircraft = OpenSkyConnector().fetch_aircraft()
        self.assertEqual(len(aircraft), 1)
        self.assertEqual(aircraft[0]["callsign"], "UAL1")
        self.assertEqual(aircraft[0]["latitude"], 37.7)
        self.assertEqual(aircraft[0]["altitude"], 1000.0)

    def test_malformed_rows_do_not_discard_valid_aircraft(self):
        rows = [state(icao="first"), None, {}, [], ["short"],
                state(icao="badcallsign", callsign=42), state(icao=None),
                state(lat=True), state(lat=float("nan")), state(lon=float("inf")),
                state(lat=91), state(lon=-181), state(icao="last", lat=0, lon=0)]
        with patch("connectors.requests.get", return_value=response(200, {"states": rows})):
            conn = OpenSkyConnector()
            aircraft = conn.fetch_aircraft()
        self.assertEqual([a["icao24"] for a in aircraft], ["first", "last"])
        self.assertEqual(aircraft[-1]["latitude"], 0)
        self.assertEqual(conn.cache, aircraft)

    def test_falls_back_to_geometric_altitude_and_zero(self):
        rows = [state(baro=None, geo=900.0), state(icao="z", baro=None, geo=None)]
        with patch("connectors.requests.get", return_value=response(200, {"states": rows})):
            aircraft = OpenSkyConnector().fetch_aircraft()
        self.assertEqual([a["altitude"] for a in aircraft], [900.0, 0])

    def test_zero_barometric_altitude_is_not_replaced_by_geometric_altitude(self):
        with patch("connectors.requests.get", return_value=response(200, {"states": [state(baro=0, geo=900.0)]})):
            conn = OpenSkyConnector()
            aircraft = conn.fetch_aircraft()
        self.assertEqual(aircraft[0]["altitude"], 0)
        self.assertEqual(conn.to_entities(aircraft)[0]["properties"]["altitude_m"], 0)

    def test_invalid_numeric_fields_do_not_break_entity_conversion(self):
        bad_rows = []
        for index, value in ((7, "unknown"), (7, float("nan")), (9, float("inf")),
                             (10, "north"), (11, True), (13, "bad fallback")):
            row = state(baro=None if index == 13 else 1000.0)
            row[index] = value
            bad_rows.append(row)
        with patch("connectors.requests.get", return_value=response(200, {"states": bad_rows + [state(icao="valid")]})):
            conn = OpenSkyConnector()
            entities = conn.to_entities(conn.fetch_aircraft())
        self.assertEqual([entity["id"] for entity in entities], ["adsb-valid"])

    def test_sends_bbox_as_query_params(self):
        with patch("connectors.requests.get", return_value=response(200, {"states": None})) as get:
            self.assertEqual(OpenSkyConnector().fetch_aircraft(bbox=[1, 2, 3, 4]), [])
        self.assertEqual(get.call_args.kwargs["params"], {"lamin": 1, "lomin": 2, "lamax": 3, "lomax": 4})

    def test_caches_within_ttl(self):
        conn = OpenSkyConnector()
        with patch("connectors.requests.get", return_value=response(200, {"states": [state()]})) as get:
            conn.fetch_aircraft()
            conn.fetch_aircraft()
        self.assertEqual(get.call_count, 1)

    def test_cache_is_scoped_to_the_requested_region(self):
        conn = OpenSkyConnector()
        first_region, next_region = [1, 2, 3, 4], [5, 6, 7, 8]
        with patch("connectors.requests.get", side_effect=[
            response(200, {"states": [state(icao="first")]}),
            response(200, {"states": [state(icao="next")]}),
            response(200, {"states": [state(icao="global")]}),
        ]) as get:
            self.assertEqual(conn.fetch_aircraft(first_region)[0]["icao24"], "first")
            self.assertEqual(conn.fetch_aircraft(list(first_region))[0]["icao24"], "first")
            self.assertEqual(conn.fetch_aircraft(next_region)[0]["icao24"], "next")
            self.assertEqual(conn.fetch_aircraft()[0]["icao24"], "global")
        self.assertEqual(get.call_count, 3)

    def test_other_region_cache_is_never_used_as_failure_fallback(self):
        conn = OpenSkyConnector()
        region = [1, 2, 3, 4]
        with patch("connectors.requests.get", return_value=response(200, {"states": [state()]})):
            cached = conn.fetch_aircraft(region)
        for failure in (response(429), RuntimeError("down")):
            with self.subTest(failure=type(failure).__name__):
                kwargs = {"side_effect": failure} if isinstance(failure, Exception) else {"return_value": failure}
                with patch("connectors.requests.get", **kwargs):
                    self.assertEqual(conn.fetch_aircraft([5, 6, 7, 8]), [])
                    self.assertEqual(conn.fetch_aircraft(), [])
                self.assertEqual(conn.cache, cached)
                self.assertEqual(conn.cache_bbox, tuple(region))

    def test_empty_region_result_is_cached_within_ttl(self):
        conn = OpenSkyConnector()
        with patch("connectors.requests.get", return_value=response(200, {"states": []})) as get:
            self.assertEqual(conn.fetch_aircraft([1, 2, 3, 4]), [])
            self.assertEqual(conn.fetch_aircraft([1, 2, 3, 4]), [])
        get.assert_called_once()

    def test_returns_cache_on_http_error_and_exception(self):
        conn = OpenSkyConnector()
        conn.cache = [{"icao24": "cached"}]
        with patch("connectors.requests.get", return_value=response(429)):
            self.assertEqual(conn.fetch_aircraft(), [{"icao24": "cached"}])
        with patch("connectors.requests.get", side_effect=RuntimeError("down")):
            self.assertEqual(conn.fetch_aircraft(), [{"icao24": "cached"}])

    def test_to_entities_shape(self):
        with patch("connectors.requests.get", return_value=response(200, {"states": [state(callsign="")]})):
            conn = OpenSkyConnector()
            entity = conn.to_entities(conn.fetch_aircraft())[0]
        self.assertEqual(entity["id"], "adsb-abc123")
        self.assertEqual(entity["name"], "abc123")
        self.assertEqual(entity["coordinates"], [37.7, -122.4])
        self.assertEqual(entity["properties"]["velocity_ms"], 120.5)
        self.assertEqual(entity["type"], "aircraft")


class TestShodan(unittest.TestCase):
    def test_mock_mode_without_key_respects_limit(self):
        conn = ShodanConnector()
        self.assertFalse(conn.available)
        results = conn.search("webcam", 2)
        self.assertEqual(len(results), 2)
        self.assertTrue(all(r["ip"] for r in results))

    def test_live_mode_normalizes_matches(self):
        body = {"matches": [
            {"ip_str": "1.2.3.4", "port": 80, "org": "Org", "product": "Cam", "location": {"latitude": 1.5, "longitude": 2.5}},
            {"ip_str": "5.6.7.8"},
        ]}
        conn = ShodanConnector(api_key="test-key")
        with patch("connectors.requests.get", return_value=response(200, body)) as get:
            results = conn.search("cam", 1)
        self.assertTrue(conn.available)
        self.assertEqual(get.call_args.kwargs["params"]["query"], "cam")
        self.assertEqual(results, [{"ip": "1.2.3.4", "port": 80, "org": "Org", "product": "Cam", "lat": 1.5, "lon": 2.5}])

    def test_malformed_shodan_rows_do_not_discard_valid_batch(self):
        body = {"matches": [
            {"ip_str": "1.2.3.4", "location": {"latitude": 0, "longitude": 0}},
            None, [], "bad row", {}, {"ip_str": None}, {"ip_str": 123}, {"ip_str": "  "},
            {"ip_str": " 5.6.7.8 ", "location": None},
            {"ip_str": "9.10.11.12", "location": "unknown"},
            {"ip_str": "13.14.15.16", "location": []},
        ]}
        conn = ShodanConnector(api_key="test-key")
        with patch("connectors.requests.get", return_value=response(200, body)):
            results = conn.search("cam", 50)
        self.assertEqual([row["ip"] for row in results], [
            "1.2.3.4", "5.6.7.8", "9.10.11.12", "13.14.15.16",
        ])
        entities = conn.to_entities(results)
        self.assertEqual(entities[0]["coordinates"], [0, 0])
        self.assertTrue(all(entity["coordinates"] is None for entity in entities[1:]))
        self.assertEqual(entities[-1]["id"], "shodan-13_14_15_16")

    def test_live_mode_failure_returns_empty(self):
        conn = ShodanConnector(api_key="test-key")
        with patch("connectors.requests.get", return_value=response(500)):
            self.assertEqual(conn.search("x"), [])
        with patch("connectors.requests.get", side_effect=RuntimeError("down")):
            self.assertEqual(conn.search("x"), [])

    def test_to_entities_marks_mode_and_handles_missing_coordinates(self):
        results = [{"ip": "1.2.3.4", "port": 80, "org": "O", "product": "Cam", "lat": 1.5, "lon": 2.5},
                   {"ip": "5.6.7.8", "port": 22, "org": "O", "product": "SSH"}]
        mock_entities = ShodanConnector().to_entities(results)
        self.assertEqual(mock_entities[0]["id"], "shodan-1_2_3_4")
        self.assertEqual(mock_entities[0]["coordinates"], [1.5, 2.5])
        self.assertIsNone(mock_entities[1]["coordinates"])
        self.assertEqual(mock_entities[0]["source"], "Shodan (Mock)")
        live_entities = ShodanConnector(api_key="k").to_entities(results)
        self.assertEqual(live_entities[0]["properties"]["mode"], "live")


    def test_invalid_coordinates_are_unlocated_not_persisted_as_bad_points(self):
        conn = ShodanConnector()
        for lat, lon in ((float("nan"), 1), (1, float("inf")), (91, 1), (1, -181),
                         (True, 1), (1, False), ("37.7", -122.4), (None, 1)):
            with self.subTest(lat=lat, lon=lon):
                entity = conn.to_entities([{"ip": "9.9.9.9", "lat": lat, "lon": lon}])[0]
                self.assertIsNone(entity["coordinates"])
                self.assertEqual(entity["id"], "shodan-9_9_9_9")

    def test_coordinate_boundaries_are_kept(self):
        for lat, lon in ((90, 180), (-90, -180)):
            with self.subTest(lat=lat, lon=lon):
                entity = ShodanConnector().to_entities([{"ip": "9.9.9.9", "lat": lat, "lon": lon}])[0]
                self.assertEqual(entity["coordinates"], [lat, lon])

    def test_zero_coordinates_are_kept(self):
        entity = ShodanConnector().to_entities([{"ip": "9.9.9.9", "lat": 0.0, "lon": 0.0}])[0]
        self.assertEqual(entity["coordinates"], [0.0, 0.0])

if __name__ == "__main__":
    unittest.main()
