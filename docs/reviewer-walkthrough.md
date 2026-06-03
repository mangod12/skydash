# SkyDash Reviewer Walkthrough

This is the shortest path for evaluating SkyDash as a local prototype. It is written for reviewers coming from GitHub, Hacker News, LinkedIn, or X who want to understand the system before deciding whether to comment, star, fork, or open an issue.

SkyDash is not production investigation software. The current demo uses simulated drone telemetry, local SQLite persistence, and a MAVLink adapter stub. Treat this walkthrough as an architecture and workflow review, not an operational endorsement.

## Start The App

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

## 5-Minute Review Path

1. **Dashboard**

   Let the boot sequence finish, then confirm the dashboard shows three simulated drones, fleet status cards, recent activity, and live telemetry movement. This is the fastest way to verify the real-time UI is wired up.

2. **Full Map**

   Press `M` or use the sidebar. Toggle map layers, inspect entities, try radius search, and review geofence/annotation tools. This is the core geospatial surface.

3. **Intel**

   Press `I`. Review the entity list, relationship graph, pattern panel, provenance/evidence chain, comparison view, and link suggestions. This is where the OSINT-style data model is easiest to critique.

4. **Missions**

   Press `O`. Create or inspect a mission workspace, link entities, add notes, and review how operational state is grouped. This shows how map and intel data can become a workflow instead of isolated widgets.

5. **Telemetry**

   Press `T`. Review the drone command panel, instruments, charts, and WebSocket-driven updates. Command controls are for the simulated fleet in this prototype.

6. **Exports And API**

   Check exports from the UI, then open `http://localhost:8001/docs` for the FastAPI routes. Useful endpoints include telemetry, entities, relationships, missions, events, and export routes.

## What To Critique

The most useful feedback is not "add more dashboard features." The better critique targets are:

- Should the next storage layer be PostGIS, GeoPackage, MBTiles, or something else?
- What import/export path would make this credible for OSINT workflows: STIX/TAXII, OpenCTI, MISP, Maltego-style transforms, or another format?
- What is the safest real-drone path: SITL, log replay, read-only MAVLink ingest, or limited command/control?
- Where does the provenance model need stronger source lineage, confidence, timestamps, or analyst review state?
- What should be removed, constrained, or documented before beginners use this with real data?

## Known Local Prototype Limits

- Telemetry is simulated at 10Hz.
- MAVLink support is currently an adapter stub.
- SQLite is used for local persistence.
- There is no breached-data ingestion, private-account scraping, or black-box enrichment.
- Production deployment would need auth/RBAC, stronger audit guarantees, secrets management, data governance, and safer defaults.

## Suggested Issue

For detailed feedback, open a GitHub issue with the `Launch feedback` template and include:

- Your domain: geospatial, OSINT, drone, security, backend, frontend, or other
- The workflow you reviewed
- What broke or felt unrealistic
- What you would build next and why
