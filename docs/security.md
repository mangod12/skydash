# Security Model

SkyDash is an engineering prototype (see `docs/safety-and-scope.md`). This page
describes what the code enforces today so a reviewer can assess it.

## Authentication

- Enabled by setting `SKYDASH_JWT_SECRET`. Tokens are HS256 JWTs valid for 24
  hours. Without the variable, an ephemeral secret is generated and tokens are
  invalid after a restart.
- Passwords are stored as salted PBKDF2-SHA256. Legacy SHA-256 hashes are
  upgraded on next login.
- Failed logins are throttled per client and username (5 failures per minute).
- WebSocket telemetry requires the same token, passed as `?token=`.
- Alternatively, `SKYDASH_API_KEY` protects the API with a single shared key
  (no per-user identity, roles or audit).

- The web UI signs a user out after 15 minutes without input and warns for the
  last minute. Set `VITE_IDLE_TIMEOUT_MINUTES` at build time to change it
  (`0` disables).

## Roles

Ordered from lowest to highest: viewer, analyst, operator, commander.

| Action | Minimum role |
| --- | --- |
| Read any data (GET) | any signed-in user |
| Create, change or delete entities, missions, notes, imports | analyst |
| Send drone commands, reset the simulation | operator |
| Read the audit trail (`GET /api/audit`) | commander |
| Reset demo data (`POST /api/demo/reset`) | commander |

Self-registration always creates an analyst. Closing it entirely is a setting
(`SKYDASH_ALLOW_REGISTRATION=false`). Requests below the required role get
`403` and are logged.

New passwords (registration) must be at least 8 characters (raise with
`SKYDASH_MIN_PASSWORD_LENGTH`), mix two character classes, avoid common
passwords and not contain the username. Rejections return `422`.

Signing out calls `POST /api/auth/logout`, which revokes the token's `jti`
until its natural expiry, so a copied token stops working immediately. Tokens
issued before this change have no `jti` and simply expire.

## Audit trail

With authentication on, every state-changing request and every auth attempt is
stored in the `audit_log` table: time, username, role, method, path, status and
client address. Request bodies are never stored. Denied and failed requests are
recorded too. Query with `GET /api/audit?limit=100&username=...&since=...`
(commander only). `GET /api/audit/export` returns the same data as CSV (up to 10000 rows; formula-like cells are neutralised for spreadsheets), and commanders also get a SERVER CSV button in Settings.

## Transport and hardening

- Responses carry `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy`. HSTS is
  added behind HTTPS.
- Request bodies over `SKYDASH_MAX_BODY_BYTES` are rejected with `413`.
- The backend container runs as a non-root user.
- CORS is limited to `SKYDASH_CORS_ORIGINS`.

## Supply chain

- A Dependency Audit workflow runs `pip-audit` and `npm audit` weekly and on
  pull requests that change dependency files.
- CI runs backend tests with a coverage floor, frontend tests, a bundle-size
  budget, a Docker build and Playwright end-to-end tests.

## Known gaps

These are not done yet and should be planned before any real deployment:

- No user management API or UI (users are created in the database or by
  registration).
- No multi-factor authentication or SSO.
- SQLite is single-node; there is no replication.
- Telemetry is simulated. The MAVLink and DJI adapters are not hardened.
- No automated penetration testing.
