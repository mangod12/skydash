# Demo walkthrough (10 minutes)

A scripted run for a technical audience. Everything shown is simulated: the fleet,
telemetry and entities are generated, and the TAK output is real CoT but outbound only.
Say so at the start. It builds trust faster than a polished claim.

## Before you start (2 minutes)

1. Start the stack as in [deployment.md](deployment.md) with authentication on
   (`SKYDASH_JWT_SECRET` set) and `SKYDASH_DISABLE_DEMO_USERS=1`. Create your own
   accounts with the register endpoint or the user admin API and give them roles.
2. Reset to a known state: `POST /api/demo/reset` with `{"confirm": true}` as a commander.
3. Optional: point `SKYDASH_COT_TARGET` at a listening TAK client or a `nc -lu` terminal.
4. Open the dashboard in a signed-out browser window. Use the dark (Midnight) theme.

## Script

| Time | Show | Say |
|---|---|---|
| 0:00 | Sign-in screen, then the dashboard | "One screen: fleet status, threat score, active missions, system health. Data sources show LIVE, RECENT or OFFLINE honestly." |
| 1:30 | Top bar | "Your name and role are shown top right. The workspace buttons only change layout; permissions come from your account." |
| 2:00 | Map (key `M`) | "Drones, entities, geofences and the heatmap. Basemap tiles can be self-hosted (`VITE_TILE_URL`); if they fail you get a BASEMAP OFFLINE chip and overlays keep working." |
| 3:30 | Intel (key `I`) | "Entities, link analysis, threat matrix. Filters can be saved as bookmarks." |
| 4:30 | Scenario Lab (key `L`) | "Run a scenario, change speed, read the scorecard: coverage, risk reduced, battery, detections." |
| 6:00 | TAK terminal | "Same positions leave as CoT over UDP, TCP or TLS. Outbound only; nothing comes back in." |
| 7:00 | Sign in as a viewer in a second window | "Viewers read only. The controls are hidden, and the server refuses them anyway." Try a drone command to show the 403. |
| 8:00 | Settings > Accounts (commander) | "A commander changes a role or disables an account. A disabled account loses its session immediately, including the live data stream." |
| 9:00 | Settings > Audit log, Server CSV | "Every change and every sign-in attempt, including failed ones, is recorded. Export it as CSV for review." |
| 9:45 | Close | "Hardening is opt-in and documented in [security.md](security.md): rate limits, session lifetime, idle timeout, password policy, proxy headers." |

## If something goes wrong

- Map tiles blank: expected offline. Point at the BASEMAP OFFLINE chip and carry on.
- Stream shows OFFLINE: the app falls back to HTTP polling and says so in the banner. Reload once.
- After the demo: `POST /api/demo/reset` again so the next run starts clean.

## What not to claim

- No real aircraft are connected. Telemetry is simulated.
- It is not accredited or certified for any classification level.
- The TAK link is a one-way feed, not a full TAK integration.
- Scenario scores are simulation outputs, not performance measurements.
