# Architecture Walkthrough

This walkthrough is for reviewers who want to understand how SkyDash is put together and what engineering tradeoffs are still open.

SkyDash is a local-first prototype. The architecture favors inspectability and fast iteration over production deployment hardening.

## System Boundary

```text
React/Vite UI
  -> Zustand stores
  -> operational views
  -> FastAPI REST routes
  -> SQLite stores

React/Vite UI
  -> telemetry hook/store
  -> WebSocket stream
  -> FastAPI WebSocket endpoint
  -> FleetSimulator
```

The UI has two main data paths:

- REST for entities, relationships, missions, notes, events, exports, and health checks.
- WebSocket for live simulated telemetry.

That split keeps live vehicle state separate from slower CRUD-style intelligence workflow state.

## Frontend Shape

The frontend is organized around operational surfaces:

- Dashboard for high-level fleet and workspace status.
- Map for geospatial context, layers, geofences, annotations, and spatial search.
- Intel for entities, relationships, provenance, pattern detection, and comparison.
- Missions for grouping entities, notes, bookmarks, and investigation workflow.
- Telemetry for drone instruments, charts, commands, and fleet state.
- Analytics and settings for review and configuration surfaces.

State is kept in focused Zustand stores rather than one global mega-store. The important boundary is that views compose store state and hooks, while reusable components stay closer to presentation and interaction.

## Backend Shape

The backend is intentionally small:

- `main.py` exposes FastAPI routes, WebSocket streaming, middleware, and export endpoints.
- `entities.py` owns SQLite persistence for entities, relationships, and events.
- `missions.py` owns mission persistence, notes, and entity linking.
- `simulation.py` owns the simulated fleet state.
- `mavlink_adapter.py` is a stub for future real telemetry integration.

SQLite is enough for a local prototype, but it is not the right long-term geospatial store if SkyDash becomes a serious GIS or investigation workflow.

## Real-Time Telemetry

Telemetry is simulated at 10Hz for three drones. The simulator produces movement, battery, signal, mode, and status fields that the UI consumes over WebSockets.

This makes the dashboard feel operational without connecting to real vehicles. That is deliberate: the safer next steps are SITL, log replay, and read-only MAVLink ingest before any command/control path.

## Data Model Priorities

The current model is broad enough to explore workflows:

- entities
- relationships
- events
- missions
- notes
- provenance fields
- exports

The next credibility jump is depth, not more UI surface area. The strongest candidates are:

- PostGIS or another spatial storage layer.
- STIX/TAXII, OpenCTI, MISP, or Maltego-style interoperability.
- Stronger provenance: source lineage, confidence, timestamps, analyst decisions, and export integrity.
- SITL/log replay/read-only MAVLink telemetry.

## Main Tradeoffs

### Local Simplicity vs Spatial Depth

SQLite makes the project easy to run, but PostGIS would make spatial indexing, querying, and integration with GIS tooling more credible.

### UI Breadth vs Integration Depth

The UI covers many surfaces. The next work should deepen one or two foundations rather than add more panels.

### Live Demo Value vs Safety

Simulated telemetry makes the product understandable quickly. Real drone support should stay read-only until authentication, logging, operator confirmation, failure handling, and safety boundaries are designed.

### OSINT Framing vs Misuse Risk

The useful OSINT overlap is entities, relationships, provenance, timelines, and exports. The project deliberately avoids breached data, private scraping, black-box enrichment, and covert collection workflows.

## How I Would Harden It Next

1. Add PostGIS as an optional backend path while keeping SQLite for local demos.
2. Define import/export contracts for STIX/TAXII or OpenCTI/MISP.
3. Make provenance a first-class model with confidence, source lineage, timestamps, and analyst decisions.
4. Add SITL or log replay telemetry before live MAVLink ingest.
5. Add auth/RBAC, audit guarantees, and data-retention rules before any production deployment claim.

## Good Review Questions

- Should spatial persistence or OSINT interoperability come first?
- What is the smallest credible provenance model?
- What should a read-only MAVLink ingest expose before commands exist?
- Which UI surface should be cut or simplified?
- What would make the project useful as a developer platform rather than only a dashboard?
