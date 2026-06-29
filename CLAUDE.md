# SkyDash - Spatial Intelligence OS

## What This Is

SkyDash is a spatial intelligence prototype for simulated drone operations,
geospatial entity tracking, OSINT-style analysis, mission debriefs, and operator
QA workflows.

Live demo:

- Frontend: https://wonderful-cliff-0325f3800.7.azurestaticapps.net
- Backend: https://skydash-api-38666.azurewebsites.net
- API docs: https://skydash-api-38666.azurewebsites.net/docs

Read `docs/current-status.md` and `docs/safety-and-scope.md` before making
production or capability claims.

## Architecture

```text
skydash/frontend/src/    React app (Vite)
  components/            Modular UI components
    layout/              Shell, Sidebar, TopBar, StatusBar
    map/                 Leaflet + Deck.gl map views
    telemetry/           Flight instruments, gauges, charts, command controls
    intel/               Entity cards, OSINT ingest, timeline, threat matrix
    views/               Dashboard, Map, Telemetry, Intel, Mission, Analytics
    common/              BrandMark, command palette, status, notifications
  hooks/                 Telemetry, keyboard, context menu, alerts, console
  stores/                Zustand state by domain
  styles/                Design tokens, animations, themes
  utils/                 Coordinates, exports, NLQ, scenarios, runtime config

backend/                 FastAPI server + simulator + stores
  routes/                Telemetry, entities, missions, connectors, export,
                         optional vision, auth

skydash_intel_crew/      CrewAI readiness/reporting stack
```

## Stack

- React 18, Vite 8, Tailwind CSS 3, Zustand, Framer Motion.
- Leaflet + Deck.gl for maps, Recharts for charts, Lucide icons, cmdk.
- FastAPI + Uvicorn + Pydantic + WebSockets.
- SQLite with lightweight migrations.
- CrewAI for company/readiness planning.
- Azure Static Web Apps frontend and Azure App Service backend.

## Design System

- Base: near-black/zinc surfaces.
- Brand: indigo.
- Data/telemetry: cyan.
- Healthy/connected: emerald.
- Warning: amber.
- Critical/threat: red.
- Intelligence: violet.
- Typography: Inter for UI; monospace for metrics and coordinates.
- Tone: operational, precise, calm. Avoid inflated claims.

## Safety Rules

- Simulated telemetry only in the public demo.
- No breached-data ingestion.
- No private-account scraping.
- No black-box enrichment.
- No biometric identification.
- No covert collection workflows.
- No real drone command/control without a prior safety design.

## Commands

Local backend:

```powershell
cd backend
pip install -r requirements.txt
python main.py
```

Local frontend:

```powershell
cd skydash/frontend
npm install
$env:VITE_API_URL='http://localhost:8001'
npm run dev
```

Docker:

```powershell
docker compose up --build -d
```

Verification:

```powershell
python -m compileall backend
cd backend; python -m pytest tests; cd ..
npm --prefix skydash/frontend run lint
npm --prefix skydash/frontend run test -- --run
npm --prefix skydash/frontend run build
cd skydash_intel_crew; uv run pytest; cd ..
```

Production smoke:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://wonderful-cliff-0325f3800.7.azurestaticapps.net'
$env:PLAYWRIGHT_API_URL='https://skydash-api-38666.azurewebsites.net'
npx playwright test e2e/skydash.spec.js e2e/interactions.spec.js -g "app boots|backend API returns fleet telemetry|drone command panel uses backend ACK|OSINT ingest panel previews"
```

## Documentation

- `README.md`: public GitHub overview.
- `docs/current-status.md`: current release truth.
- `docs/skydash-operations-runbook.md`: local/Azure/GitHub operating commands.
- `docs/architecture-walkthrough.md`: architecture review.
- `docs/safety-and-scope.md`: safety boundary.
- `skydash_intel_crew/README.md`: CrewAI setup.
