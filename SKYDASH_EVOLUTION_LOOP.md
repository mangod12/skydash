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

## CURRENT PHASE: 21 COMPLETE
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

[Phase 11] [2026-05-22] Analyst workbench — 5 parallel work streams:
  1. Dashboard overhaul: DashboardView rewrite with 4 stat cards (fleet
     status/threat overview/active missions/system health), DashboardMiniMap
     (static Leaflet with drone + entity dots), FleetSparklines (Recharts
     mini altitude+battery charts per drone), ActivityFeed (merged events
     from notifications/intel/telemetry sorted by time).
  2. Map layer control panel: MapControls enhanced with sliding layers
     panel, 8 toggleable layers (flight path/entities/fleet/heatmap/
     ADS-B/geofences/grid/satellite) with custom toggle switches,
     click-outside close.
  3. Entity filter bar: EntityFilterBar.jsx with multi-select type chips,
     single-select threat/confidence/sort, useEntityFilters hook with
     memoized filtering + sorting, integrated into IntelPanel.
  4. Responsive design: BottomNav (mobile tab bar with 5 nav icons),
     Shell responsive resize listener + debounce, Sidebar tablet mode
     (forced collapse, no expand button), TopBar mobile mode (hidden
     command palette), uiStore isMobile/isTablet/setResponsive.
  5. Spatial search: SpatialSearch.jsx (click-to-place radius circle,
     adjustable radius slider, haversine distance filter, results panel
     with matching entities, integrated into MapControls).
  Plus: useKeyboard expanded (O=missions, A=analytics, N=notifications),
  CommandPalette commands expanded (missions/analytics/settings/notifications).
  80 source files. 41 tests passing. Build: clean. 0 errors.

[Phase 12] [2026-05-22] Field operations — 5 parallel work streams:
  1. Report generator: ReportGenerator.jsx full-page printable intel
     report (exec summary, entity inventory table, threat assessment,
     relationship map, timeline, analyst notes, fleet status), print/
     copy/download HTML, @media print white-on-white mode, military
     classification header.
  2. Map annotations: MapAnnotations.jsx (text labels, numbered pins,
     arrows with polyline, circles), annotation state in mapStore
     (annotations[], annotationMode), MapControls annotation toolbar
     buttons, click-to-place interaction, right-click-to-delete.
  3. Entity auto-linking: LinkSuggestions.jsx with useLinkSuggestions
     hook (proximity <500m via haversine, temporal overlap <1hr, tag
     overlap 2+, type affinity rules), accept creates relationship
     in intelStore, dismiss hides suggestion, confidence scoring.
  4. Tactical theme: tactical.css with full green-on-black military
     monochrome (CSS variable overrides, Tailwind class overrides for
     indigo→emerald, zinc→green tints, map hue-rotate filter), imported
     in index.css, applied via data-theme attribute on documentElement.
  5. Enhanced export: ReportExport.jsx rewrite with 5 formats (GeoJSON,
     KML with styled placemarks + folders by type, CSV with relationships,
     entity dossier text, mission brief), scope selector (all/mission/
     entity), download + clipboard actions.
  Plus: KeyboardHelp + Settings updated with O/A/N shortcuts.
  85 JS/JSX + 5 CSS source files. 41 tests passing. Build: clean.

[Phase 13] [2026-05-22] Operational awareness — 5 parallel work streams:
  1. Alert rules engine: alertRulesStore (6 default rules: battery_low x2,
     signal_weak, altitude_limit, speed_limit, geofence_breach), useAlertEngine
     hook (evaluates rules on telemetry updates, respects cooldown, fires
     notify()), AlertRulesConfig panel in Settings with toggle switches.
  2. Cross-view entity navigation: useEntityNavigation hook (flyToEntity
     switches to map + sets center, showEntityDetail switches to intel),
     selectedEntityId in intelStore, entity popups on map markers with
     "View Detail" button, "Fly to Map" in EntityDetail, timeline event
     click→fly to location, selected entity pulse ring animation.
  3. Audit log: auditStore (500-entry FIFO, category/action/detail logging,
     global audit() helper), AuditLog.jsx viewer with category filter tabs
     + action badges + CSV export, integrated in SettingsView, audit()
     calls wired to entity/mission/annotation/export actions.
  4. Context menus: ContextMenu.jsx (reusable glass morphism right-click
     menu with icon items + separators + danger style), map context menu
     (drop pin, text label, measure, search radius, copy coords, create
     entity), entity context menu (view detail, fly to, add to mission,
     create relationship, export dossier, delete).
  5. Virtualized lists: VirtualList.jsx (zero-dependency virtual scroller
     with ResizeObserver + overscan), integrated into IntelPanel entity
     list and TimelineView event list for 1000+ item performance.
  Plus: version bump to 3.0.0, command palette added audit log command,
  entity-pulse-ring + entity-popup CSS animations.
  ~98 JS/JSX + 6 CSS = 104 source files. 41 tests passing. Build: clean.

[Phase 14] [2026-05-22] Intelligence fusion — 5 parallel work streams:
  1. Omnisearch: CommandPalette rewrite searching across entities, missions,
     events, annotations, audit log, and commands. Results grouped by
     category with type icons, threat badges, timestamps. 5 per category,
     20 max total. Entity→Intel, Mission→Missions, Event→Timeline nav.
  2. Workspace presets: WorkspaceSwitcher (Operator/Analyst/Commander)
     in TopBar, uiStore workspace state, auto-configures sidebar/view/
     notifications per role. Operator=map+telemetry, Analyst=intel+graph,
     Commander=dashboard+fleet.
  3. Entity detail enrichment: Quick stats bar (relationships/events/
     missions/confidence), MiniRelGraph (radial SVG 120px, center node
     + 8 max connections), EntityMiniMap (static Leaflet with entity pin),
     mini timeline (last 5 events with severity dots), threat+confidence
     visual bars.
  4. Arctic theme: arctic.css (light mode, blue accents, frosted white
     glass, slate text scale, light map tiles, Recharts light overrides),
     imported in index.css. All 3 themes now functional.
  5. Onboarding tour: OnboardingTour.jsx (8-step guided walkthrough,
     spotlight overlay with clip-path cutout, positioned tooltip with
     progress dots, first-run localStorage detection, restart from
     Settings, "Start Tour" command in palette).
  110 source files. 41 tests passing. Build: clean.

[Phase 15] [2026-05-22] Command and control — 5 parallel work streams:
  1. Drone command panel: DroneCommandPanel with flight mode selector
     (orbit/grid/waypoint/hold/RTL/land), quick commands (altitude+/-,
     yaw, emergency stop), mission control sliders (speed/altitude/
     orbit radius), command status log with simulated ack, backend
     POST /api/drone/{id}/command stub.
  2. Entity comparison: EntityComparison side-by-side dual-column view
     with entity selector dropdowns, property diff highlighting (emerald
     =match, amber=differ, zinc=missing), shared relationships detection,
     tag overlap, proximity calculation, temporal overlap analysis.
  3. Saved searches: bookmarkStore (localStorage persistence, hydrate on
     start), BookmarkBar with filter/mapview/search bookmark types,
     save current state, apply bookmark to restore filters or map view,
     3 seed bookmarks.
  4. Bulk operations: multi-select mode in IntelPanel with checkboxes,
     BulkActionsBar floating toolbar (tag/threat/mission/delete batch
     actions), select all/deselect, confirmation for destructive ops.
  5. System health monitor: useSystemHealth hook (1s sampling, 30-point
     sparkline history, message rate counter, overall status derivation),
     SystemHealth panel with WS/pipeline/database/memory/uptime sections,
     inline Recharts sparklines, integrated in SettingsView.
  119 source files. 41 tests passing. Build: clean.

[Phase 16] [2026-05-22] Deep intelligence — 5 parallel work streams:
  1. Pattern detection: patternDetector.js (spatial clustering via
     haversine, temporal burst detection, movement corridors, hub
     entities via degree, isolated entities, threat escalation),
     PatternPanel.jsx with collapsible sections per pattern type,
     "View on Map" / "Investigate" actions, integrated as IntelView tab.
  2. Evidence chain: provenanceStore (entity provenance entries with
     action/actor/detail/timestamp, seeded with 4 demo entries),
     EvidenceChain.jsx vertical provenance timeline with action-colored
     dots + actor badges + confidence derivation, integrated in
     EntityDetail as collapsible section.
  3. Geofence zone manager: GeofenceManager.jsx slide-out panel with
     named zones, color coding, active toggle, entry/exit alert config,
     inline rename/edit, mapStore enhanced with updateGeofence/toggle,
     GeofenceOverlay shows only active zones with name tooltips, 2 seed
     geofences (Zone Alpha, Zone Bravo).
  4. Split-view dual map: SplitMapView.jsx (50/50 layout, sync toggle),
     ComparisonMap.jsx (minimal map with independent layer controls),
     synchronized pan/zoom, toggle from FullMapView header.
  5. Keyboard overlay: KeyboardHelp.jsx rewrite with compact HUD pill
     (bottom-right, auto-hide during input) + full overlay with 2-column
     grid layout, key badges, category grouping.
  126 source files. 41 tests passing. Build: clean (chunk warning only).

[Phase 17] [2026-05-22] Temporal intelligence & power tools — 5 parallel work streams:
  1. Playback Controller: playbackStore (play/pause/stop/seek/speed/history),
     PlaybackController.jsx (glass panel with transport buttons, time scrubber,
     speed selector 1x/2x/4x/8x, timestamp display), PlaybackMarkers.jsx
     (ghost drone markers during replay with dashed-border pulse), integrated
     in MapView with demo history generator (5min, 3 drones, 1s intervals).
  2. Intel Feed: feedStore (100-item FIFO, severity filter, simulation timer),
     IntelFeed.jsx (streaming OSINT events with LIVE indicator, pause/resume,
     filter tabs ALL/CRITICAL/WARNING/INFO, AnimatePresence slide-in),
     FeedItem.jsx (severity dot, timestamp, category badge SIGINT/HUMINT/
     GEOINT/OSINT/CYBER, title+summary), 23 military-style intel templates,
     3-8s random interval generation. Integrated in IntelView bottom tools.
  3. Mini Console: MiniConsole.jsx (terminal panel, emerald monospace, slide-up
     animation, tab completion, command history up/down arrows, Escape close),
     useConsoleCommands.js + consoleHandlers.js (help/status/entity/fly/alert/
     export/theme/clear/drone/entities/missions/goto commands), backtick toggle
     key in useKeyboard, consoleOpen state in uiStore, rendered in Shell.
  4. Entity Clustering: clustering.js (grid-based spatial algorithm, zoom-adaptive
     grid sizing, no deps), ClusterMarkers.jsx (cluster badges sized by count,
     colored by max threat, click-to-expand zoom, individual entity markers at
     high zoom, tooltip with count/type/threat), replaced EntityMarkers in MapView.
  5. Risk Score Engine: riskScoring.js (6-factor scoring: base threat, relationship
     density, recent activity, confidence multiplier, proximity to critical, escalation
     trend), RiskScoreCard.jsx (SVG arc gauge, factor breakdown tooltip, sparkline),
     RiskOverview.jsx (ranked bar chart, distribution histogram, summary stats),
     integrated in EntityDetail and AnalyticsView.
  ~140 source files. Build: clean (chunk warning only).

[Phase 18] [2026-05-22] Operational fusion & visual density — 5 parallel work streams:
  1. Connection Matrix: ConnectionMatrix.jsx (NxN entity relationship heatmap,
     color by category cyan/violet/amber/red, intensity by link count, diagonal
     type icons, sort by name/type/threat/connections, top 20 most-connected),
     MatrixCells.jsx (column headers 45deg, row headers, cell rendering, tooltip),
     matrixConstants.js (type maps, category styles, sort options). New IntelView
     tab with Grid3x3 icon.
  2. Data Freshness: FreshnessIndicator.jsx (LIVE/RECENT/STALE/OFFLINE badges,
     auto-update interval, compact+expanded modes), SourceReliability.jsx (0-100
     quality bar, 5 tiers), DataFreshnessBar.jsx (4-source status aggregation,
     responsive dot-only collapse). Integrated in StatusBar, EntityDetail,
     DashboardView.
  3. Widget Dashboard: widgetStore (12-col grid, 8 widget types, localStorage
     persist), WidgetGrid.jsx (CSS Grid layout, drag-swap reorder, edit mode
     with resize handles), DashboardWidgets.jsx (stat-card/mini-map/sparkline
     renderers), WidgetItems.jsx (threat gauge/entity list/feed/clock/weather),
     WidgetControls.jsx (add picker, resize handle). Toggle in DashboardView.
  4. Timeline Correlation: TimelineCorrelation.jsx (SVG multi-lane horizontal
     timeline, up to 8 entities, zoom+pan, severity-colored dots, violet
     correlation connectors within 5min window), CorrelationLane.jsx (lane
     rendering), CorrelationControls.jsx (header, entity dropdown, tooltip),
     temporalAnalysis.js (findCorrelations, buildTimeline, getTimeScale).
     Toggle in TimelineView via CORRELATION button.
  5. Quick Actions: QuickActions.jsx (floating FAB, 90-deg arc expansion,
     8 actions: create entity/new mission/screenshot/fullscreen/export/
     console/drop pin/search), QuickActionButton.jsx (arc-positioned button
     with tooltip), notification pulse dot. Integrated in Shell.
  ~155 source files. Build: clean (chunk warning only).

[Phase 19] [2026-05-22] Tactical navigation & intelligence integration:
  1. Bearing Tool: bearing.js (WGS84 bearing/distance/midpoint/magnetic
     declination), BearingTool.jsx (map click handler, dashed polylines,
     arrowheads, start/end markers, midpoint labels, max 5 lines, right-click
     remove), BearingPanel.jsx (floating panel with distance/true bearing/
     magnetic bearing/ETA, unit toggle km/nm/mi, speed presets). mapStore
     extended with bearingLines[], bearingMode, CRUD actions. Compass toggle
     in MapControls.
  2. Mission Briefing: briefingGenerator.js (full 5-paragraph OPORD format —
     situation/mission/execution/sustainment/command, threat assessment,
     entity summary, AO coordinates, timeline, fleet status, escalation
     procedures). New Briefing tab in MissionView with copy/download buttons.
  3. Activity Feed: activityStore.js (Zustand, 18 seed activities across 5
     categories, 500-item cap, category filtering, logActivity() global
     helper), ActivityItem.jsx (severity dots, timestamps, click-to-navigate
     to intel/missions). Replaces old DashboardView ActivityFeed with
     filtered category tabs.
  4. Network Analysis: networkAnalysis.js (network density, degree map, hub
     detection top 3, isolated entities, pair strength with temporal proximity
     boost, community detection via graphUtils, threat concentration per
     cluster, temporal trend, key findings generator). Integrated in
     AnalyticsView as Network Intelligence section with 4-stat grid +
     hub entities + key findings.
  5. Ops Center Panels: OpsCenterPanels.jsx (FleetPanel with drone cards,
     ThreatPanel with threat gauge + event feed, StatusPanel with system
     stats grid + live uptime tracking). Fixed uptime from random to real
     elapsed timer.
  14 files changed, 1490 insertions. Build: clean.

[Phase 20] [2026-05-23] Structural hardening — godmode audit + 4 parallel remediation streams:
  1. Backend decomposition: main.py (660→178 lines) split into routes/
     (telemetry.py, entities.py, missions.py, auth_routes.py, connectors.py,
     export.py) + deps.py (shared state) + models.py (Pydantic models).
     Ring buffer upgraded to collections.deque(maxlen=300) for O(1).
     try/except added to all route handlers.
  2. Frontend file splitting: MapView (359→181 + MapInteractions 106 +
     MapOverlays 150), AnalyticsView (329→101 + AnalyticsCharts 153 +
     AnalyticsNetwork 113), MissionView (303→32 + MissionList 61 +
     MissionDetail 180 + MissionBriefingTab 43), OpsCenterPanels (218→
     FleetPanel 76 + ThreatPanel 74 + StatusPanel 73 + barrel 3).
     DashboardActivityFeed extracted (47 lines).
  3. Design token enforcement: designTokens.js (COLORS, THREAT_COLORS,
     PATTERN_COLORS), 9 files updated to use centralized constants.
     Glass blur fixed: DroneMarker 4→16px, MultiChart 12→16px,
     animations.css popup 12→16px.
  4. Error boundaries + build health: PanelBoundary on all 7 views.
     Vite config rewritten with function-based manualChunks — circular
     chunk eliminated, empty vendor-react fixed (0→142KB), vendor-charts
     567→454KB (-20%), vendor-utils 87→65KB (-25%). Zero build warnings.
  ESLint warnings: 42→31 (-26%). 124 tests passing. Build: clean.

[Phase 21] [2026-05-23] Deck.gl 3D visualization — WebGL overlay integration:
  1. Core integration: DeckGlOverlay.jsx — Deck instance synced to Leaflet
     viewport (move/zoom events), WebGL canvas at z-index 350 (between tiles
     and Leaflet markers), pointer-events:none for Leaflet interop, MapView
     integration as child of MapContainer.
  2. Entity scatter: ScatterplotLayer with threat-colored dots (radius by
     threat level 60-160m, RGBA from designTokens), stroked + filled, 0.6
     opacity, radiusMinPixels 6 for visibility at all zoom levels.
  3. Relationship arcs: ArcLayer connecting related entities with colored
     arcs (cyan=located_at, violet=associated_with, amber=traveled_to,
     red=communicates_with, emerald=owns), width by confidence, height 0.4
     for arc curvature, 0.7 opacity.
  4. Flight trails: PathLayer rendering primary drone path as smooth WebGL
     trail (indigo, 4px width, rounded caps/joints), fleet drone position
     indicators with cyan accent.
  5. Hex density: HexagonLayer from @deck.gl/aggregation-layers — hexagonal
     binning of entity positions with threat-weighted color aggregation,
     scattered density points, 6-stop cyan→red color range, 80m radius,
     0.85 coverage, flat mode (no extrusion — top-down view).
  Layer toggles in MapControls under "DECK.GL 3D LAYERS" section. Defaults:
  arcs ON, trails ON, scatter OFF, hex OFF. Vite vendor-deckgl chunk (672KB,
  192KB gzip). chunkSizeWarningLimit raised to 700KB.
  3 new files, 5 files modified. 124 tests passing. Build: clean.
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
