# SkyDash Operations Runbook

This runbook is the operational source for running, verifying, deploying, and
resetting SkyDash.

## Live Production Demo

- Frontend Static Web App: https://wonderful-cliff-0325f3800.7.azurestaticapps.net
- Backend API: https://skydash-api-38666.azurewebsites.net
- Backend health: https://skydash-api-38666.azurewebsites.net/health
- API docs: https://skydash-api-38666.azurewebsites.net/docs
- Telemetry WebSocket: `wss://skydash-api-38666.azurewebsites.net/ws/telemetry`
- Azure resource group: `rg-skydash-prod`
- Static Web App: `skydash`
- App Service: `skydash-api-38666`
- App Service plan: `asp-skydash-api-prod`

Production demo boundaries:

- The fleet is simulated.
- Shodan is mock/unavailable until `SHODAN_API_KEY` is configured.
- Optional RT-DETR routes return unavailable unless vision dependencies are
  installed.
- Auth routes exist, but the public demo is open for review.

## Local Company Stack

SkyDash runs locally through Docker Compose:

- Frontend: http://localhost
- Backend API: http://localhost:8001
- Backend health: http://localhost:8001/health
- Frontend proxied health: http://localhost/health
- Telemetry WebSocket: `ws://localhost/ws/telemetry`

Start:

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:8001/health
```

The backend container must show `healthy` before treating the stack as ready.

Stop:

```powershell
docker compose down
```

Use targeted process cleanup only for confirmed port conflicts. For example, if
port 8001 is held by a non-SkyDash process, identify it before stopping it:

```powershell
Get-NetTCPConnection -LocalPort 8001 -State Listen | Select-Object OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object ProcessId,CommandLine
Stop-Process -Id <PID>
```

## Local Verification Gate

Run these before declaring the stack operational:

```powershell
python -m compileall backend
cd backend; python -m pytest tests; cd ..
npm --prefix skydash/frontend run lint
npm --prefix skydash/frontend run test -- --run
npm --prefix skydash/frontend run build
cd skydash_intel_crew; uv run pytest; cd ..
docker compose config --quiet
$env:PLAYWRIGHT_BASE_URL='http://localhost'; $env:PLAYWRIGHT_API_URL='http://localhost:8001'; npx playwright test
```

Current expected baseline:

- Frontend unit tests: 141 passing Vitest tests.
- Backend tests: 4 passing pytest tests.
- CrewAI smoke tests: 10 passing pytest tests.
- Playwright E2E: 74 test cases in 5 spec files.
- Frontend lint: passes with 2 existing warnings.
- Frontend production build: passes.
- Backend compileall: passes.

## Production Smoke Gate

Use this after any live deploy:

```powershell
$frontend = 'https://wonderful-cliff-0325f3800.7.azurestaticapps.net'
$api = 'https://skydash-api-38666.azurewebsites.net'

Invoke-RestMethod "$api/health"
Invoke-RestMethod "$api/telemetry"

$env:PLAYWRIGHT_BASE_URL=$frontend
$env:PLAYWRIGHT_API_URL=$api
npx playwright test e2e/skydash.spec.js e2e/interactions.spec.js -g "app boots|backend API returns fleet telemetry|drone command panel uses backend ACK|OSINT ingest panel previews"
```

Verify the browser opens the production WebSocket:

```powershell
@'
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const sockets = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));
  await page.goto('https://wonderful-cliff-0325f3800.7.azurestaticapps.net', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await browser.close();
  console.log(JSON.stringify({ sockets }, null, 2));
  if (!sockets.some((url) => url.startsWith('wss://skydash-api-38666.azurewebsites.net/ws/telemetry'))) {
    process.exit(1);
  }
})();
'@ | node -
```

Reset the live simulator after smoke tests:

```powershell
Invoke-RestMethod -Uri 'https://skydash-api-38666.azurewebsites.net/reset' -Method Post
```

Baseline after reset:

- `ALPHA-1`: `orbit` / `ORBIT`
- `BRAVO-2`: `grid` / `GRID`
- `CHARLIE-3`: `waypoint` / `WAYPOINT`

## Frontend CI/CD

GitHub Actions workflow:

```text
.github/workflows/skydash-azure-static-web-apps.yml
```

Required GitHub repository variables:

- `VITE_API_URL=https://skydash-api-38666.azurewebsites.net`
- `VITE_WS_URL=wss://skydash-api-38666.azurewebsites.net`
- `VITE_ADSB_URL=https://skydash-api-38666.azurewebsites.net/api/connectors/adsb`

Required GitHub repository secret:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`

The workflow runs lint, frontend tests, build, and Static Web Apps deploy for
pushes to `main` that touch `skydash/frontend/**` or the workflow file. It can
also be triggered manually:

```powershell
gh workflow run skydash-azure-static-web-apps.yml --repo mangod12/skydash --ref main
gh run list --repo mangod12/skydash --workflow skydash-azure-static-web-apps.yml --limit 3
```

## Backend Azure Deploy

Backend deploy is currently direct zip deploy to Azure App Service:

```powershell
$deployDir = Join-Path (Get-Location) '.deploy'
if (Test-Path -LiteralPath $deployDir) {
  Remove-Item -LiteralPath $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir | Out-Null
$zip = Join-Path $deployDir 'skydash-backend.zip'
Compress-Archive -Path @('backend\*.py','backend\requirements.txt','backend\requirements-vision.txt','backend\routes') -DestinationPath $zip -Force
az webapp deploy -g rg-skydash-prod -n skydash-api-38666 --src-path $zip --type zip --async false
```

Important App Service settings:

- `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- `ENABLE_ORYX_BUILD=true`
- `SKYDASH_HOST=0.0.0.0`
- `SKYDASH_PORT=8000`
- `SKYDASH_CORS_ORIGINS=https://wonderful-cliff-0325f3800.7.azurestaticapps.net`
- HTTPS-only enabled.

Verify:

```powershell
az webapp show -g rg-skydash-prod -n skydash-api-38666 --query "{state:state,defaultHostName:defaultHostName,httpsOnly:httpsOnly}" -o json
Invoke-RestMethod https://skydash-api-38666.azurewebsites.net/health
```

## Direct Frontend Deploy

Use direct deploy only when bypassing GitHub Actions intentionally:

```powershell
$env:VITE_API_URL='https://skydash-api-38666.azurewebsites.net'
$env:VITE_WS_URL='wss://skydash-api-38666.azurewebsites.net'
$env:VITE_ADSB_URL='https://skydash-api-38666.azurewebsites.net/api/connectors/adsb'
npm --prefix skydash/frontend run build
$token = az staticwebapp secrets list -n skydash -g rg-skydash-prod --query "properties.apiKey" -o tsv
npx -y @azure/static-web-apps-cli@latest deploy .\skydash\frontend\dist --env production --deployment-token $token
```

## CrewAI Company Operating Plan

The CrewAI readiness tool lives in `skydash_intel_crew`.

Docker profile:

```powershell
docker compose --profile crew run --rm crewai
```

Local CLI:

```powershell
cd skydash_intel_crew
$env:SKYDASH_API_URL='http://localhost:8001'
$env:SKYDASH_FRONTEND_URL='http://localhost'
uv run skydash_intel_crew 'SkyDash company operating readiness from the live stack'
```

Report output:

```text
skydash_intel_crew/reports/skydash_company_ops_plan.md
```

LLM providers:

- OpenAI: set `OPENAI_API_KEY`.
- OpenRouter: set `OPENROUTER_API_KEY` and a model such as
  `openrouter/openai/gpt-4o-mini`.
- Mimo/OpenAI-compatible: set `OPENAI_API_KEY`, `OPENAI_API_BASE`,
  `OPENAI_BASE_URL`, and a compatible `MODEL`.

On Windows, CrewAI may print console encoding warnings for emoji log events.
Treat exit code 0 and report creation as the success signal.

## Current Operating Gaps

- No production database service; SQLite is used for demo/local persistence.
- No backend CI/CD workflow yet; backend Azure deploy is manual.
- Shodan is mock/unavailable without live credentials.
- RT-DETR vision is optional and not installed in the base Azure App Service.
- No active missions are running by default after reset.
- Public demo auth is intentionally open for evaluation.
