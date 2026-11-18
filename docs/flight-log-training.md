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

## Two-flight debrief comparison

After loading primary A, choose Compare two flights and import a baseline B, or load the clearly synthetic baseline. Both logs use the same bounded CSV schema; no backend archive or network upload is required. Basemap tile requests still go to external providers. A source change clears its comparison. A new baseline replaces comparison notes, as stated before loading. Invalid imports preserve the last good pair and notes.

The shared cursor aligns each file's relative time zero, not UTC, takeoff, an exercise event or progress along a route. Play at 1x/2x/4x/8x, scrub, pause and reset. Paired cards show exact sample time and age. Each side holds the latest observation. A gap over five seconds is flagged and suppresses all instantaneous channel differences. Beyond either file's last timestamp, that side shows no observation, hides its marker and suppresses differences. No source is stretched to match the other.

The comparison map shows complete cyan A and dashed purple B tracks, with gaps broken. A whole-log table compares duration, sample count, connected distance, gap count, maximum recorded altitude/speed and minimum battery. These summaries cover each full source, not only their shared time range. Numeric differences are A minus B. Unknown readings stay unknown. Channel observation counts expose missing evidence. Different sample rates can change extrema. Battery percentages are not energy consumption, and altitude datums are not normalized. Do not infer skill, improvement, causation or certification from the table. Source checksum equality is flagged as the same source, not an independent flight. Different checksums do not prove different flights.

Add separate comparison notes, then download the text debrief comparison and baseline CSV. Download primary CSV with its source button above. The report contains both fingerprints, filenames, parser model versions, comparison model `skydash-flight-comparison-v1`, full-source metrics, evidence counts, alignment method and notes. It is independent of the playback cursor. Reimport both exact sources with those model versions to reproduce. The comparison is session-only: it does not alter either server record, and closing the screen removes it.

## Instructor debrief timeline

With a primary source loaded, choose Instructor debrief. Pause/scrub the source replay, choose Observation, Question or Follow-up, write an instructor note and add a marker at the cursor. Focusing the marker note pauses playback. Each marker keeps its elapsed time, category, note and discussed checkbox. Jump to a marker returns the primary replay to that elapsed time and pauses it. Markers sort by elapsed time. Up to 100 markers with 1,000 characters each; discussion summary up to 4,000 characters. Discussed is facilitation state, not passed/failed or a competence assessment. Notes are not detected aircraft events.

Context is recomputed from the CSV: last sample at or before marker time, sample age, and a gap flag for intervals over five seconds. A gap marker is not an aircraft observation at its timestamp. Source altitude datum/authenticity remain unverified. Different source fingerprints clear the timeline. These markers are not stored with the optional backend CSV archive, and no server request is made by the review panel.

Download instructor report for chronological discussion notes plus recomputed source observations. Download debrief JSON to reopen the annotations later. The sidecar carries format `skydash-instructor-debrief-v1`, CSV replay model, exact source fingerprint, marker list and summary. It contains no CSV; keep the exact source CSV separately using Download source CSV. Both report and notes can contain private information, and the report includes location coordinates.

To reopen, import the exact source CSV first, then import the debrief JSON. Files are bounded to 256KiB and strict known fields, supported model versions, matching source fingerprint, valid categories/text/booleans, unique IDs and in-range timestamps. The existing review stays intact until validation succeeds and the user confirms replacement. The imported note author's identity and content are not verified; matching hashes identify source bytes only. No imported sample observations are accepted as evidence. Invalid files preserve the current review. Review files are editable, not signed or tamper-evident. No automatic sharing.

Review data is session-only until downloaded. Leaving the workspace or changing the source discards it. Clear all requires confirmation; individual marker removal is local and does not change previous exports. Re-export after edits. A confirmed sidecar import replaces current markers/summary, not source CSV or backend records.
