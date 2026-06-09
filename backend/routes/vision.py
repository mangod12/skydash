"""Vision routes: optional RT-DETR status checks, sample stream, and mission detections."""

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response, StreamingResponse

from deps import mission_store
from vision import detector

log = logging.getLogger("skydash")
router = APIRouter()


@router.get("/api/vision/status")
async def get_vision_status():
    status = detector.status()
    return {
        "success": True,
        "data": {
            "available": status.available,
            "model": status.model,
            "error": status.error,
        },
    }


@router.get("/api/vision/sample-feed")
async def get_sample_vision_feed():
    status = detector.status()
    if not status.available:
        raise HTTPException(
            status_code=503,
            detail=status.error or "RT-DETR sample feed is not available",
        )
    return StreamingResponse(
        detector.sample_feed(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/api/vision/sample-viewer")
async def get_sample_vision_viewer():
    status = detector.status()
    if not status.available:
        raise HTTPException(
            status_code=503,
            detail=status.error or "RT-DETR sample feed is not available",
        )
    return HTMLResponse(
        """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SkyDash RT-DETR Sample Feed</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #050505; color: #e4e4e7; font-family: Inter, Arial, sans-serif; }
      body { min-height: 100vh; }
      main { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,.1); background: #09090b; }
      h1 { margin: 0; font-size: 13px; letter-spacing: .14em; }
      .status { display: inline-flex; align-items: center; gap: 8px; color: #86efac; font-size: 11px; font-weight: 700; letter-spacing: .1em; }
      .dot { width: 7px; height: 7px; border-radius: 999px; background: #86efac; box-shadow: 0 0 14px rgba(134,239,172,.8); }
      .feed { min-height: 0; display: grid; place-items: center; padding: 18px; }
      .frame { position: relative; width: min(100%, 1400px); background: #000; border: 1px solid rgba(255,255,255,.12); overflow: hidden; border-radius: 8px; }
      img { display: block; width: 100%; max-height: calc(100vh - 90px); object-fit: contain; background: #000; }
      .hud { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; gap: 12px; padding: 44px 14px 12px; background: linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,0)); color: #d4d4d8; font-size: 11px; font-weight: 700; letter-spacing: .08em; }
      .hud code { color: #a1a1aa; font-family: Consolas, monospace; font-size: 10px; }
      @media (max-width: 640px) {
        header { align-items: flex-start; flex-direction: column; }
        .feed { padding: 10px; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>SKYDASH RT-DETR SAMPLE VIDEO FEED</h1>
        <span class="status"><span class="dot"></span>LIVE MJPEG</span>
      </header>
      <section class="feed">
        <div class="frame">
          <img src="/api/vision/sample-feed" alt="SkyDash RT-DETR sample feed">
          <div class="hud">
            <span>MISSION DEBRIEF MONITOR</span>
            <code>rtdetr-l.pt</code>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
        """.strip()
    )


@router.get("/api/vision/sample-frame")
async def get_sample_vision_frame():
    status = detector.status()
    if not status.available:
        raise HTTPException(
            status_code=503,
            detail=status.error or "RT-DETR sample frame is not available",
        )
    return Response(content=detector.sample_frame(), media_type="image/jpeg")


@router.get("/api/missions/{mission_id}/detections")
async def get_mission_detections(mission_id: str):
    if not mission_store.get_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")
    detections = mission_store.get_detections(mission_id)
    return {"success": True, "data": detections, "metadata": {"count": len(detections)}}


@router.post("/api/missions/{mission_id}/detections/analyze", status_code=201)
async def analyze_mission_frame(mission_id: str, image: UploadFile = File(...)):
    if not mission_store.get_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")

    status = detector.status()
    if not status.available:
        raise HTTPException(
            status_code=503,
            detail=status.error or "RT-DETR detector is not available",
        )

    image_bytes = await image.read()
    try:
        result = detector.analyze_image(
            image_bytes=image_bytes,
            filename=image.filename or "mission-frame.jpg",
            content_type=image.content_type or "",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        log.error("RT-DETR image analysis failed", exc_info=True)
        raise HTTPException(status_code=502, detail="Image analysis failed") from exc

    detection = mission_store.add_detection(mission_id, result)
    if not detection:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": detection}


@router.post("/api/missions/{mission_id}/detections/sample-monitor", status_code=201)
async def analyze_sample_monitor_frame(mission_id: str):
    if not mission_store.get_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")

    status = detector.status()
    if not status.available:
        raise HTTPException(
            status_code=503,
            detail=status.error or "RT-DETR detector is not available",
        )

    try:
        result = detector.analyze_sample_frame()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        log.error("RT-DETR sample monitor analysis failed", exc_info=True)
        raise HTTPException(status_code=502, detail="Sample monitor analysis failed") from exc

    detection = mission_store.add_detection(mission_id, result)
    if not detection:
        raise HTTPException(status_code=404, detail="Mission not found")
    return {"success": True, "data": detection}


@router.delete("/api/missions/{mission_id}/detections/{detection_id}")
async def delete_mission_detection(mission_id: str, detection_id: str):
    if not mission_store.get_mission(mission_id):
        raise HTTPException(status_code=404, detail="Mission not found")
    if not mission_store.delete_detection(detection_id, mission_id=mission_id):
        raise HTTPException(status_code=404, detail="Detection not found")
    return {"success": True, "data": {"deleted": detection_id}}
