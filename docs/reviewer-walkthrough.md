# SkyDash Reviewer Walkthrough

This is the shortest path for evaluating SkyDash from GitHub, LinkedIn, X, or a
live demo link.

SkyDash is not production investigation software. The current public demo uses
simulated drone telemetry, SQLite persistence, backend-mediated connector
routes, and optional vision hooks. Treat this walkthrough as an architecture and
workflow review, not an operational endorsement.

## Fastest Path: Live Demo

Open the live app:

```text
https://wonderful-cliff-0325f3800.7.azurestaticapps.net
```

Useful live API links:

```text
https://skydash-api-38666.azurewebsites.net/health
https://skydash-api-38666.azurewebsites.net/docs
```

Expected live baseline:

- Three simulated drones.
- WebSocket telemetry connected to the Azure backend.
- Entity and mission workflows available.
- ADS-B/OpenSky connector available through backend routes.
- Shodan shown as mock/unavailable until credentials are configured.
- Optional RT-DETR vision reported unavailable unless installed.

## Local Path

Run with Docker Compose:

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:8001/health
```

Open `http://localhost`.

Or run separate processes:

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

Open `http://localhost:5173`.

## 5-Minute Review Path

1. Dashboard

   Let the boot sequence finish, then confirm the dashboard shows three
   simulated drones, fleet status cards, recent activity, and live telemetry
   movement.

2. Full Map

   Press `M` or use the sidebar. Toggle map layers, inspect entities, try
   radius search, and review geofence/annotation tools.

3. Intel

   Press `I`. Review the entity list, relationship graph, OSINT ingest panel,
   pattern panel, provenance/evidence chain, comparison view, and link
   suggestions.

4. Missions

   Open Missions. Create or inspect a mission workspace, link entities, add
   notes, and review the debrief/briefing flow.

5. Telemetry

   Press `T`. Review the drone command panel, instruments, charts, and
   WebSocket-driven updates. Command controls are for the simulated fleet only.

6. Exports And API

   Check exports from the UI, then open `/docs` on the backend. Useful route
   groups include telemetry, drone command ACK, entities, missions, connectors,
   detections, events, and export routes.

## What To Critique

The most useful feedback is not "add more dashboard features." Better critique
targets are:

- Should the next storage layer be PostGIS, GeoPackage, MBTiles, STAC, WMS/WFS,
  or something else?
- What import/export path would make this credible for OSINT workflows:
  STIX/TAXII, OpenCTI, MISP, Maltego-style transforms, or another format?
- What is the safest real-drone path: SITL, log replay, read-only MAVLink
  ingest, or limited command/control?
- Where does the provenance model need stronger source lineage, confidence,
  timestamps, or analyst review state?
- What should be removed, constrained, or documented before beginners use this
  with real data?

## Known Prototype Limits

- Telemetry is simulated at 10 Hz.
- Real drone support is not wired into the production API.
- SQLite is used for current persistence.
- Public demo auth is intentionally open.
- Shodan requires credentials for live behavior.
- RT-DETR requires optional local dependencies.
- Production use would need auth/RBAC, stronger audit guarantees, secrets
  management, data governance, monitoring, and safer defaults.

## Suggested Issue

For detailed feedback, open a GitHub issue and include:

- Your domain: geospatial, OSINT, drone, security, backend, frontend, or other.
- The workflow you reviewed.
- What broke or felt unrealistic.
- What you would build next and why.
