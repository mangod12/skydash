# Safety And Scope

SkyDash is an engineering prototype for studying spatial intelligence
workflows. It is meant for architecture review, local experiments, public demo
feedback, and learning how maps, entities, relationship graphs, missions,
exports, connectors, and telemetry can fit together.

It is not production investigation software, a surveillance product, or a real
drone ground-control station.

## What SkyDash Does Today

- Runs locally from the repository and has a public Azure demo.
- Streams simulated telemetry for a three-drone fleet.
- Stores entities, relationships, missions, notes, detections, and events in
  SQLite.
- Shows geospatial layers, spatial search, ADS-B/OpenSky data, heatmaps,
  geofences, and annotations.
- Supports OSINT-style entity records, link analysis, provenance views,
  connector preview/import, and exports.
- Provides FastAPI routes and WebSocket telemetry for inspection.
- Provides optional RT-DETR mission frame analysis when local vision
  dependencies are installed.
- Provides a CrewAI readiness runner for source/docs/live-status analysis.

## What SkyDash Does Not Do

- No breached-data ingestion.
- No private-account scraping.
- No black-box enrichment.
- No face recognition, license plate recognition, or biometric identification.
- No covert collection workflow.
- No real MAVLink command/control support in the production API.
- No production auth/RBAC or operational audit guarantees in the public demo.

## Data Boundary

Use sample, synthetic, public, or consented data only. Do not load private
personal data, sensitive investigation material, or operational drone data into
this prototype.

The current provenance features are useful for exploring the interface, but they
are not strong enough for real evidentiary workflows. A production version would
need source lineage, confidence handling, timestamps, analyst decisions, export
integrity, retention policy, and access control.

## Drone Boundary

The current telemetry stream is simulated at 10 Hz. Real drone adapters exist as
integration notes/stubs, not a production vehicle-control path.

The safest next drone milestones are:

1. SITL telemetry.
2. Log replay.
3. Read-only MAVLink ingest.
4. Limited command/control only after safety controls, operator confirmation,
   auth, logging, and failure handling are designed.

## Connector Boundary

Connector routes are intended for public or credentialed APIs that the operator
is authorized to use.

- OpenSky/ADS-B is used for aircraft context.
- Shodan remains mock/unavailable without a configured `SHODAN_API_KEY`.
- Do not add private scraping, breached data, credential stuffing, or covert
  collection workflows.

## Vision Boundary

Optional RT-DETR support is for local mission-frame object detection demos. It
is not used for identity recognition, biometric matching, targeting,
enforcement, or autonomous control.

## Production Hardening Needed

Before real-world use, SkyDash would need:

- Authentication and role-based access control.
- Stronger audit guarantees.
- Secrets management.
- Data governance and retention rules.
- Safer defaults for beginner users.
- Threat modeling for OSINT and drone workflows.
- Clear import/export contracts.
- Deployment hardening, monitoring, and rollback paths.
- A production database and backup strategy.

## Feedback Wanted

The most useful safety critique is specific:

- Which feature creates the biggest misuse risk?
- Which workflow needs stronger provenance or user warnings?
- Which real-drone integration step is safe enough to implement first?
- Which data import/export path would make the project more credible without
  increasing risk?
