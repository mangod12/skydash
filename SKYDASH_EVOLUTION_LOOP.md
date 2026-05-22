# SKYDASH EVOLUTION LOOP v1.0
## Self-Iterative Continuous Improvement Protocol
### Goal: Transform SkyDash into Palantir-level Spatial Intelligence OSINT Platform

---

## HOW TO RUN

Paste this into Claude Code (or any agentic coding assistant):

```
Read D:\skydash-main\SKYDASH_EVOLUTION_LOOP.md and execute the EVOLUTION LOOP.
Start from the current PHASE marker. After completing each cycle, update the
PHASE marker and continue to the next. Do not stop until told to.
Use parallel agents for independent tasks. Commit after each phase.
```

---

## CURRENT PHASE: 10 COMPLETE
## CURRENT CYCLE: 3

---

## EVOLUTION ARCHITECTURE

```
LOOP {
  1. ASSESS    → Read codebase, identify weakest area
  2. RESEARCH  → Pull inspiration from references below
  3. IMPLEMENT → Build the next highest-impact feature
  4. POLISH    → UI micro-interactions, animations, glass effects
  5. VERIFY    → Build passes, no regressions, screenshot review
  6. COMMIT    → Save progress, update phase marker
  7. REFLECT   → Log what changed, what's next
  GOTO 1 (next phase)
}
```

---

## PHASE 1: FOUNDATION OVERHAUL — "The Skeleton Becomes Iron Man"

### 1.1 Project Structure Refactor
Transform single-file App.jsx into modular architecture:

```
src/
  components/
    layout/
      Shell.jsx              # App shell — sidebar + topbar + content area
      Sidebar.jsx            # Collapsible nav — icon-only when collapsed
      TopBar.jsx             # Search bar, notifications, user avatar, clock
      StatusBar.jsx          # Bottom bar — connection, latency, fps counter
    map/
      MapView.jsx            # Leaflet/Mapbox GL canvas — primary view
      MapControls.jsx        # Zoom, layers toggle, measure tool, screenshot
      MapOverlays.jsx        # Heatmaps, geofences, flight paths, markers
      CoordinateDisplay.jsx  # Lat/lng under cursor, MGRS, UTM conversions
    telemetry/
      TelemetryPanel.jsx     # Refactored attitude + system status
      AltitudeChart.jsx      # Extracted altitude history
      AttitudeIndicator.jsx  # Artificial horizon (SVG animated)
      BatteryGauge.jsx       # Visual battery bar with voltage
      SignalMeter.jsx        # Signal bars visualization
    intel/
      IntelPanel.jsx         # OSINT data aggregation sidebar
      EntityCard.jsx         # Person/vehicle/building entity cards
      TimelineView.jsx       # Temporal event timeline (vertical)
      ThreatMatrix.jsx       # Risk assessment grid
    common/
      GlassCard.jsx          # Reusable glass morphism container
      MetricDisplay.jsx      # Label + big number + unit + trend arrow
      StatusBadge.jsx        # Animated status indicators
      Tooltip.jsx            # Rich hover tooltips
      CommandPalette.jsx     # Cmd+K search everything (like Raycast)
  hooks/
    useTelemetry.js          # WebSocket telemetry stream
    useMap.js                # Map state management
    useKeyboard.js           # Keyboard shortcuts
    useTheme.js              # Dark/light/tactical theme switching
  stores/
    telemetryStore.js        # Zustand store — telemetry state
    mapStore.js              # Map position, layers, markers
    intelStore.js            # OSINT entities, events, relationships
  styles/
    tokens.css               # Design tokens as CSS variables
    animations.css           # Keyframe animations library
    tactical.css             # Military/tactical theme override
  utils/
    coordinates.js           # Lat/lng <-> MGRS <-> UTM converters
    formatters.js            # Number formatting, time ago, etc.
    colors.js                # Dynamic color scales for heatmaps
```

### 1.2 Install Core Dependencies
```bash
npm install zustand leaflet react-leaflet @deck.gl/core @deck.gl/layers
npm install @deck.gl/react framer-motion lucide-react cmdk
npm install @tanstack/react-query tailwind-merge clsx
npm install date-fns mapbox-gl
```

### 1.3 Design Token System
Create CSS custom properties that power the entire UI:

```css
:root {
  /* Surface hierarchy — inspired by Palantir Foundry */
  --surface-0: #09090b;          /* Deepest background */
  --surface-1: rgba(9,9,11,0.8); /* Cards */
  --surface-2: rgba(24,24,27,0.6); /* Elevated cards */
  --surface-3: rgba(39,39,42,0.4); /* Hover states */

  /* Glass morphism layers */
  --glass-bg: rgba(9,9,11,0.55);
  --glass-border: rgba(255,255,255,0.08);
  --glass-blur: 16px;
  --glass-highlight: rgba(255,255,255,0.03); /* Top edge highlight */

  /* Accent spectrum — JARVIS/Iron Man inspired */
  --accent-primary: #6366f1;     /* Indigo — brand */
  --accent-cyan: #22d3ee;        /* Cyan — telemetry, data */
  --accent-emerald: #10b981;     /* Green — healthy, connected */
  --accent-amber: #f59e0b;       /* Amber — warning */
  --accent-red: #ef4444;         /* Red — critical, threat */
  --accent-violet: #8b5cf6;      /* Violet — intelligence data */
  --accent-blue: #3b82f6;        /* Blue — navigation, spatial */

  /* Glow effects */
  --glow-primary: 0 0 20px rgba(99,102,241,0.3);
  --glow-cyan: 0 0 20px rgba(34,211,238,0.3);
  --glow-danger: 0 0 20px rgba(239,68,68,0.3);

  /* Typography scale */
  --font-display: 'Inter', system-ui;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-hero: 4rem;
  --text-metric: 2.5rem;
  --text-heading: 1.125rem;
  --text-body: 0.875rem;
  --text-caption: 0.75rem;
  --text-micro: 0.625rem;

  /* Motion */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* Spacing rhythm */
  --space-unit: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

### 1.4 UI: The Shell
Inspiration: **Palantir Gotham** sidebar + **Iron Man JARVIS** HUD overlay feel.

**Sidebar** (60px collapsed, 240px expanded):
- Logo at top (SkyDash wordmark or icon)
- Icon buttons: Map, Telemetry, Intel, Entities, Timeline, Settings
- Each icon has tooltip on hover, glow on active
- Collapse/expand with smooth width animation
- Bottom: connection indicator + user avatar

**TopBar** (48px height):
- Left: Breadcrumb (Dashboard > Mission Alpha)
- Center: Command palette trigger (Cmd+K) with search icon
- Right: Notifications bell (badge count), UTC clock, theme toggle

**StatusBar** (28px, bottom):
- Left: "CONNECTED" dot + drone ID + latency (42ms)
- Center: GPS coordinates of drone
- Right: FPS counter + data rate (120 msg/s)

After Phase 1 complete → update CURRENT PHASE to 2.

---

## PHASE 2: THE MAP — "God's Eye View"

Inspiration: **Palantir Gotham geospatial**, **Google Earth flight mode**, **DJI Pilot 2**, drone racing FPV overlays.

### 2.1 Map Integration (Leaflet + Deck.gl)
- Dark basemap (CartoDB dark_all or Mapbox dark-v11)
- Drone position marker (animated pulsing icon with heading indicator)
- Flight path trail (gradient line — green→yellow→red based on altitude)
- Geofence circles (dashed, semi-transparent fill)
- Click-to-place waypoints for mission planning
- Smooth animated position updates (interpolate between telemetry ticks)

### 2.2 Map HUD Overlay (CSS over map canvas)
Like Iron Man's helmet display — information overlaid directly on the map:

```
+--------------------------------------------------+
| [N]                    MISSION ALPHA       14:32Z |
|  |                                                |
|  |  ╔══════════╗                                  |
|  |  ║ DRONE-01 ║ ← label follows marker          |
|  |  ╚══════════╝                                  |
|  |        ✈ ← rotates with yaw                   |
|  |       / \                                      |
|  |      /   \ ← flight path trail                 |
|  |                                                |
|  [alt: 52.3m] [spd: 1.2m/s] [hdg: 127°]         |
+--------------------------------------------------+
| LAYERS: [Satellite] [Terrain] [Heatmap] [Traffic] |
+--------------------------------------------------+
```

### 2.3 Coordinate Systems
Display coordinates in multiple formats simultaneously:
- Decimal Degrees (37.7749, -122.4194)
- DMS (37°46'29.6"N 122°25'09.8"W)
- MGRS (10SEG 49876 30789)
- UTM (10S 551122 4180710)
- What3Words integration (optional)

### 2.4 Map Tools
- **Measure**: Click-to-measure distance between points (like Google Earth)
- **Area**: Draw polygon, calculate area in km²/acres
- **Radius**: Draw circle from drone, show coverage area
- **Screenshot**: Export current map view as PNG with overlays

After Phase 2 complete → update CURRENT PHASE to 3.

---

## PHASE 3: TELEMETRY EVOLUTION — "Flight Deck"

Inspiration: **Boeing 787 glass cockpit**, **SpaceX Dragon displays**, **F-35 helmet display**, DJI Pilot 2.

### 3.1 Artificial Horizon (SVG)
Animated SVG instrument showing:
- Sky/ground split that tilts with roll/pitch
- Pitch ladder markings (5°, 10°, 15° lines)
- Bank angle indicator (top arc with tick marks)
- Heading compass rose at bottom
- Speed tape (left side, vertical)
- Altitude tape (right side, vertical)

### 3.2 Telemetry Gauges
Replace raw numbers with visual instruments:
- **Battery**: Segmented bar (green→yellow→red), voltage + percentage + time remaining estimate
- **Signal**: 5-bar strength indicator with dBm value
- **GPS**: Satellite constellation diagram (show satellites on sky dome)
- **Temperature**: Radial gauge (motor temp, ESC temp, ambient)

### 3.3 Multi-Chart Dashboard
Expandable chart area with multiple streams:
- Altitude over time (existing, enhanced)
- Battery discharge curve with prediction line
- Attitude (roll/pitch/yaw overlaid)
- Signal strength history
- Ground speed with min/max/avg
- Vibration levels (simulated accelerometer)
- All charts: time-synced cursor, zoom/pan, export CSV

### 3.4 Alert System
```
SEVERITY LEVELS:
  INFO    → Subtle blue toast, auto-dismiss 3s
  WARNING → Amber bar, stays until acknowledged
  CRITICAL→ Red flash + pulse border on entire UI + audio icon

TRIGGERS:
  Battery < 30% → WARNING "Low Battery — RTL Recommended"
  Battery < 15% → CRITICAL "Critical Battery — Emergency Landing"
  Signal < 50%  → WARNING "Weak Signal"
  GPS Sats < 6  → WARNING "Poor GPS — Position Unreliable"
  Altitude > 120m → INFO "Approaching Altitude Limit"
```

After Phase 3 complete → update CURRENT PHASE to 4.

---

## PHASE 4: OSINT INTELLIGENCE LAYER — "The Oracle"

Inspiration: **Palantir Gotham's object explorer**, **Maltego link analysis**, **Analyst's Notebook**, **Minority Report** precrime UI.

### 4.1 Entity System
Everything is an **Entity** — the fundamental unit of intelligence:

```typescript
Entity {
  id: string
  type: 'person' | 'vehicle' | 'building' | 'device' | 'event' | 'organization'
  name: string
  coordinates?: [lat, lng]
  properties: Record<string, any>
  confidence: 0-100        // How certain is this data?
  source: string           // Where did this come from?
  firstSeen: timestamp
  lastSeen: timestamp
  tags: string[]
  relationships: Relationship[]
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'
}

Relationship {
  fromEntity: string
  toEntity: string
  type: 'associated_with' | 'located_at' | 'owns' | 'communicates_with' | 'traveled_to'
  confidence: 0-100
  evidence: string
}
```

### 4.2 Entity Cards (Right Panel)
Slide-in panel showing entity details:
- Header: Entity icon + name + threat badge
- Photo/image area (placeholder or satellite crop)
- Properties grid (key-value pairs)
- Location history (mini-map with path)
- Relationships list (linked entities)
- Timeline of events involving this entity
- Confidence meter (visual bar)
- Source attribution

### 4.3 Link Analysis Graph
Force-directed graph showing entity relationships:
- Nodes = entities (colored by type, sized by importance)
- Edges = relationships (thickness = confidence)
- Click node → highlight connected subgraph
- Right-click → context menu (investigate, mark threat, add note)
- Zoom/pan with smooth animations
- Layout algorithms: force, hierarchical, circular

### 4.4 Timeline View
Vertical timeline of events:
- Each event: timestamp, description, linked entities, location
- Filter by entity, date range, event type
- Color-coded by severity
- Click event → fly to location on map
- Zoomable time axis (minutes → hours → days → weeks)

### 4.5 Threat Matrix
Grid display inspired by military threat assessment:

```
         LIKELIHOOD →
    I    |  LOW  |  MED  |  HIGH  |
  M -----+-------+-------+--------+
  P LOW  | green | green | yellow |
  A -----+-------+-------+--------+
  C MED  | green | yellow|  red   |
  T -----+-------+-------+--------+
    HIGH | yellow|  red  |  RED   |
         +-------+-------+--------+
```

Each cell contains entity count. Click to drill down.

After Phase 4 complete → update CURRENT PHASE to 5.

---

## PHASE 5: ADVANCED UI — "The JARVIS Treatment"

Inspiration: **Iron Man JARVIS/FRIDAY HUD**, **Westworld** Rehoboam interface, **Cyberpunk 2077** braindance UI, **Tron Legacy** light effects.

### 5.1 Micro-Interactions (Framer Motion)
Every interaction feels alive:
- **Cards**: Subtle scale(1.01) + shadow lift on hover
- **Buttons**: Press down effect with haptic-feel spring
- **Panels**: Slide in from edge with staggered children
- **Numbers**: Count-up animation when values change
- **Charts**: Draw-in animation on first render
- **Tooltips**: Fade + slight Y translate
- **Page transitions**: Crossfade with blur
- **Loading states**: Skeleton screens with shimmer gradient

### 5.2 Ambient Animations
Background elements that make it feel alive without distracting:
- **Grid pulse**: Faint grid lines that pulse outward from drone position
- **Scan line**: Thin horizontal line that sweeps down the map periodically
- **Data particles**: Tiny dots flowing along data connections
- **Glow breathing**: Active panel borders softly pulse
- **Noise texture**: Subtle grain overlay for depth (CSS SVG filter)

### 5.3 Command Palette (Cmd+K)
Search-everything interface (like Spotlight/Raycast):

```
┌─────────────────────────────────────┐
│ 🔍 Search commands, entities, locs  │
├─────────────────────────────────────┤
│ RECENT                              │
│   📍 Go to Drone-01                 │
│   👤 View Entity: Alpha-7           │
│ COMMANDS                            │
│   🗺️ Toggle satellite layer         │
│   📊 Show telemetry panel           │
│   🎯 Set geofence                   │
│   📷 Export map screenshot           │
│ ENTITIES                            │
│   🚗 Vehicle: SUV-Black-4892        │
│   🏢 Building: Warehouse District   │
└─────────────────────────────────────┘
```

### 5.4 Keyboard Shortcuts System
Power-user focused (like Figma/VSCode):
- `M` — Toggle map fullscreen
- `T` — Toggle telemetry panel
- `I` — Toggle intel panel
- `Space` — Play/pause telemetry stream
- `[` / `]` — Zoom map in/out
- `F` — Fly to drone
- `G` — Toggle grid overlay
- `L` — Toggle layers menu
- `Esc` — Close any panel/modal
- `?` — Show shortcuts cheatsheet

### 5.5 Theme System
Three themes with instant switching:
- **MIDNIGHT** (default): Dark zinc, indigo accents — professional
- **TACTICAL**: Pure black bg, green-on-black monochrome — military feel
- **ARCTIC**: Light mode with blue accents — daytime field ops

### 5.6 Responsive + Detachable Panels
- Every panel can be resized by dragging edges
- Panels can be popped out into separate browser windows
- Layout presets: "Operator" (map focus), "Analyst" (intel focus), "Pilot" (telemetry focus)
- Mobile: Stack to single column, swipe between views

After Phase 5 complete → update CURRENT PHASE to 6.

---

## PHASE 6: BACKEND EVOLUTION — "The Brain"

### 6.1 WebSocket Streaming
Replace HTTP polling with WebSocket for real-time data:
- `/ws/telemetry` — continuous telemetry stream
- `/ws/alerts` — real-time alert notifications
- `/ws/entities` — entity update feed
- Auto-reconnect with exponential backoff
- Binary protocol option for high-frequency data

### 6.2 API Expansion
```
POST   /api/entities              — Create entity
GET    /api/entities              — List entities (filterable)
GET    /api/entities/:id          — Get entity detail
PUT    /api/entities/:id          — Update entity
DELETE /api/entities/:id          — Delete entity
POST   /api/entities/:id/relate   — Create relationship
GET    /api/entities/:id/graph    — Get relationship graph

POST   /api/missions              — Create mission
GET    /api/missions/:id          — Get mission detail
POST   /api/missions/:id/waypoints — Add waypoint

GET    /api/geofences             — List geofences
POST   /api/geofences             — Create geofence
POST   /api/geofences/check       — Check if point is inside any geofence

POST   /api/alerts                — Create manual alert
GET    /api/alerts                — Get active alerts
PUT    /api/alerts/:id/acknowledge — Acknowledge alert

GET    /api/timeline              — Event timeline (paginated)
POST   /api/export/kml            — Export data as KML
POST   /api/export/geojson        — Export as GeoJSON
```

### 6.3 Simulation Enhancement
Multi-drone simulator with realistic scenarios:
- 3-5 drones flying different patterns (orbit, grid search, waypoint)
- Simulated entity detections (random POIs appearing)
- Weather effects on telemetry (wind gusts, temperature)
- Communication dropouts and recovery
- Emergency scenarios (low battery, GPS loss, geofence breach)

After Phase 6 complete → update CURRENT PHASE to 7.

---

## PHASE 7: DATA VISUALIZATION — "Minority Report"

Inspiration: **Minority Report** gesture interfaces, **Palantir** data fusion, **Uber Kepler.gl** geospatial viz.

### 7.1 Deck.gl Overlay Layers
- **ScatterplotLayer**: Entity positions (colored by threat level)
- **ArcLayer**: Movement paths between locations
- **HeatmapLayer**: Activity density visualization
- **HexagonLayer**: Aggregated event clustering
- **TripsLayer**: Animated vehicle/drone path replay
- **IconLayer**: Custom entity type icons on map
- **TextLayer**: Entity labels with collision avoidance
- **PolygonLayer**: Geofences, building footprints, zones

### 7.2 Temporal Playback
Time-slider at bottom of map:
- Scrub through recorded data
- Play/pause/speed controls (1x, 2x, 5x, 10x)
- Time range selection (brush to zoom into time window)
- Entities fade in/out based on their active time range
- Flight paths animate as trails

### 7.3 Split View
Two maps side-by-side for comparison:
- Left: Current live view
- Right: Historical replay or different data layer
- Synchronized pan/zoom (optional toggle)
- Useful for before/after analysis

### 7.4 Analytics Dashboard
Switchable view with rich charts:
- Entity type distribution (donut chart)
- Activity over time (stacked area)
- Threat level breakdown (horizontal bar)
- Top entities by event count (ranked list)
- Geospatial coverage statistics
- Mission duration and distance metrics

After Phase 7 complete → update CURRENT PHASE to 8.

---

## PHASE 8: POLISH & DETAILS — "The Last 10% That Takes 90% of the Effort"

### 8.1 Loading & Empty States
- Skeleton screens for every panel (shimmer animation)
- Empty states with helpful illustrations and CTAs
- Connection lost overlay with retry button
- First-run onboarding overlay explaining each panel

### 8.2 Transitions & Choreography
Stagger animations so panels feel like they "boot up":
```
0ms   — Shell background fades in
100ms — Sidebar slides in from left
200ms — TopBar slides down
300ms — Map tiles begin loading
400ms — Side panels slide in (left to right)
500ms — StatusBar slides up from bottom
600ms — Data begins streaming (numbers count up from 0)
700ms — "SYSTEM ONLINE" toast notification
```

### 8.3 Typography Details
- Tabular nums for all metrics (prevent layout shift)
- Monospace for coordinates and technical values
- Tracking-wider on section headers (like military docs)
- Subtle text-shadow on hero metrics for depth
- Truncation with tooltip for long entity names

### 8.4 Sound Design (Optional)
Audio feedback toggleable in settings:
- Soft click on button press
- Ping on new entity detected
- Alert tones (escalating with severity)
- Ambient low hum when streaming data (like JARVIS)

### 8.5 Accessibility
- Full keyboard navigation (tab order, focus rings)
- Screen reader labels on all interactive elements
- High contrast mode (WCAG AAA)
- Reduced motion preference respected
- Color-blind safe palette option (no red/green only distinctions)

### 8.6 Performance Targets
- First contentful paint: < 1.5s
- Time to interactive: < 3s
- 60fps during map pan/zoom
- < 100ms latency for telemetry display
- Bundle size: < 500KB gzipped
- Lighthouse score: > 90 for Performance

After Phase 8 complete → update CURRENT PHASE to 9.

---

## PHASE 9: ADVANCED FEATURES — "Beyond Palantir"

### 9.1 AI-Powered Analysis
- Pattern detection in entity movements
- Anomaly detection in telemetry (unusual altitude, speed, path deviation)
- Auto-clustering of related events
- Natural language query: "Show me all vehicles near the warehouse in the last 2 hours"
- Predictive path estimation (where will this entity go next?)

### 9.2 Collaboration Features
- Multi-user cursor awareness (like Figma)
- Shared annotations on map
- Chat/notes per mission
- Role-based views (Operator, Analyst, Commander)

### 9.3 Report Generation
- One-click mission report (PDF export)
- Auto-generated event summary
- Map snapshots with annotations
- Entity dossier export
- Chain-of-custody evidence trail

### 9.4 Integration Hooks
- Webhook support for external triggers
- REST API for third-party integrations
- KML/GeoJSON import/export
- ADS-B feed integration (track aircraft)
- AIS feed integration (track ships)
- OSINT API integrations (Shodan, Censys, social media)

After Phase 9 complete → mark EVOLUTION COMPLETE.

---

## REFERENCE INSPIRATION MATRIX

| Source | What to Steal | Apply To |
|--------|--------------|----------|
| **Iron Man JARVIS** | Holographic HUD overlays, ambient glow, scan-line effects, voice-activated feel | Map HUD, telemetry display, loading animations |
| **Palantir Gotham** | Entity-relationship graphs, temporal analysis, geospatial fusion, professional density | Entity system, link analysis, timeline, overall architecture |
| **Palantir Foundry** | Data pipeline visualization, ontology management, clean enterprise UI | Data flow indicators, entity type system, settings UI |
| **Minority Report** | Gesture-like scrubbing, precrime prediction UI, transparent panels | Timeline scrubber, predictive overlays, glass morphism |
| **Westworld Rehoboam** | Spherical data viz, flowing data streams, omniscient calm | Background ambient animations, data particle effects |
| **Cyberpunk 2077** | Neon accents on dark, scanlines, glitch effects, dense info panels | Color palette, micro-animations, information density |
| **Tron Legacy** | Light line aesthetics, blue-on-black, geometric precision | Grid effects, accent colors, connection visualizations |
| **DJI Pilot 2** | Clean telemetry layout, attitude indicator, map integration | Telemetry panel, artificial horizon, map controls |
| **Boeing 787 Cockpit** | Glass cockpit instruments, altitude/speed tapes, PFD layout | Telemetry gauges, altitude tape, heading indicator |
| **SpaceX Dragon** | Minimal touch interfaces, big bold metrics, status panels | Metric display components, status cards, typography |
| **F-35 HMDS** | Helmet-mounted symbology, target designation boxes, threat display | Map marker HUD labels, threat indicators, targeting |
| **Google Earth** | Smooth globe navigation, 3D terrain, measurement tools | Map interactions, terrain view, measurement tools |
| **Uber Kepler.gl** | Deck.gl layer stacking, time-series playback, heatmaps | Data visualization layers, temporal playback |
| **Figma** | Command palette, multi-cursor collaboration, panel management | Cmd+K, collaboration features, panel resizing |
| **Bloomberg Terminal** | Information density, keyboard-first, real-time data grids | Data tables, keyboard shortcuts, real-time updates |
| **r/OSINT (Reddit)** | Practitioner workflows, tool wishlists, common pain points | Feature prioritization, workflow design |
| **r/drones (Reddit)** | Pilot UX complaints, feature requests, FPV overlay preferences | Telemetry layout, map features, alert design |
| **r/geospatial** | Professional GIS workflows, coordinate system needs | Coordinate display, layer management, export formats |

---

## DESIGN PRINCIPLES (Enforce Every Phase)

1. **INFORMATION DENSITY > WHITESPACE** — Every pixel should convey data. Palantir packs 10x more info than typical SaaS. Follow that path.

2. **DARK BY DEFAULT** — Dark interfaces reduce eye strain during long ops. Reserve light themes for field work.

3. **GLASS MORPHISM + DEPTH** — Multiple transparency layers create spatial hierarchy. Background → Map → Glass panels → HUD overlays → Tooltips → Modals.

4. **MONOSPACE FOR METRICS** — All numbers in monospace. All labels in sans-serif. Never mix.

5. **ANIMATION WITH PURPOSE** — Every animation communicates state change. No decoration-only motion. But ambient "alive" effects (subtle pulses, scan lines) are OK — they communicate "system active."

6. **KEYBOARD FIRST** — Power users never touch the mouse. Every action has a shortcut.

7. **PROGRESSIVE DISCLOSURE** — Show summary first, details on demand. Entity card shows name+threat → click for full dossier.

8. **CONFIDENCE EVERYWHERE** — Every data point should show how confident we are. GPS accuracy circle on map. Confidence bar on entity properties. Signal quality affects telemetry display opacity.

9. **COLOR = MEANING** — Never use color decoratively. Cyan = data/telemetry. Green = good/connected. Amber = warning. Red = critical/threat. Violet = intelligence. Blue = spatial/navigation. Indigo = brand/primary.

10. **MILITARY PRECISION** — ALL CAPS for labels. Monospace for coordinates. Tracking-wider for headers. This isn't a consumer app — it's an operations platform.

---

## SELF-IMPROVEMENT RULES (For the Loop)

After each phase:

1. **Build check**: Run `npm run build` — must pass with zero errors
2. **Visual check**: Describe what the UI looks like now vs. before
3. **Complexity check**: No file > 200 lines. Split if exceeded.
4. **Dependency check**: Don't add packages unless necessary for the phase
5. **Regression check**: All previous features still work
6. **Update this file**: Increment CURRENT PHASE number
7. **Log changes**: Append to EVOLUTION_LOG section below

When stuck: Re-read the inspiration matrix. Pick a specific reference (e.g., "make the map controls feel like DJI Pilot 2") and implement that specific aspect.

When choosing what to build next: Always pick the thing that would make the biggest visual impact in a demo. UI > backend. Visible > invisible.

---

## EVOLUTION LOG

<!-- Append entries here as phases complete -->

```
[Phase 1] [2026-05-22] Foundation overhaul — modular component architecture,
  Zustand stores (telemetry/map/ui), Shell layout (Sidebar+TopBar+StatusBar),
  GlassCard/MetricDisplay/StatusBadge common components, Leaflet dark map
  with drone marker, basic HUD overlay, CommandPalette (Cmd+K), keyboard
  shortcuts, design token CSS vars, JetBrains Mono, Framer Motion animations.
  17 components across 6 directories. Build: clean.

[Phase 2] [2026-05-22] Map enhancement — CompassRose SVG with heading readout,
  MapControls (zoom/layers/measure/screenshot/fullscreen), CoordinateDisplay
  with 4 formats (DD/DMS/UTM/MGRS), MeasureTool with click-to-measure +
  distance overlay, DroneMarker with heading arrow + pulse animation,
  GeofenceOverlay (circle/polygon), GridOverlay, satellite tile layer toggle,
  vignette edge effect, enhanced crosshair reticle. coordinate.js utils.
  7 new map components. Build: clean.

[Phase 3] [2026-05-22] Telemetry evolution — Primary Flight Display with
  speed/altitude tapes flanking attitude indicator, SignalMeter (5-bar gauge),
  GpsSkyView (satellite constellation sky dome), MultiChart (switchable
  ALT/SPD/BAT/SIG with tab selector), enhanced TelemetryPanel layout with
  connection status + latency + flight mode. 4 new telemetry components.
  Build: clean.

[Phase 4] [2026-05-22] OSINT intelligence layer — intelStore with 5 seed
  entities + relationships + events, EntityCard with type icons + threat
  badges + tags + confidence, EntityDetail panel with properties/location/
  relationships/activity/timestamps, TimelineView (vertical timeline with
  severity dots + staggered animation), ThreatMatrix (type x threat grid
  with color-coded cells), IntelPanel with search + type filter chips,
  IntelView (3-column: list + timeline + detail), dedicated view routes
  (Dashboard/Map/Telemetry/Intel). 5 new intel components + 3 view
  components. Build: clean.

[Phase 5] [2026-05-22] Advanced UI polish — BootSequence (JARVIS-style
  startup with progress bar + boot log + logo reveal), ScanLine (ambient
  sweep effect), NoiseOverlay (film grain texture), KeyboardHelp modal
  (? shortcut), enhanced Shell with ambient effects layer. Build: clean.

[Phase 6] [2026-05-22] Backend evolution — FleetSimulator with 3 drones
  (orbit/grid/waypoint patterns), DroneSimulator with wind simulation +
  battery drain + GPS noise, EntityStore with CRUD + relationships + events,
  WebSocket /ws/telemetry streaming endpoint, full REST API (/api/entities,
  /api/timeline, /api/events, /api/export/geojson), frontend WebSocket hook
  with auto-reconnect exponential backoff + HTTP polling fallback,
  telemetryStore fleet support + activeDrone selection. Backend: 3 Python
  modules (main.py, simulation.py, entities.py). Build: clean.

[Phase 7] [2026-05-22] Data visualization — EntityMarkers on map (colored
  by threat level, sized by type), FleetMarkers for secondary drones with
  pattern-colored dots, TimelineSlider with play/pause/speed/scrub controls,
  AnalyticsView with stat cards + PieChart entity distribution + BarChart
  threat breakdown + AreaChart altitude trend + top entities ranking +
  fleet status table. Analytics nav item in sidebar. Build: clean.

[Phase 8] [2026-05-22] Polish & details — Skeleton components (SkeletonLine,
  SkeletonCard, SkeletonChart), ConnectionLost overlay with reconnecting
  spinner, Toast notification system (global toast() function, animated
  stack), Leaflet tooltip dark theme CSS, focus-visible rings for a11y,
  prefers-reduced-motion respect, Vite manual chunks code splitting
  (vendor-react/map/charts/motion/utils — main bundle now 24KB gzipped,
  no chunk > 500KB). Build: clean.

[Phase 9] [2026-05-22] Advanced features — NaturalLanguageQuery with
  client-side parser (type/threat/confidence/time/tag/name filtering),
  AnomalyDetector (2-sigma deviation + trend detection on telemetry),
  ReportExport (plaintext report + GeoJSON + CSV download), SettingsView
  (theme selector + connection info + keyboard shortcuts + about),
  integrated NLQ/anomaly/export into IntelView bottom tools panel.
  All views routed. Build: clean.

EVOLUTION COMPLETE. 64 source files. 9 phases. 0 build errors.

[Phase 10] [2026-05-22] Intelligence engine — 7 parallel work streams:
  1. Mission Workspace: missionStore (full CRUD + notes + entity linking),
     MissionView (2-col layout: mission list + tabbed detail workspace
     with entities/notes/map/timeline tabs), MissionPanel (sidebar widget),
     backend/missions.py (SQLite MissionStore with missions/mission_entities/
     mission_notes tables), 10 new REST endpoints in main.py.
  2. Advanced Link Graph: graphUtils.js (degree/betweenness centrality,
     shortest path BFS, multi-hop neighborhood, community detection via
     label propagation, cluster layout), LinkGraph.jsx rewrite with
     D3 data joins, multi-hop exploration, shift+click shortest path,
     centrality-based node sizing, community coloring, GraphToolbar,
     useGraphSimulation hook. Plus graphUtils.test.js.
  3. Notification Center: notificationStore (FIFO 50 max, 6 seed
     notifications, mark-read/dismiss/clear, global notify() helper),
     NotificationCenter.jsx (slide-from-right panel, severity dots,
     category filter tabs, click-outside close, Escape close).
  4. Activity Heatmap: HeatmapLayer.jsx (canvas-based heatmap overlay
     for Leaflet, radial gradients, additive blending, gradient colorize,
     auto-generates heat points from entity locations + threat levels +
     event density, debounced redraw on pan/zoom). Integrated in MapView.
  5. Data Sources Panel: DataSources.jsx (6 source cards: Fleet Simulator,
     ADS-B OpenSky, MAVLink, DJI SDK, OSINT Feeds, Entity Database;
     live status from stores, health bars, status dots). In SettingsView.
  6. Visual Polish: tokens.css (amber/violet glows, glass-highlight-top,
     glass-inner-shadow), tailwind.config.js (glass-elevated utility,
     tabular-nums + slashed-zero, text-glow-* utilities, explicit
     breakpoints), animations.css (alert-pulse, data-flow, slide-in-
     from-right), index.css (cyber-grid, sr-only-live, global tabular
     font features), GlassCard (elevated variant, inner shadow, ARIA).
  7. Backend WS Auth: WebSocket /ws/telemetry now validates token from
     query params when SKYDASH_API_KEY set (closes 4001 if invalid).
  uiStore: notificationOpen state + toggleNotifications/setNotificationOpen.
  Sidebar: Missions nav item (Target icon).
  TopBar: Bell wired to notification store unread count.
  Shell: NotificationCenter integrated.
  74 source files. 41 tests passing. Build: clean. 0 errors.
---
---
```

---

## QUICK-START PROMPT (Copy-Paste to Start the Loop)

```
You are an elite UI engineer building SkyDash — a Palantir-level spatial
intelligence OSINT platform. Your mission: transform the current drone
telemetry prototype into the most visually stunning, information-dense,
and operationally powerful spatial intelligence interface ever built.

Read D:\skydash-main\SKYDASH_EVOLUTION_LOOP.md for the full plan.
Read the current codebase to understand what exists.

Execute the current phase. After completing it:
1. Verify the build passes
2. Update the CURRENT PHASE marker in the evolution loop doc
3. Log what you did in the EVOLUTION LOG section
4. Immediately begin the next phase

Design References:
- Palantir Gotham/Foundry for entity graphs and geospatial fusion
- Iron Man JARVIS for HUD overlays and ambient effects
- Boeing 787 glass cockpit for flight instruments
- Bloomberg Terminal for information density
- Figma for interaction patterns (Cmd+K, panels, collaboration)

Stack: React 18 + Vite + Tailwind CSS + Zustand + Leaflet + Deck.gl +
Framer Motion + Recharts + Lucide Icons + cmdk

UI Rules:
- Glass morphism everything (backdrop-blur + transparency + thin borders)
- Monospace for all metrics and coordinates
- ALL CAPS for section labels
- Dark zinc-950 base with indigo/cyan/emerald accents
- Every animation must feel like a fighter jet HUD booting up
- Information density of a Bloomberg Terminal
- Smoothness of Apple's design language

DO NOT STOP. Keep building. Each phase should take ~30-60 minutes.
If something breaks, fix it and continue. The goal is relentless forward
progress toward the most impressive spatial intelligence platform possible.

Begin now.
```
