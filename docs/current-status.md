# SkyDash Current Status

Last verified: 2026-06-29.

## Live Release

- Frontend: https://wonderful-cliff-0325f3800.7.azurestaticapps.net
- Backend API: https://skydash-api-38666.azurewebsites.net
- API docs: https://skydash-api-38666.azurewebsites.net/docs
- WebSocket: `wss://skydash-api-38666.azurewebsites.net/ws/telemetry`
- Production code verification baseline: `c643d76061577ce6ae3027698a0d077769c4d430`.
  Docs-only commits may advance `main` without changing the deployed app/API
  bundle.

Azure resources:

- Resource group: `rg-skydash-prod`
- Static Web App: `skydash`
- Backend App Service: `skydash-api-38666`
- Backend App Service plan: `asp-skydash-api-prod`

## What Is Working

- Production frontend loads from Azure Static Web Apps.
- Production frontend talks to the Azure backend API.
- Browser opens the production telemetry WebSocket.
- Backend health reports healthy.
- Fleet telemetry returns three simulated drones.
- Drone command controls wait for backend ACK before confirming mode changes.
- OSINT ingest panel previews and imports connector entities through backend
  connector contracts.
- Telemetry CSV, entities CSV, and GeoJSON export routes are present.
- Optional mission detection routes are present and report unavailable when
  RT-DETR dependencies are not installed.
- CrewAI stack has smoke tests and can be run through Docker Compose profile
  or local `uv` commands.

## Verification Baseline

Latest local verification baseline:

- `npm --prefix skydash/frontend run lint`: passes with 2 existing warnings.
- `npm --prefix skydash/frontend run test -- --run`: 141 tests passed.
- `npm --prefix skydash/frontend run build`: passed.
- `python -m compileall backend`: passed.
- `cd backend; python -m pytest tests`: 4 tests passed.
- `cd skydash_intel_crew; uv run pytest`: 10 tests passed.

Latest production smoke baseline:

- Live HTML: HTTP 200, title `SkyDash - Spatial Intelligence OS`.
- Azure Static Web App environment: `Ready`.
- Azure backend App Service: `Running`, HTTPS-only enabled.
- Focused Playwright production smoke: 4 tests passed.
- WebSocket probe observed
  `wss://skydash-api-38666.azurewebsites.net/ws/telemetry`.

## Runtime Configuration

Frontend build variables used by CI:

- `VITE_API_URL=https://skydash-api-38666.azurewebsites.net`
- `VITE_WS_URL=wss://skydash-api-38666.azurewebsites.net`
- `VITE_ADSB_URL=https://skydash-api-38666.azurewebsites.net/api/connectors/adsb`

The frontend can derive `WS_BASE` from `VITE_API_URL` when `VITE_WS_URL` is not
set, but production CI still keeps the explicit WebSocket variable.

Backend App Service settings:

- `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- `ENABLE_ORYX_BUILD=true`
- `SKYDASH_HOST=0.0.0.0`
- `SKYDASH_PORT=8000`
- `SKYDASH_CORS_ORIGINS=https://wonderful-cliff-0325f3800.7.azurestaticapps.net`

Optional backend settings:

- `SHODAN_API_KEY` enables live Shodan connector behavior.
- `SKYDASH_API_KEY`, `SKYDASH_AUTH_ENABLED`, and `SKYDASH_JWT_SECRET` enable
  protected API/auth flows.
- `SKYDASH_RTDETR_MODEL`, `SKYDASH_RTDETR_CONFIDENCE`, and
  `SKYDASH_RTDETR_MAX_UPLOAD_BYTES` configure optional RT-DETR analysis.

## Current Limits

SkyDash is not production surveillance software.

- The public fleet is simulated.
- Real drone adapters are not wired into the production API.
- Public demo auth is intentionally open for review.
- SQLite is the current persistence layer.
- Shodan is mock/unavailable until credentials are configured.
- Optional RT-DETR vision is not installed in the base Azure App Service.
- Backend deploy is manual zip deploy; frontend deploy is automated through
  GitHub Actions.

## Next Production Work

The highest-value hardening steps are:

1. Add backend CI/CD for Azure App Service.
2. Add a production database option and migration path, likely PostgreSQL/PostGIS.
3. Add authenticated demo mode with least-privilege read-only access.
4. Add connector secrets management and deployment-specific configuration docs.
5. Add monitoring/log retention for API health, WebSocket errors, and connector
   failures.
6. Keep real-drone work read-only until SITL/log replay, safety gates, and
   operator confirmation are designed.
