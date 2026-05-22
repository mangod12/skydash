# SkyDash — Spatial Intelligence OSINT Platform

## What This Is
Palantir-level spatial intelligence platform for drone operations and OSINT analysis.
React 18 + Vite + Tailwind CSS frontend, FastAPI Python backend.

## Architecture
```
skydash/frontend/src/    — React app (Vite)
  components/            — Modular UI components
    layout/              — Shell, Sidebar, TopBar, StatusBar
    map/                 — Leaflet + Deck.gl map views
    telemetry/           — Flight instruments, gauges, charts
    intel/               — OSINT entity cards, timeline, threat matrix
    common/              — GlassCard, MetricDisplay, CommandPalette
  hooks/                 — useTelemetry, useMap, useKeyboard
  stores/                — Zustand state (telemetry, map, intel)
  styles/                — Design tokens, animations, themes
  utils/                 — Coordinate converters, formatters
backend/                 — FastAPI server + drone simulator
```

## Stack
- React 18, Vite 7, Tailwind CSS 3, Zustand, Framer Motion
- Leaflet + Deck.gl (map), Recharts (charts), Lucide (icons), cmdk (command palette)
- FastAPI + Uvicorn + Pydantic (backend)
- WebSocket for real-time telemetry

## Design System
- Glass morphism: backdrop-blur(16px) + rgba surfaces + thin white borders
- Colors: zinc-950 base, indigo brand, cyan data, emerald healthy, amber warning, red critical, violet intel
- Typography: Inter sans, JetBrains Mono for metrics. ALL CAPS labels.
- Dark theme default. Military precision aesthetic.
- Every number in tabular monospace. Every animation purposeful.

## Key Rules
- No file > 200 lines. Many small files > few large.
- Immutable state. Zustand for global, useState for local.
- Components: one responsibility each. Extract early.
- CSS: Tailwind utility classes + design token CSS vars. No inline styles except dynamic values.
- Backend: REST envelope {success, data, error}. WebSocket for streaming.

## Evolution Loop
See SKYDASH_EVOLUTION_LOOP.md for multi-phase improvement plan.
Current Phase tracked there. Each phase = one major capability area.

## Commands
```bash
cd skydash/frontend && npm run dev    # Start frontend (port 5173)
cd backend && python main.py          # Start backend (port 8000)
npm run build                         # Verify build passes
```
