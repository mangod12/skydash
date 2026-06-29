# Architecture Walkthrough

This walkthrough is for reviewers who want to understand how SkyDash is put
together, what is running live, and where the engineering tradeoffs still are.

SkyDash is a local-first codebase with a public Azure demo. The architecture
still favors inspectability and fast iteration, but the current main branch also
has a deployed frontend/backend path.

## System Boundary

```text
React/Vite UI
  -> Zustand stores
  -> operational views
  -> FastAPI REST routes
  -> SQLite-backed stores

React/Vite UI
  -> telemetry hook/store
  -> WebSocket stream
  -> FastAPI WebSocket endpoint
  -> FleetSimulator

CrewAI runner
  -> local docs/source snapshot
  -> optional live app/API checks
  -> company-readiness report
```

The UI has two main data paths:

- REST for entities, relationships, missions, notes, detections, connectors,
  exports, auth, and health checks.
- WebSocket for live simulated telemetry.

That split keeps live vehicle state separate from slower CRUD-style
intelligence workflow state.

## Frontend Shape

The frontend is organized around operational surfaces:

- Dashboard for high-level fleet, workspace, and system status.
- Map for geospatial context, layers, geofences, annotations, ADS-B, and spatial
  search.
- Intel for entities, relationships, provenance, pattern detection, OSINT
  ingest, and comparison.
- Missions for grouping entities, notes, bookmarks, debriefs, and briefing
  export workflow.
- Telemetry for drone instruments, charts, commands, and fleet state.
- Scenario lab, analytics, and settings for review/configuration surfaces.

State is kept in focused Zustand stores rather than one global mega-store.
Views compose store state and hooks; reusable components stay closer to
presentation and interaction.

Runtime endpoints come from Vite env vars:

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_ADSB_URL`

When `VITE_WS_URL` is absent, the frontend derives the WebSocket base from
`VITE_API_URL`.

## Backend Shape

The backend is a FastAPI service with route modules:

- `routes/telemetry.py`: telemetry REST, command ACK, reset, WebSocket stream,
  telemetry history, and fleet stats.
- `routes/entities.py`: entity CRUD, relationship creation, entity graph,
  global graph, timeline, and events.
- `routes/missions.py`: mission CRUD, linked entities, and notes.
- `routes/connectors.py`: ADS-B/OpenSky and Shodan search, preview, ingest, and
  status routes.
- `routes/export.py`: GeoJSON, telemetry CSV, and entities CSV exports.
- `routes/vision.py`: optional RT-DETR status, sample feed/frame, mission
  detection analysis, and detection deletion.
- `routes/auth_routes.py`: optional auth/user endpoints.

Shared state and configuration live in `deps.py`. SQLite connection/migrations
live in `database.py`; the current schema version includes mission detections.

## Real-Time Telemetry

Telemetry is simulated at 10 Hz for three drones. The simulator produces
movement, battery, signal, mode, status, command state, attitude, GPS, and wind
fields that the UI consumes over WebSockets.

The drone command UI sends commands to the backend and waits for backend ACK
before confirming mode changes. This is still simulator control, not real
vehicle control.

## Connectors And OSINT Boundary

OpenSky/ADS-B and Shodan connectors are backend-mediated. This avoids browser
CORS limits and gives the UI a consistent ingest contract:

- Preview connector records.
- Import selected records as SkyDash entities.
- Show data-source status in the UI.

Shodan is mock/unavailable without a live `SHODAN_API_KEY`.

## Mission Debrief And Vision

Mission debriefs can attach notes, linked entities, briefing exports, and
optional detection results. RT-DETR support is lazy and optional: the base
backend starts without `ultralytics`, while `/api/vision/status` reports whether
the dependency is available.

This keeps the public Azure API lightweight while preserving the workflow for
local vision demos.

## Deployment Shape

The public deployment is split:

- Azure Static Web Apps hosts the frontend.
- Azure App Service for Linux hosts the FastAPI backend.
- GitHub Actions deploys the frontend on relevant pushes to `main`.
- Backend deploy is currently manual Azure zip deploy from the `backend/`
  source.

See [skydash-operations-runbook.md](skydash-operations-runbook.md) for the
commands and verification gate.

## Main Tradeoffs

### Local Simplicity vs Spatial Depth

SQLite makes the project easy to run and inspect. PostGIS would be the stronger
long-term choice for spatial indexing, spatial joins, and GIS integration.

### UI Breadth vs Integration Depth

The UI covers many surfaces. The next credibility jump should deepen the
foundations: provenance, persistence, connectors, auth, and safer telemetry
integration.

### Live Demo Value vs Safety

Simulated telemetry makes the product understandable quickly. Real drone support
should stay read-only until authentication, logging, operator confirmation,
failure handling, and safety boundaries are designed.

### OSINT Framing vs Misuse Risk

The useful OSINT overlap is entities, relationships, provenance, timelines, and
exports. The project deliberately avoids breached data, private scraping,
biometric identification, black-box enrichment, and covert collection workflows.

## How To Harden It Next

1. Add backend CI/CD and release rollback controls.
2. Add PostGIS as an optional backend path while keeping SQLite for local demos.
3. Define import/export contracts for STIX/TAXII or OpenCTI/MISP.
4. Make provenance first-class with confidence, source lineage, timestamps,
   analyst decisions, and export integrity.
5. Add SITL/log replay/read-only MAVLink telemetry before live MAVLink ingest.
6. Add auth/RBAC, audit guarantees, data-retention rules, and deployment
   monitoring before any production-use claim.

## Good Review Questions

- Should spatial persistence or OSINT interoperability come first?
- What is the smallest credible provenance model?
- What should read-only MAVLink ingest expose before commands exist?
- Which UI surface should be cut or simplified?
- What would make the project useful as a developer platform rather than only a
  dashboard?
