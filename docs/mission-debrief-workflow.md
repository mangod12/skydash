# Mission Debrief Workflow

SkyDash's marketable wedge is a local-first geospatial mission notebook: map context, entities, telemetry, analyst notes, visual detections, and exportable briefings in one place.

## Workflow

1. Create a mission for a drone inspection, event security incident, or search-and-rescue exercise.
2. Save the current map context and link relevant entities.
3. Add analyst notes during the mission.
4. Upload mission frames in the **DEBRIEF** tab or open the built-in sample monitoring feed.
5. Run optional RT-DETR object detection against the uploaded frame or sample feed frame.
6. Promote useful detections into mission notes.
7. Export the mission briefing.

## RT-DETR Boundary

RT-DETR is used for object detection on uploaded still frames. It is not used for:

- Identity recognition.
- Private-account scraping.
- Autonomous control.
- Targeting or enforcement decisions.

Install it only where local policy permits image analysis:

```bash
cd backend
pip install -r requirements-vision.txt
```

The base backend remains usable without the optional vision dependencies. The UI will show the debrief tab as optional until `ultralytics` is installed.

## Demo Scenario

Use one narrow scenario when showing SkyDash:

> Drone inspection debrief: upload still frames, detect visible vehicles/people/equipment, link related entities, save observations, and export a mission report.

Avoid pitching SkyDash as a broad "open-source Palantir." The product is easier to understand as a mission notebook and debrief tool.

## Built-In Sample Feed

After installing vision extras and starting the backend, use:

- `GET /api/vision/sample-feed` for a local MJPEG sample feed.
- `GET /api/vision/sample-frame` for a single JPEG snapshot.
- `GET /api/missions/{mission_id}/detections` to fetch stored analysis history for a mission.
- `POST /api/missions/{mission_id}/detections/sample-monitor` to run RT-DETR against the current sample frame and store the result on a mission.
- `POST /api/missions/{mission_id}/detections/analyze` to analyze an uploaded frame.
- `DELETE /api/missions/{mission_id}/detections/{detection_id}` to remove a stored detection result.

This is intended for demoing the full flow without connecting a real drone camera.
