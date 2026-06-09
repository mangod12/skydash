# SkyDash

Local-first spatial intelligence dashboard for geospatial maps, OSINT-style entities, relationship analysis, mission workflow, exports, connectors, and simulated drone telemetry.

[![CI](https://github.com/mangod12/skydash/actions/workflows/ci.yml/badge.svg)](https://github.com/mangod12/skydash/actions/workflows/ci.yml)

SkyDash is not production investigation software. It is a hackable engineering prototype for studying dense operational UI, real-time telemetry, map workflows, and entity/link analysis without a sales-gated enterprise tool.

## What Is In This Repo

| Area | Path | What it does |
|---|---|---|
| FastAPI backend | `backend/main.py` | API entrypoint, auth middleware, telemetry recorder, health/root routes, and router mounting. |
| Backend routes | `backend/routes/` | Telemetry, entities, missions, auth, connectors, and export routes. |
| Backend stores/adapters | `backend/*.py` | In-memory/local stores, SQLite persistence, simulated fleet, MAVLink/DJI adapter stubs, OpenSky/Shodan connectors. |
| React frontend | `skydash/frontend/` | Vite + React dashboard with maps, telemetry, intelligence, mission, analytics, and settings views. |
| State and utilities | `skydash/frontend/src/stores/`, `src/utils/`, `src/hooks/` | Zustand stores, analysis helpers, API client, alert evaluation, exports, graph utilities, sanitization, keyboard and telemetry hooks. |
| E2E tests | `e2e/` | Playwright flows and screenshots. |
| Docs | `docs/` | Reviewer walkthrough, architecture walkthrough, safety/scope notes, screenshots. |
| Containers | `Dockerfile*`, `docker-compose.yml`, `nginx.conf` | Split backend/frontend containers and combined deployment assets. |

## Current Capabilities

### Geospatial And Telemetry

- FastAPI WebSocket stream for fleet telemetry.
- Simulated drones with orbit/grid/waypoint behavior.
- Telemetry history ring buffer sampled on backend startup.
- Leaflet map UI with layers, entity overlays, geofences, annotations, search, and measuring tools.
- ADS-B connector path using OpenSky with fallback behavior.
- MAVLink and DJI adapter stubs for future hardware integration.

### Intelligence Workflow

- Entity CRUD for people, vehicles, buildings, devices, events, and organizations.
- Relationship/link graph and link suggestions.
- Natural-language query parsing for local entity filters.
- Pattern, risk, network, temporal, and graph analysis helpers.
- Missions, notes, bookmarks, audit log, alerts, and notifications.
- Export generators for operational reports and data formats.
- Optional RT-DETR image analysis for mission/debrief frames.

### UI

- React 18, Vite, Tailwind, Zustand, React Query, Leaflet, D3, Recharts, Framer Motion.
- Dashboard, map, telemetry, intelligence, analytics, missions, command palette, and settings views.
- Themes and tactical UI tokens under `src/styles/`.

## Architecture

```text
React/Vite frontend
  -> Zustand stores + React Query
  -> REST API for entities, missions, connectors, exports
  -> WebSocket telemetry stream

FastAPI backend
  -> simulated fleet and telemetry history
  -> entity and mission stores
  -> SQLite/local persistence
  -> OpenSky and Shodan connector facades
  -> auth/API-key middleware when enabled
```

## Local Development

Backend:

```bash
git clone https://github.com/mangod12/skydash.git
cd skydash/backend

python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell users can use .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Frontend:

```bash
cd skydash/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Useful backend URLs:

- `http://localhost:8001/health`
- `http://localhost:8001/docs`
- `http://localhost:8001/telemetry`
- `ws://localhost:8001/ws/telemetry`

## Configuration

Start from `.env.example`.

Common settings:

| Variable | Purpose |
|---|---|
| `SKYDASH_HOST` | Backend host. |
| `SKYDASH_PORT` | Backend port, commonly `8001`. |
| `SKYDASH_API_KEY` | Enables API-key middleware when auth is not fully enabled. |
| `SKYDASH_AUTH_ENABLED` | Enables JWT-style auth path. |
| `SKYDASH_CORS_ORIGINS` | Comma-separated frontend origins. |
| `SHODAN_API_KEY` | Optional live Shodan connector. |
| `SKYDASH_RTDETR_MODEL` | Optional RT-DETR model name/path, default `rtdetr-l.pt`. |
| `SKYDASH_RTDETR_CONFIDENCE` | Optional detection confidence threshold, default `0.35`. |
| `SKYDASH_RTDETR_MAX_UPLOAD_BYTES` | Optional max mission frame upload size, default 8 MB. |

## Optional RT-DETR Mission Debrief

SkyDash can attach RT-DETR object detections to a mission debrief. The base backend stays lightweight; install the vision extras only on machines that should run object detection.

```bash
cd backend
pip install -r requirements-vision.txt
python main.py
```

Then open a mission and select the **DEBRIEF** tab. You can either upload a JPEG/PNG/WebP mission frame or use the built-in sample monitoring feed. Results are stored on the mission, can be added to analyst notes, and are included in generated mission briefings.

Useful endpoints:

- `GET /api/vision/status`
- `GET /api/vision/sample-feed`
- `GET /api/vision/sample-frame`
- `GET /api/vision/sample-viewer`
- `POST /api/missions/{mission_id}/detections/analyze`
- `POST /api/missions/{mission_id}/detections/sample-monitor`
- `GET /api/missions/{mission_id}/detections`
- `DELETE /api/missions/{mission_id}/detections/{detection_id}`

## Tests And Quality

Frontend:

```bash
cd skydash/frontend
npm run lint
npm run test
npm run build
```

Backend smoke path:

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Then in another terminal:

```bash
curl http://localhost:8001/health
curl http://localhost:8001/telemetry
curl http://localhost:8001/api/entities
```

Playwright:

```bash
npm install
npx playwright test
```

The CI workflow builds/tests the frontend, starts the backend, checks `/health`, `/telemetry`, `/api/entities`, and `/api/timeline`, then builds backend and frontend Docker images on `main`.

## Docker

```bash
docker compose up --build
```

The repo also contains separate `Dockerfile.backend` and `Dockerfile.frontend` files plus `nginx.conf` for frontend proxying.

## Safety And Scope

SkyDash currently uses simulated telemetry and local/demo data. It does not include private-account scraping, breached-data ingestion, or autonomous operational control. RT-DETR detections are analyst-assist debrief evidence, not identity, targeting, or autonomous response decisions. Real deployments would need stronger auth/RBAC, audit retention, data governance, connector review, model evaluation, privacy review, and safety constraints.

See:

- [docs/safety-and-scope.md](docs/safety-and-scope.md)
- [docs/reviewer-walkthrough.md](docs/reviewer-walkthrough.md)
- [docs/architecture-walkthrough.md](docs/architecture-walkthrough.md)

## License

MIT. See [LICENSE](LICENSE).
