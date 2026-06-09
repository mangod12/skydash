"""Optional RT-DETR image analysis for mission debrief workflows."""

import os
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterator, List, Optional


SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
DEFAULT_MODEL = os.getenv("SKYDASH_RTDETR_MODEL", "rtdetr-l.pt")
DEFAULT_CONFIDENCE = float(os.getenv("SKYDASH_RTDETR_CONFIDENCE", "0.35"))
MAX_UPLOAD_BYTES = int(os.getenv("SKYDASH_RTDETR_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))


@dataclass
class VisionStatus:
    available: bool
    model: str
    error: Optional[str] = None


class RTDETRDetector:
    """Lazy RT-DETR wrapper so SkyDash can run without ML dependencies."""

    def __init__(self, model_name: str = DEFAULT_MODEL, confidence: float = DEFAULT_CONFIDENCE):
        self.model_name = model_name
        self.confidence = confidence
        self._model = None
        self._load_error = None

    def status(self) -> VisionStatus:
        if self._model is not None:
            return VisionStatus(available=True, model=self.model_name)
        if self._load_error:
            return VisionStatus(available=False, model=self.model_name, error=self._load_error)
        try:
            import ultralytics  # noqa: F401
            return VisionStatus(available=True, model=self.model_name)
        except Exception as exc:  # noqa: BLE001 - broken optional installs should not break app status
            self._load_error = str(exc)
            return VisionStatus(available=False, model=self.model_name, error=self._load_error)

    def analyze_image(self, image_bytes: bytes, filename: str, content_type: str) -> Dict:
        self._validate_upload(image_bytes, content_type)
        self._load_model()

        suffix = Path(filename or "frame.jpg").suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            suffix = ".jpg"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            results = self._model.predict(tmp_path, conf=self.confidence, verbose=False)
            detections = self._serialize_results(results)
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

        return {
            "model": self.model_name,
            "confidence_threshold": self.confidence,
            "source_name": filename or "uploaded-frame",
            "content_type": content_type,
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "detections": detections,
            "summary": self._summarize(detections),
        }

    def analyze_sample_frame(self) -> Dict:
        image_path = self._sample_image_path()
        image_bytes = image_path.read_bytes()
        result = self.analyze_image(
            image_bytes=image_bytes,
            filename="sample-video-feed-frame.jpg",
            content_type="image/jpeg",
        )
        result["source_name"] = "sample-video-feed-frame.jpg"
        return result

    def sample_feed(self) -> Iterator[bytes]:
        """Yield a lightweight MJPEG sample feed for local demos."""
        while True:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + self._sample_frame_jpeg()
                + b"\r\n"
            )
            time.sleep(0.25)

    def sample_frame(self) -> bytes:
        return self._sample_frame_jpeg()

    def _load_model(self):
        if self._model is not None:
            return
        try:
            from ultralytics import RTDETR
        except ImportError as exc:
            raise RuntimeError(
                "RT-DETR support is not installed. Install backend/requirements-vision.txt."
            ) from exc
        self._model = RTDETR(self.model_name)

    @staticmethod
    def _sample_image_path() -> Path:
        try:
            import ultralytics
        except ImportError as exc:
            raise RuntimeError(
                "Sample feed requires ultralytics. Install backend/requirements-vision.txt."
            ) from exc
        path = Path(ultralytics.__file__).parent / "assets" / "bus.jpg"
        if not path.exists():
            raise RuntimeError("Ultralytics sample image is not available.")
        return path

    def _sample_frame_jpeg(self) -> bytes:
        path = self._sample_image_path()
        try:
            import cv2
        except ImportError:
            return path.read_bytes()

        frame = cv2.imread(str(path))
        if frame is None:
            return path.read_bytes()

        height, width = frame.shape[:2]
        tick = int(time.time() * 4) % width
        cv2.rectangle(frame, (0, 0), (width, 64), (0, 0, 0), -1)
        cv2.putText(
            frame,
            "SkyDash RT-DETR sample monitoring feed",
            (18, 26),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (0, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            f"FRAME {int(time.time())} | sample mission debrief",
            (18, 52),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (220, 220, 220),
            1,
            cv2.LINE_AA,
        )
        cv2.line(frame, (tick, 64), (tick, height), (0, 255, 255), 2)
        ok, encoded = cv2.imencode(".jpg", frame)
        return encoded.tobytes() if ok else path.read_bytes()

    @staticmethod
    def _validate_upload(image_bytes: bytes, content_type: str):
        if content_type not in SUPPORTED_IMAGE_TYPES:
            raise ValueError("Unsupported image type. Use JPEG, PNG, or WebP.")
        if not image_bytes:
            raise ValueError("Uploaded image is empty.")
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise ValueError(f"Uploaded image exceeds {MAX_UPLOAD_BYTES} bytes.")

    @staticmethod
    def _serialize_results(results) -> List[Dict]:
        detections = []
        for result in results:
            names = getattr(result, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                xyxy = [float(v) for v in box.xyxy[0].tolist()]
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                detections.append(
                    {
                        "label": str(names.get(class_id, class_id)),
                        "class_id": class_id,
                        "confidence": round(confidence, 4),
                        "bbox_xyxy": [round(v, 2) for v in xyxy],
                    }
                )
        detections.sort(key=lambda item: item["confidence"], reverse=True)
        return detections

    @staticmethod
    def _summarize(detections: List[Dict]) -> Dict:
        counts = {}
        for detection in detections:
            counts[detection["label"]] = counts.get(detection["label"], 0) + 1
        return {
            "total": len(detections),
            "labels": counts,
            "top_labels": sorted(counts.items(), key=lambda item: item[1], reverse=True)[:5],
        }


detector = RTDETRDetector()
