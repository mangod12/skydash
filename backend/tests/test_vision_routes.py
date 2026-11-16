import os
import shutil
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

import database
from deps import mission_store
import main


class _FakeDetector:
    def __init__(self):
        self.calls = []

    def status(self):
        return SimpleNamespace(available=True, model="rtdetr-l.pt", error=None)

    def analyze_image(self, image_bytes, filename, content_type):
        self.calls.append(("analyze_image", filename, content_type, len(image_bytes)))
        return {
            "model": "rtdetr-l.pt",
            "source_name": filename,
            "content_type": content_type,
            "summary": {"total": 2, "labels": {"person": 1, "truck": 1}},
            "detections": [
                {"label": "person", "class_id": 0, "confidence": 0.97},
                {"label": "truck", "class_id": 1, "confidence": 0.91},
            ],
        }

    def analyze_sample_frame(self):
        self.calls.append(("analyze_sample_frame",))
        return {
            "model": "rtdetr-l.pt",
            "source_name": "sample-video-feed-frame.jpg",
            "content_type": "image/jpeg",
            "summary": {"total": 1, "labels": {"person": 1}},
            "detections": [{"label": "person", "class_id": 0, "confidence": 0.88}],
        }


class TestVisionRoutes(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-vision-routes-")
        self.db_path = os.path.join(self.tmpdir, "skydash.db")
        database.reset(self.db_path)
        conn = database.get_connection()
        conn.execute("DROP TABLE IF EXISTS schema_meta")
        conn.execute("CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT)")
        mission_store._init_tables()
        conn.execute(
            "INSERT INTO schema_meta (key, value) VALUES ('version', '3')"
        )
        conn.commit()
        self.client = TestClient(main.app)

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _create_mission(self):
        response = self.client.post("/api/missions", json={"name": "Vision mission"})
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["success"])
        return payload["data"]["id"]

    def _analyze_payload(self, mission_id, detector):
        with patch("routes.vision.detector", detector):
            return self.client.post(
                f"/api/missions/{mission_id}/detections/analyze",
                files={"image": ("frame.jpg", b"fake-bytes", "image/jpeg")},
            )

    def _sample_payload(self, mission_id, detector):
        with patch("routes.vision.detector", detector):
            return self.client.post(
                f"/api/missions/{mission_id}/detections/sample-monitor"
            )

    def test_analyze_upload_stores_detection_and_retrievable(self):
        mission_id = self._create_mission()
        fake_detector = _FakeDetector()
        response = self._analyze_payload(mission_id, fake_detector)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["success"])

        list_response = self.client.get(f"/api/missions/{mission_id}/detections")
        self.assertEqual(list_response.status_code, 200)
        list_payload = list_response.json()
        self.assertTrue(list_payload["success"])
        self.assertEqual(list_payload["metadata"]["count"], 1)
        self.assertEqual(list_payload["data"][0]["summary"]["total"], 2)

        detail_response = self.client.get(f"/api/missions/{mission_id}")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(len(detail_response.json()["data"]["detections"]), 1)

    def test_sample_monitor_stores_detection(self):
        mission_id = self._create_mission()
        fake_detector = _FakeDetector()
        response = self._sample_payload(mission_id, fake_detector)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["success"])
        list_response = self.client.get(f"/api/missions/{mission_id}/detections")
        self.assertEqual(list_response.json()["data"][0]["summary"]["total"], 1)

    def test_delete_detection(self):
        mission_id = self._create_mission()
        fake_detector = _FakeDetector()
        detect_response = self._analyze_payload(mission_id, fake_detector)
        detection_id = detect_response.json()["data"]["id"]
        delete_response = self.client.delete(
            f"/api/missions/{mission_id}/detections/{detection_id}"
        )
        self.assertTrue(delete_response.json()["success"])
        list_response = self.client.get(f"/api/missions/{mission_id}/detections")
        self.assertEqual(list_response.json()["metadata"]["count"], 0)


    # ─── error paths and status endpoints ────────────────────

    def _unavailable(self, error="model missing"):
        detector = _FakeDetector()
        detector.status = lambda: SimpleNamespace(available=False, model=None, error=error)
        return detector

    def test_status_endpoint_reports_detector_state(self):
        with patch("routes.vision.detector", _FakeDetector()):
            data = self.client.get("/api/vision/status").json()["data"]
        self.assertEqual((data["available"], data["model"], data["error"]), (True, "rtdetr-l.pt", None))

    def test_sample_endpoints_return_503_when_unavailable(self):
        with patch("routes.vision.detector", self._unavailable()):
            for path in ("/api/vision/sample-feed", "/api/vision/sample-viewer", "/api/vision/sample-frame"):
                resp = self.client.get(path)
                self.assertEqual(resp.status_code, 503, path)
                self.assertEqual(resp.json()["detail"], "model missing")

    def test_sample_frame_returns_jpeg_when_available(self):
        detector = _FakeDetector()
        detector.sample_frame = lambda: b"\xff\xd8jpeg"
        with patch("routes.vision.detector", detector):
            resp = self.client.get("/api/vision/sample-frame")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers["content-type"], "image/jpeg")
        self.assertEqual(resp.content, b"\xff\xd8jpeg")

    def test_unknown_mission_is_404_everywhere(self):
        detector = _FakeDetector()
        self.assertEqual(self.client.get("/api/missions/nope/detections").status_code, 404)
        self.assertEqual(self._analyze_payload("nope", detector).status_code, 404)
        self.assertEqual(self._sample_payload("nope", detector).status_code, 404)
        self.assertEqual(self.client.delete("/api/missions/nope/detections/x").status_code, 404)

    def test_analyze_and_monitor_503_when_detector_unavailable(self):
        mission_id = self._create_mission()
        detector = self._unavailable()
        self.assertEqual(self._analyze_payload(mission_id, detector).status_code, 503)
        self.assertEqual(self._sample_payload(mission_id, detector).status_code, 503)

    def test_analyze_maps_detector_errors_to_status_codes(self):
        mission_id = self._create_mission()
        for exc, expected in ((ValueError("bad image"), 400), (RuntimeError("busy"), 503), (KeyError("x"), 502)):
            detector = _FakeDetector()
            detector.analyze_image = lambda **_kw: (_ for _ in ()).throw(exc)
            resp = self._analyze_payload(mission_id, detector)
            self.assertEqual(resp.status_code, expected, repr(exc))
        self.assertEqual(self._analyze_payload(mission_id, detector).json()["detail"], "Image analysis failed")

    def test_sample_monitor_maps_detector_errors(self):
        mission_id = self._create_mission()
        for exc, expected in ((RuntimeError("busy"), 503), (KeyError("x"), 502)):
            detector = _FakeDetector()
            detector.analyze_sample_frame = lambda: (_ for _ in ()).throw(exc)
            self.assertEqual(self._sample_payload(mission_id, detector).status_code, expected)

    def test_delete_unknown_detection_is_404(self):
        mission_id = self._create_mission()
        resp = self.client.delete(f"/api/missions/{mission_id}/detections/missing")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["detail"], "Detection not found")

if __name__ == "__main__":
    unittest.main()
