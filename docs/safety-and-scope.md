# Safety And Scope

SkyDash is a local-first engineering prototype for studying spatial intelligence workflows. It is meant for architecture review, local experiments, and learning how maps, entities, relationship graphs, missions, exports, and telemetry can fit together.

It is not production investigation software, a surveillance product, or a real drone ground-control station.

## What SkyDash Does Today

- Runs locally from the repository.
- Streams simulated telemetry for a three-drone fleet.
- Stores local entities, relationships, missions, notes, and events in SQLite.
- Shows geospatial layers, spatial search, heatmaps, geofences, and annotations.
- Supports OSINT-style entity records, link analysis, provenance views, and exports.
- Provides FastAPI routes and WebSocket telemetry for inspection.

## What SkyDash Does Not Do

- No breached-data ingestion.
- No private-account scraping.
- No black-box enrichment.
- No face recognition, license plate recognition, or biometric identification.
- No covert collection workflow.
- No real MAVLink command/control support.
- No production auth/RBAC or operational audit guarantees.

## Data Boundary

Use sample, synthetic, public, or consented data only. Do not load private personal data, sensitive investigation material, or operational drone data into this prototype.

The current provenance features are useful for exploring the interface, but they are not strong enough for real evidentiary workflows. A production version would need source lineage, confidence handling, timestamps, analyst decisions, export integrity, retention policy, and access control.

## Drone Boundary

The current telemetry stream is simulated at 10Hz. The MAVLink adapter is a stub, not real vehicle support.

The safest next drone milestones are:

1. SITL telemetry.
2. Log replay.
3. Read-only MAVLink ingest.
4. Limited command/control only after safety controls, operator confirmation, auth, logging, and failure handling are designed.

## Production Hardening Needed

Before real-world use, SkyDash would need:

- Authentication and role-based access control.
- Stronger audit guarantees.
- Secrets management.
- Data governance and retention rules.
- Safer defaults for beginner users.
- Threat modeling for OSINT and drone workflows.
- Clear import/export contracts.
- Deployment hardening and monitoring.

## Feedback Wanted

The most useful safety critique is specific:

- Which feature creates the biggest misuse risk?
- Which workflow needs stronger provenance or user warnings?
- Which real-drone integration step is safe enough to implement first?
- Which data import/export path would make the project more credible without increasing risk?
