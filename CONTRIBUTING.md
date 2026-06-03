# Contributing To SkyDash

SkyDash is an early local-first prototype. Contributions, issues, and architecture critiques are welcome, especially from people with experience in geospatial systems, OSINT/security workflows, drone telemetry, real-time dashboards, or backend platforms.

The most useful contributions improve depth, safety, interoperability, or run reliability. More dashboard surface area is lower priority right now.

## Best Ways To Help

Open an issue if you can give specific feedback on:

- Geospatial storage: PostGIS, GeoPackage, MBTiles, STAC, WMS/WFS, or QGIS workflows.
- OSINT interoperability: STIX/TAXII, OpenCTI, MISP, Maltego-style transforms, or evidence export.
- Drone telemetry: SITL, log replay, read-only MAVLink ingest, ArduPilot/PX4 state modeling.
- Provenance: source lineage, confidence, timestamps, analyst decisions, export integrity.
- Safety: misuse risks, beginner defaults, workflow warnings, or data-boundary problems.
- Run reliability: install, Docker, WebSocket, browser, or platform-specific issues.

Issue templates are available for launch feedback, architecture critique, integration feedback, and bugs.

## Local Setup

Run the backend:

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Run the frontend in a second terminal:

```bash
cd skydash/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

For a quick review path, see `docs/reviewer-walkthrough.md`.

## Before Opening A PR

Run the checks that match your change:

```bash
npm --prefix skydash/frontend run test
npm --prefix skydash/frontend run build
python -m py_compile backend/main.py backend/simulation.py backend/entities.py backend/missions.py backend/mavlink_adapter.py
```

If your change touches frontend code, include a screenshot or short note describing what you manually verified.

If your change touches backend routes, stores, exports, telemetry, or persistence, describe the data path and failure case you tested.

## Scope Boundaries

Do not add:

- Breached-data ingestion.
- Private-account scraping.
- Black-box enrichment.
- Biometric identification.
- Covert collection workflows.
- Real drone command/control without a prior safety design.

See `docs/safety-and-scope.md` for the project boundary.

## PR Style

Keep PRs narrow:

- One feature, fix, or critique path per PR.
- Prefer small, reviewable diffs.
- Use existing frontend/backend patterns before introducing new abstractions.
- Keep local-first setup working.
- Document any new environment variables.

Good PR titles:

- `docs: clarify PostGIS migration path`
- `fix: handle telemetry websocket reconnect`
- `feat: add read-only SITL telemetry ingest`
- `test: cover mission entity linking`

## If You Are Unsure

Open an issue first with:

- What workflow you are trying to improve.
- What feels unrealistic or unsafe today.
- What integration or architecture choice you would make next.
