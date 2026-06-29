# SkyDash Operations Runbook

## Local Company Stack

SkyDash runs locally through Docker Compose:

- Frontend: http://localhost
- Backend API: http://localhost:8001
- Backend health: http://localhost:8001/health
- Frontend proxied health: http://localhost/health
- Telemetry WebSocket: ws://localhost/ws/telemetry

## Start

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:8001/health
```

The backend container must show `healthy` before treating the stack as ready.

## Stop

```powershell
docker compose down
```

Use targeted process cleanup only for confirmed port conflicts. For example, if port 8001 is held by a non-SkyDash process, identify it before stopping it:

```powershell
Get-NetTCPConnection -LocalPort 8001 -State Listen | Select-Object OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object ProcessId,CommandLine
Stop-Process -Id <PID>
```

## Verification Gate

Run these before declaring the stack operational:

```powershell
python -c "import fastapi, uvicorn, pydantic, websockets, requests, jwt; print('backend deps ok')"
npm --prefix skydash/frontend run lint
npm --prefix skydash/frontend run test
npm --prefix skydash/frontend run build
docker compose config --quiet
$env:PLAYWRIGHT_BASE_URL='http://localhost'; $env:PLAYWRIGHT_API_URL='http://localhost:8001'; npx playwright test
```

Expected current result:

- Frontend unit tests: 124 passing tests.
- Playwright E2E: 46 passing tests.
- `npm --prefix skydash/frontend audit --omit=dev`: 0 production vulnerabilities.

## Mimo/CrewAI Company Operating Plan

The local CrewAI readiness tool lives in `skydash_intel_crew`.

Docker profile:

```powershell
docker compose --profile crew run --rm crewai
```

Set `MIMO_API_KEY` and `MIMO_BASE_URL` in `.env`, or set `OPENAI_API_KEY` and
`OPENAI_API_BASE` for any OpenAI-compatible endpoint. The profile writes reports
to `skydash_intel_crew/reports/`. Set `SKYDASH_CREW_DATE=YYYY-MM-DD` when the
report must use a specific local operating date.

Local CLI:

```powershell
cd skydash_intel_crew
$env:OPENAI_API_KEY=$env:MIMO_API_KEY
$env:OPENAI_API_BASE=$env:MIMO_BASE_URL
$env:OPENAI_BASE_URL=$env:MIMO_BASE_URL
$env:MODEL='openai/mimo-v2.5-pro'
$env:SKYDASH_API_URL='http://localhost:8001'
uv run skydash_intel_crew 'SkyDash company operating readiness from the live Docker stack'
```

Report output:

```text
skydash_intel_crew/reports/skydash_company_ops_plan.md
```

On Windows, CrewAI may print console encoding warnings for emoji log events. Treat exit code 0 and report creation as the success signal.

## Current Operating Gaps

- Backend health reports 3 backend entities while the frontend demo store contains 8 analyst-demo entities. Tests cover both surfaces explicitly.
- Shodan connector reports unavailable/mock mode until configured with live credentials.
- No active missions are running by default.
- Local Docker Compose is a demo/prototype operating stack, not hardened production hosting.
