# Recorded flight-log training workflow

Open Scenario Lab > FLIGHT LOG REPLAY. This is a recorded-data review workspace, separate from the live fleet and scenario scores. It sends no aircraft commands and does not certify training or authorize flight.

## Import contract

Use `examples/flight-log-training.csv` or Load synthetic sample. The sample is fabricated, not a real flight. Supported format is UTF-8 CSV with this exact header:

```csv
time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct
```

- One aircraft, relative seconds starting at zero, strictly increasing timestamps.
- 2 to 10,000 samples, at most 1MiB, duration at most 21,600 seconds.
- WGS84 decimal latitude within -85 to 85 and longitude within -180 to 180. No dateline-crossing tracks. Zero coordinates are valid.
- Altitude in metres, source datum not independently verified, -1,000 to 100,000. Ground speed in m/s, 0 to 500. Battery percentage, 0 to 100. Blank optional cells stay unknown. Blank time or coordinates fail import.
- Numeric unquoted cells only. BOM, LF and CRLF are accepted. Other headers, malformed cells, duplicate or reversed times fail the whole import. No silent sorting, repair or dropped rows.
- Direct MAVLink binary, PX4 ULog and vendor-specific CSV are **not** supported. Convert offline to this schema, documenting the source units, coordinate datum, altitude datum and time basis. No vendor compatibility is claimed by accepting this normalized CSV.

The parser and replay model is `skydash-flight-csv-v1`. Frontend and backend enforce the same schema. SHA-256 covers the exact decoded UTF-8 CSV, including BOM and line endings. The fingerprint detects source changes, not authorship, authenticity or tamper-evident custody.

## Replay and debrief

Scrub or play at 1x, 2x, 4x or 8x. Each position holds the latest observation at or before the selected time. There is no interpolation. Playback stops at the end. Reset returns to time zero. Intervals over five seconds show DATA GAP and break the map polyline. The full recorded track is visible, not only the portion already replayed. The marker is a recorded observation, not an estimate of current aircraft position.

The report describes the entire source independently of playback position: sample count, duration, connected-segment distance, gaps, maximum recorded altitude and speed, minimum recorded battery and channel completeness. Connected-segment distance excludes gaps and is not actual flown distance. No grades, causal claims or scenario scores are inferred. Notes are explicitly analyst-authored, not sensor observations.

Download the report and exact source CSV. These contain location data. The source and notes stay in the current browser session until Save to server, but basemap tile requests go to external map providers for the viewed area. Unsaved data is lost when leaving the workspace. New imports and opening records replace the current unsaved draft, as the UI states.

## Server archive and deployment boundary

Refresh server archive checks compatibility before enabling Save. Older backends return a clear unavailable message; local preview, replay and downloads still work. The hosted Azure frontend can run ahead of its separately deployed backend. This change does not deploy or reconfigure that backend.

With this backend version running, the archive offers:

- `GET /api/flight-logs`: metadata only.
- `POST /api/flight-logs`: title, filename, notes and CSV; server revalidates and fingerprints the source. At most 50 records. Exact duplicate sources return 409 rather than overwriting notes.
- `GET /api/flight-logs/{id}`: original CSV, fixed notes, parser version and samples. Reopen verifies the checksum and re-parses with the matching model before replay.
- `DELETE /api/flight-logs/{id}`: explicit permanent deletion. UI requires confirmation. Download first if needed.

Saved records have fixed source/title/notes, no update endpoint. They are not cryptographically immutable or tamper-evident. The shared SQLite database creates its archive table on backend startup. Reads follow the existing authentication rules, and writes require analyst or higher when auth is enabled. This is a shared deployment archive, not per-user private storage. Do not upload real logs to an unsecured demo instance.

Durability requires retaining `SKYDASH_DB_PATH` and backups. Docker Compose already mounts `skydash-data` at `/app/data` and sets the database path there. For a self-hosted Compose installation, back up the current SQLite database, pull the merged revision, then run `docker compose up -d --build backend frontend`. Keep the named volume. Reopen a saved synthetic record after a backend restart to check persistence.

For the existing Azure App Service, an operator must redeploy the backend package/container from the merged revision through that app's established release method, preserving configuration and the existing SQLite database, then verify `/openapi.json` includes `/api/flight-logs`. A retained writable database path and backup route must be verified before calling it durable. No release credential or backend deployment method is added here. No Azure infrastructure, settings, plans or billing are changed by this feature.

## Verification

Backend tests cover source validation, API contracts, duplicate rejection, bounded concurrent writes, fixed notes, scoped deletion, existing role requirements and reopening the exact record after closing the SQLite connection. Frontend tests cover parsing, deterministic seek, gap splitting, unknown readings, explicit uploads, checksum rejection, viewer restrictions, unavailable backends, failed saves, downloads and replay controls. Playwright imports an actual file, saves, reloads, reopens, downloads a report and deletes only its synthetic test record.
