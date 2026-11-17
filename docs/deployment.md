# Deployment Guide

SkyDash runs as two containers (FastAPI backend, static frontend behind nginx)
with a SQLite database on a named volume. It needs no outbound internet to run:
telemetry is simulated, and the ADS-B and Shodan connectors are optional. This
makes an on-premises or air-gapped install straightforward.

## Quick start (single host)

```
cp .env.example .env        # then edit, see "Production settings"
docker compose up -d --build
curl http://localhost:8001/health
```

The frontend is served on port 80, the API on port 8001. The backend image runs
as an unprivileged user (uid 10001). Data lives in the `skydash-data` volume.

## Production settings

Set these in `.env` before exposing the stack to anyone.

| Variable | Purpose |
| --- | --- |
| `SKYDASH_JWT_SECRET` | Long random value. Setting it turns on user authentication and role enforcement. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `SKYDASH_DISABLE_DEMO_USERS=1` | Do not create the built-in demo accounts. Create your own users instead. |
| `SKYDASH_ALLOW_REGISTRATION=false` | Close public self-registration. |
| `SKYDASH_CORS_ORIGINS` | Comma-separated list of the exact frontend origins. |
| `SKYDASH_MAX_BODY_BYTES` | Request body cap in bytes (default 25 MB). |
| `SKYDASH_COT_TARGET` | Optional. `udp://host:port` or `tcp://host:port`: stream CoT for every drone and geo-located entity to ATAK, WinTAK or a TAK Server input. Outbound only. `tls://host:port` targets a TAK Server TLS input. Off when unset. |
| `SKYDASH_COT_CA`, `SKYDASH_COT_CERT`, `SKYDASH_COT_KEY` | PEM files for `tls://` targets: CA bundle that signed the server (default system roots) and the client certificate and key if the server requires them. The server is always verified. |
| `SKYDASH_COT_INTERVAL` | Seconds between CoT updates (default 5, minimum 1). |
| `SKYDASH_DB_PATH` | SQLite path. Compose sets `/app/data/skydash.db`. |

Notes:

- Authentication is off unless `SKYDASH_JWT_SECRET` (or `SKYDASH_AUTH_ENABLED`)
  is set. In that mode there are no roles and no audit trail, which is fine for
  the public demo and unsafe for anything else.
- Put the stack behind a TLS-terminating reverse proxy. The backend adds HSTS
  when it sees `X-Forwarded-Proto: https`.
- Back up the `skydash-data` volume. It holds users, entities, missions and the
  audit trail.

## Offline and air-gapped use

- The backend has no required external calls. OpenSky (ADS-B) and Shodan are
  used only when their connector endpoints are called.
- The frontend loads web fonts and map tiles from public hosts by default. For
  an air-gapped site, serve fonts locally and build the frontend with
  `VITE_TILE_URL=http://tiles.internal/{z}/{x}/{y}.png` (and optionally
  `VITE_TILE_ATTRIBUTION`) to use an internal tile server. If tiles cannot be
  fetched, the map shows a graticule and a "BASEMAP OFFLINE" chip while all
  overlays keep working.
- If the backend becomes unreachable, the frontend falls back to HTTP polling
  and shows a connection-lost state instead of failing silently.

## Health and operations

- `GET /health` reports uptime, counts and connector status. It needs no login.
- Compose includes a container health check against `/health`.
- Logs go to stdout. RBAC denials are logged at WARNING level.
- See `docs/skydash-operations-runbook.md` for day-to-day operations.

## Database backups

SQLite runs in WAL mode. Do not copy only `skydash.db` while the backend is
running: recent committed data may still be in its `-wal` file. Use the snapshot
command instead (from the backend directory):

```sh
python scripts/backup_db.py --source /app/data/skydash.db /secure-backups/skydash-2026-11-17.db
```

`--source` defaults to `SKYDASH_DB_PATH`, then `skydash.db`. The destination's
parent directory must already exist and be writable. Use a new filename for
each backup; existing files and symlinks are never overwritten. The command
opens the source read-only, uses SQLite's backup API, checks snapshot integrity,
and creates a self-contained file with owner-only permissions (`0600`). It does
not import the app or seed accounts.

Only a zero exit status and `Verified backup saved` mean the snapshot completed.
A normal error removes the incomplete destination. If the process or host is
killed, discard the unfinished file and retry with a new name. Store snapshots
outside the repository, protect and encrypt them at rest, and set retention for
your deployment: they contain user password hashes, mission data and audit logs.
No backup schedule or remote upload is configured by this command.

Test restore on an isolated instance before relying on backups. For an actual
restore, stop the backend first, preserve the current database and its WAL/SHM
sidecars together, and replace them with the verified snapshot at
`SKYDASH_DB_PATH`. Do not leave old WAL/SHM files beside the restored database.
Keep the backend user's file ownership/permissions, restart, then check health,
login and expected mission/entity counts. Never restore over a running instance.

## Demo reset

For demos and training, `POST /api/demo/reset` with body `{"confirm": true}`
wipes entities, relationships, events and missions, restores the seeded demo
scenario and restarts the simulated fleet. Users and the audit trail are kept.
With authentication on it needs the commander role. Do not call it on a
system holding real data.
