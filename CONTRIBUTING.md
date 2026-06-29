# Contributing To SkyDash

SkyDash is an early spatial-intelligence prototype with a public Azure demo.
Contributions, issues, and architecture critiques are welcome, especially from
people with experience in geospatial systems, OSINT/security workflows, drone
telemetry, real-time dashboards, backend platforms, or safety review.

The most useful contributions improve depth, safety, interoperability,
operability, or run reliability. More dashboard surface area is lower priority.

## Best Ways To Help

Open an issue if you can give specific feedback on:

- Geospatial storage: PostGIS, GeoPackage, MBTiles, STAC, WMS/WFS, or QGIS
  workflows.
- OSINT interoperability: STIX/TAXII, OpenCTI, MISP, Maltego-style transforms,
  or evidence export.
- Drone telemetry: SITL, log replay, read-only MAVLink ingest, ArduPilot/PX4
  state modeling.
- Provenance: source lineage, confidence, timestamps, analyst decisions, export
  integrity.
- Safety: misuse risks, beginner defaults, workflow warnings, or data-boundary
  problems.
- Deployment: backend CI/CD, Azure App Service hardening, monitoring, secrets,
  rollback, or database migration.
- Run reliability: install, Docker, WebSocket, browser, or platform-specific
  issues.

## Local Setup

Docker Compose:

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:8001/health
```

Separate processes:

```powershell
cd backend
pip install -r requirements.txt
python main.py
```

```powershell
cd skydash/frontend
npm install
$env:VITE_API_URL='http://localhost:8001'
npm run dev
```

Open `http://localhost` for Docker or `http://localhost:5173` for Vite.

For current live status and run commands, see `README.md`,
`docs/current-status.md`, and `docs/skydash-operations-runbook.md`.

## Before Opening A PR

Run the checks that match your change:

```powershell
python -m compileall backend
cd backend; python -m pytest tests; cd ..
npm --prefix skydash/frontend run lint
npm --prefix skydash/frontend run test -- --run
npm --prefix skydash/frontend run build
cd skydash_intel_crew; uv run pytest; cd ..
```

If your change touches frontend behavior, include a screenshot or short note
describing what you manually verified.

If your change touches backend routes, stores, exports, telemetry, connectors,
or persistence, describe the data path and failure case you tested.

If your change touches deployment, include the exact Azure/GitHub verification
commands or workflow run link.

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
- Update `docs/current-status.md` or the runbook when deployment behavior
  changes.

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
