# SkyDash

A spatial intelligence and OSINT platform for real-time drone fleet operations. Built to handle multi-drone telemetry streaming, geospatial entity tracking, threat assessment, and intelligence analysis — all from a single dark-themed operations interface.

**Live demo:** [wonderful-cliff-0325f3800.7.azurestaticapps.net](https://wonderful-cliff-0325f3800.7.azurestaticapps.net)  
Deployed on Microsoft Azure Static Web Apps.

![Dashboard](docs/screenshots/dashboard.png)

## Why I Built This

I wanted to build the kind of software that defense contractors charge millions for — and make it open source. The goal was a system that could track multiple drones simultaneously, overlay intelligence data on a live map, and give an operator everything they need in one screen. Think Palantir Gotham meets a fighter jet HUD, but something you can actually run on your laptop.

The whole thing started as a simple telemetry dashboard for a single drone and grew into a full spatial intelligence platform over several development cycles.

## What It Does

**Real-time drone fleet monitoring** — Three simulated drones (orbit, grid search, waypoint patrol) stream telemetry over WebSocket at 10Hz. Each drone reports altitude, GPS position, battery voltage, signal strength, attitude (roll/pitch/yaw), and wind conditions. The frontend picks it up via WebSocket with automatic reconnection and HTTP polling fallback.

**OSINT entity tracking** — Track people, vehicles, buildings, devices, and events on the map. Each entity has a threat level, confidence score, source attribution, and tags. Entities are linked by relationships (located_at, associated_with, traveled_to) and visualized on the map with threat-colored markers.

**Intelligence analysis tools** — Natural language query parser lets you type things like "high threat vehicles near warehouse" and get filtered results. Anomaly detection flags telemetry values outside 2 standard deviations. Timeline view shows the full operational story with severity-coded events.

**Export and reporting** — One-click export to plaintext intelligence report, GeoJSON (for GIS tools), or CSV. The backend also exposes a REST API for programmatic access to everything.

## Screenshots

### Operations Dashboard
Live map with 3 drone markers, flight path trails, entity markers, compass rose, HUD overlay, and telemetry panel.

![Dashboard](docs/screenshots/dashboard.png)

### Intelligence View
Entity list with threat badges, event timeline, natural language query, anomaly detection, threat matrix, and export tools.

![Intel](docs/screenshots/intel.png)

### Analytics
Fleet status, entity distribution, threat breakdown, altitude trends, and top entities by activity.

![Analytics](docs/screenshots/analytics.png)

### Telemetry
Artificial horizon (attitude indicator), speed/altitude tapes, battery gauge, signal meter, GPS constellation sky view, and multi-chart with switchable data streams.

![Telemetry](docs/screenshots/telemetry.png)

### Full Map
Dark CartoDB tiles with satellite toggle, zoom controls, layer management, measure tool, coordinate display (DD/DMS/UTM/MGRS), and timeline playback slider.

![Map](docs/screenshots/map.png)

## Tech Stack

**Frontend** — React 18, Vite, Tailwind CSS, Zustand (state), Framer Motion (animations), Leaflet (maps), Recharts (charts), cmdk (command palette), Lucide (icons)

**Backend** — Python, FastAPI, Uvicorn, Pydantic, WebSocket streaming

**Testing** — Playwright (46 E2E tests covering telemetry data flow, navigation, entity CRUD, API validation, UI interactions)

**Design** — Glass morphism, JetBrains Mono for metrics, military-precision typography (ALL CAPS labels, tracking-wider headers), JARVIS-inspired boot sequence and ambient effects

## Architecture

```
Frontend (57 source files)
  components/
    common/     12 — GlassCard, Toast, BootSequence, CommandPalette, etc.
    layout/      4 — Shell, Sidebar, TopBar, StatusBar
    map/        11 — MapView, DroneMarker, CompassRose, MeasureTool, etc.
    telemetry/   7 — AttitudeIndicator, BatteryGauge, SignalMeter, MultiChart, etc.
    intel/       8 — EntityCard, TimelineView, ThreatMatrix, NaturalLanguageQuery, etc.
    views/       6 — Dashboard, Map, Telemetry, Intel, Analytics, Settings
  stores/        4 — Zustand (telemetry, map, ui, intel)
  hooks/         2 — useTelemetry (WebSocket + HTTP fallback), useKeyboard

Backend (3 modules)
  main.py          — FastAPI server, WebSocket endpoint, REST API
  simulation.py    — Multi-drone fleet simulator (orbit/grid/waypoint)
  entities.py      — In-memory entity store with CRUD + relationships
```

The frontend connects via WebSocket for real-time telemetry (with exponential backoff reconnection and HTTP polling fallback). State management uses Zustand — four stores for telemetry, map, UI, and intelligence data. Code-split via Vite manual chunks so the app bundle is only 25KB gzipped.

## Getting Started

```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py          # Starts on port 8001

# Frontend (separate terminal)
cd skydash/frontend
npm install
npm run dev             # Opens on localhost:5173
```

Open http://localhost:5173 and you'll see the boot sequence, then the full dashboard with live telemetry from 3 simulated drones.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Dashboard |
| `M` | Full map |
| `T` | Telemetry view |
| `I` | Intel view |
| `B` | Toggle sidebar |
| `Ctrl+K` | Command palette |
| `?` | Keyboard shortcuts |

## API

The backend exposes a full REST API at `http://localhost:8001/docs` (Swagger UI).

Key endpoints:
- `GET /telemetry` — All drones telemetry
- `GET /telemetry/{drone_id}` — Single drone
- `WS /ws/telemetry` — WebSocket stream
- `GET /api/entities` — List entities (filterable by type, threat)
- `POST /api/entities` — Create entity
- `GET /api/entities/{id}/graph` — Relationship graph
- `GET /api/timeline` — Event timeline (paginated)
- `POST /api/export/geojson` — GeoJSON export
- `POST /reset` — Reset simulation

## Testing

```bash
# Run all 46 E2E tests
npx playwright test

# Run specific suite
npx playwright test e2e/api.spec.js          # 17 backend API tests
npx playwright test e2e/interactions.spec.js  # 11 UI interaction tests
npx playwright test e2e/skydash.spec.js       # 18 core feature tests
```

Tests cover telemetry data flow, real-time value changes, entity CRUD lifecycle, NLQ query accuracy, coordinate format cycling, fleet status validation, timeline pagination, and more.

## What I Learned

Building this taught me a lot about real-time data streaming at scale (WebSocket vs polling tradeoffs), geospatial coordinate systems (implementing DD/DMS/UTM/MGRS conversions from scratch), and how to design information-dense interfaces that don't overwhelm the operator. The anomaly detection and NLQ parser are simple implementations, but they demonstrate the pattern — in production you'd swap those for proper ML models and an NLP pipeline.

The hardest part was making it look good. Dark interfaces are unforgiving — every pixel of spacing, every shade of gray matters. I spent as much time on the design system (glass morphism, glow effects, boot sequence choreography) as on the actual features.

## License

MIT
