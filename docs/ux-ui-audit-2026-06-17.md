# SkyDash UX/UI Audit

Date: 2026-06-17
Local app reviewed: http://127.0.0.1:4174
Backend reviewed: http://127.0.0.1:8001

## Method

This audit used the local production preview, backend health checks, Playwright navigation, screenshots, DOM inventory, and parallel code review of shell, operational, intelligence, mission, analytics, settings, and accessibility surfaces.

Playwright inventory covered desktop, mobile, command palette, keyboard help, notification center, mini console, and the primary app routes. The live UI exposed 831 visible elements during the pass. The inventory found 67 unlabeled buttons and 318 small button-like controls. Some of those are acceptable dense desktop controls, but the count is high enough to create mobile and accessibility risk.

This report covers every visible element type by element family and screen. Repeated instances such as filter chips, map buttons, cards, tabs, and rows are evaluated as groups because their UX role and problems repeat.

## Executive Verdict

SkyDash has a strong visual identity and a credible tactical dashboard feel. The main UX problem is not lack of capability. It is that too many controls, status indicators, demo artifacts, and overlays compete at the same time. The interface is impressive for a demo, but an operator would need clearer hierarchy, fewer duplicated controls, and stronger separation between live operations and simulation.

Highest-risk issues:

1. Mobile navigation is incomplete. Several desktop destinations are not reachable from the mobile bottom nav.
2. Fixed bottom and bottom-right controls collide on mobile: bottom nav, status bar, toasts, keyboard help, and quick actions compete for space.
3. Some global actions promise behavior they do not complete, especially command palette and quick action entries.
4. Many icon-only controls rely on hover titles instead of explicit accessible names.
5. Map and telemetry duplicate the same data and controls, making telemetry feel like a second map view rather than a focused telemetry workflow.
6. Simulation and live operation states are visually mixed, which can damage trust.
7. Several forms and modal-like panels are visually usable but not semantic or keyboard-safe.

## Priority Recommendations

### P0: Fix Navigation, Reachability, And Collisions

- Add a mobile `More` destination or a mobile drawer so `Analytics`, `Entities`, `Timeline`, and `Settings` are reachable.
- Offset or remove the mobile status bar when the fixed bottom nav is present.
- Move toast placement above the bottom nav and safe area.
- Consolidate bottom-right utilities into one global cluster. Do not let keyboard help, quick actions, notifications, mini console, and toasts occupy the same corner.
- Add accessible names to all icon-only controls, especially sidebar collapse, map controls, toast close, modal close, command buttons, and dismiss buttons.

### P0: Remove Misleading Or Incomplete Actions

- Remove command palette entries that have no handler, or wire them fully.
- Make `New Mission` open mission creation instead of only navigating.
- Make `Export Report` generate or open a real export flow instead of navigating to Intel.
- Scope screenshot and fullscreen actions to the current map instance instead of querying the first `.map-container`.
- Make keyboard help truthful: either implement Escape close inside the overlay or remove that shortcut claim.

### P1: Simplify Operational Hierarchy

- Make the dashboard top area answer four questions only: system state, active alert, active mission, and fleet health.
- Demote secondary analytics, radar, comms, and detailed telemetry below the first fold.
- Label synthetic or generated data clearly as simulation. Synthetic comms on a live dashboard weakens trust if not labeled.
- Replace the horizontal alert timeline with a critical-first severity queue or vertical incident list.

### P1: Separate Live Operations From Scenario Simulation

- Add a clear `Scenario simulation` mode banner and layer toggle.
- Make simulated assets visually distinct from live telemetry.
- Collapse scenario summary on the dashboard unless the active scenario is intentionally driving the operational state.
- Use a dedicated scenario-control strip for selected scenario, selected fleet, simulation status, speed, launch, step, and reset.

### P1: Make Map And Telemetry Distinct

- Keep one timeline/playback surface. The map currently has both `TimelineSlider` and `PlaybackController`.
- Default map layers to operational essentials, then offer `Analysis` and `Training` presets.
- Group the map right rail by purpose: navigation, layers, analysis, annotations, geofences, export.
- Use a telemetry-specific map variant in Telemetry View with minimal overlays.
- When telemetry panel is open, reduce duplicate HUD metrics on the map.
- Add stronger armed/offline gating and confirmation for high-impact drone commands.

### P1: Improve Form And Modal Semantics

- Use real forms for mission creation, alert rule creation, entity creation, and report generation.
- Add visible labels or programmatic labels to all inputs. Placeholders are not labels.
- Add `role="dialog"`, `aria-modal`, focus trap, Escape close, scroll lock, and labelled titles to modal-like surfaces.
- Add validation for mission names, coordinates, thresholds, and required fields.
- Add confirmation or undo for destructive actions.

## Element Evaluation Matrix

### Global Shell

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop sidebar navigation | Provides persistent route access across app surfaces. | Essential on desktop. | Mostly clear, but `Entities` and `Timeline` are unclear because they route into Intel without selecting a matching subview. | Expected left rail placement. | Strong visual consistency. | Keep, but remove or deep-link `Entities` and `Timeline`. Add `aria-label`s to collapsed icon links and the collapse button. |
| Mobile bottom navigation | Gives thumb-accessible route switching. | Essential on mobile. | Short labels like `Tele` and `Miss` are understandable to returning users but weak for first-time users. | Expected bottom placement. | Consistent with mobile app patterns. | Incomplete route coverage blocks mobile flow. Add `More` or drawer and use full accessible labels. |
| Sidebar collapse control | Lets desktop users reclaim workspace. | Useful, not essential. | Icon-only with no accessible name. | Expected at sidebar bottom. | Matches tactical compact control style. | Add `aria-label`, tooltip on focus, and a larger target. |
| Top bar page title | Confirms current surface. | Essential. | Clear. | Expected top-left within shell. | Consistent. | Keep. It anchors orientation well. |
| Top bar search / command trigger | Opens global command palette. | Useful for power users. | Clear on desktop. Hidden on mobile. | Expected top bar placement. | Consistent with command-k pattern. | Keep on desktop. Add a mobile affordance or include in `More`. |
| Workspace switcher | Suggests Operator, Analyst, Commander context switching. | Questionable unless it changes visible behavior. | Ambiguous because the impact is not obvious. | Top bar placement is plausible. | Looks consistent but behaves like a false affordance if state is shallow. | Remove until it changes layout/permissions, or rename to `View mode` and show visible effects. |
| Info/help button | Opens onboarding/help. | Useful. | Icon-only and small. | Top bar is expected. | Consistent with utility controls. | Add `aria-label`, larger hit area, and make mobile help path explicit. |
| Notification button | Opens notification center. | Essential for alert-driven UI. | Clear enough with bell icon and badge. | Expected top-right. | Consistent. | Keep. Ensure drawer is responsive and item actions are accessible. |
| Notification center | Shows operational notifications and filters. | Essential if alerts matter. | Filter labels are clear; dismiss controls are hover-heavy. | Right drawer is expected on desktop. | Consistent with shell overlay style. | Make mobile full-width or `max-w-sm`; expose dismiss controls on touch/focus; add accessible names. |
| Quick actions FAB | Provides shortcuts to common global actions. | Useful only if actions are real. | Mixed. Some actions are clear, some are misleading. | Bottom-right conflicts with keyboard help/toasts. | FAB pattern is inconsistent with dense ops UI if overloaded. | Reduce to 3 to 5 high-value actions or move into command palette. Wire each action fully. |
| Command palette | Fast navigation and actions. | Useful for expert users. | Search is clear, but placeholder/no-op actions reduce trust. | Modal center is expected. | Consistent with power-user UI. | Keep navigation and fully wired actions. Remove incomplete actions. Add labels and Escape handling. |
| Keyboard help pill and overlay | Helps users discover shortcuts. | Useful, not essential. | Overlay content is clear, but Escape claim is not implemented locally. | Bottom-right pill conflicts with other fixed controls. | Visual style consistent. | Move to help/settings or merge with global utilities. Fix Escape behavior. |
| Mini console | Expert command entry/debug surface. | Optional. | Clear to technical users, obscure to normal operators. | Overlay bottom placement is plausible. | Consistent tactical styling. | Keep hidden behind explicit expert access. Add input label and close button accessible name. |
| Status bar | Shows connection, fleet, and environment state. | Essential for ops confidence. | Clear on desktop. | Bottom placement works on desktop. | Consistent. | On mobile it conflicts with bottom nav. Offset it or hide summary state behind top/bottom nav. |
| Data freshness bar | Communicates which data sources are live, degraded, simulated, or planned. | Essential because live/demo distinction matters. | Clear on desktop. Mobile shows clipped expanded details plus dots. | Dashboard top placement is strong. | Consistent with status components. | Hide expanded source labels on small screens and show a clean compact summary. |
| Toast notifications | Provides transient feedback. | Essential for action feedback. | Message text is clear; close control is tiny and unlabeled. | Desktop bottom-right works. Mobile overlaps bottom nav. | Consistent. | Move above mobile nav/safe area; add larger close target and `aria-label`. |
| Connection lost overlay | Blocks the UI when backend is unavailable. | Too strong for an ops dashboard. | Clear but heavy-handed. | Full-screen overlay is disruptive. | Inconsistent with graceful degraded-mode expectations. | Convert to banner/sheet with retry and cached-read access unless the app truly cannot function. |
| Onboarding tour | Introduces core regions. | Useful for first run. | Copy is useful, but desktop selectors fail on mobile. | Overlay placement depends on target availability. | Matches product tour pattern. | Use separate mobile and desktop steps or skip unavailable targets. |

### Dashboard

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard header actions | Provide layout customization and overview context. | Useful. | `Widgets` label is vague. | Top-right is expected. | Consistent button styling. | Rename to `Customize layout` or make it a segmented view control. |
| Scenario summary card | Shows active simulation state on dashboard. | Conditional. | Clear when a scenario is active. | Near top makes simulation prominent. | Consistent with scenario lab. | Collapse to a slim banner unless scenarios are core to live dashboard operation. |
| Stat cards | Summarize fleet, alert, mission, and intel counts. | Essential. | Clear labels and values. | Top grid is expected. | Consistent. | Keep, but prioritize operational metrics and avoid duplicates with status bar. |
| Alert timeline | Shows recent alert progression. | Essential in incident context. | Horizontal cards can truncate event text. | Top area is valuable. | Consistent card style. | Replace with vertical critical-first queue for faster scanning. |
| Threat gauge | Visualizes aggregate threat level. | Useful. | Strong visual signal. | Right-side summary placement works. | Consistent. | Keep if tied to real calculation; provide text explanation and trend. |
| Mission progress card | Shows active mission status. | Essential when mission exists. | Clear. | Good near top. | Consistent. | Keep. Link directly to selected mission. Auto-select active mission on mission screen. |
| Intel summary | Surfaces entity/intelligence state. | Useful. | Clear at summary level. | Dashboard mid-card is acceptable. | Consistent. | Keep as summary only; avoid duplicating full Intel controls. |
| Fleet table | Shows drone status and health. | Essential. | Clear, but dense. | Main dashboard area is appropriate. | Consistent. | Keep. Add responsive row stacking on small widths and avoid false dummy rows. |
| Embedded map / radar / telemetry summaries | Gives spatial and sensor context. | Useful but not all first-order. | Individually clear, collectively crowded. | Below key metrics is reasonable. | Consistent. | Demote secondary visualizations below first fold or let operator customize order. |
| Comms log | Provides recent communication stream. | Useful if real. | Looks real even when synthetic. | Dashboard lower area is fine. | Consistent. | Label simulated comms or hide until real data is available. |
| Activity feed | Shows recent system changes. | Useful. | Clear. | Lower dashboard placement works. | Consistent. | Keep, but merge with notifications if content overlaps. |

### Scenario Lab

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Scenario cards | Let users choose live training/demo scenario. | Essential to lab flow. | Strong: objective, location, status, and effects are visible. | Prominent grid/rail is expected. | Consistent. | Keep selected scenario prominent. Replace hidden horizontal overflow with compact selector on narrower screens. |
| Fleet preset cards | Configure drone composition for a simulation. | Essential for configurable demos. | Clear; disabled state explains reset requirement only indirectly. | Near scenario selection is logical. | Consistent. | Add tooltip or inline reason for disabled state. |
| Live inject controls | Let users add dynamic events to the scenario. | High value for interactivity. | Clear enough; domain terms may need hover details. | Side/lower placement is acceptable after scenario/fleet. | Consistent. | Keep. Add active inject history and undo/reset per inject. |
| Launch / step / speed / reset controls | Runs and controls the simulation. | Essential. | `+30S` is less clear than `STEP +30S`. | Current placement appears before the full context is absorbed. | Consistent button style. | Move into one mission-control strip with selected scenario, fleet, status, and speed. |
| Scenario status label | Communicates current scenario mode. | Essential. | `STATIC SAFETY RESPONSE` conflicts with live backend wording. | Near controls is appropriate. | Consistent but semantically confusing. | Rename to `SCENARIO SIMULATION` or `SAFETY RESPONSE SIM`. |
| Scenario map overlays | Visualize simulated entities and effects. | Essential for demo impact. | Visually strong. | On map is expected. | Consistent with map overlays. | Add explicit scenario layer toggle and distinguish simulated assets from live assets. |

### Map

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Base map canvas | Primary spatial operating surface. | Essential. | Clear. | Central full surface is correct. | Consistent. | Keep full-bleed. Protect map from overlay clutter. |
| Right map control rail | Provides navigation, layers, tools, geofences, export, and view controls. | Essential, but overloaded. | Icon-only controls are not self-evident. | Right edge is expected for map tools. | Visual styling consistent, grouping weak. | Group by task, add active-tool label, `aria-label`s, and larger touch targets. |
| Layer toggles | Control visibility of map data. | Essential. | Labelled toggles are clear. | Side panel placement works. | Consistent. | Add layer presets: `Operations`, `Analysis`, `Training`. |
| Drawing, measure, bearing, spatial search, geofence tools | Support spatial analysis and planning. | Useful to expert users. | Mixed; icons need labels. | Right rail is plausible. | Consistent. | Keep but group as `Analysis tools`; show current active tool persistently. |
| Map HUD metrics | Shows location, count, threat, and live readings. | Useful. | Clear individually. | Bottom/edge placement is expected. | Consistent. | Hide or reduce HUD when telemetry panel duplicates metrics. |
| Coordinates and scale/readouts | Provides spatial precision. | Useful. | Clear to map users. | Map edge placement expected. | Consistent. | Keep. Avoid overlap with playback and bottom status. |
| Timeline slider | Scrubs temporal map state. | Useful in playback or analysis. | Clear enough, but unlabeled range input risk. | Bottom map placement expected. | Consistent. | Keep only one timeline surface and add programmatic label. |
| Playback controller | Runs historical playback/demo tracks. | Useful, not always necessary. | Clear transport icons for experienced users, tiny controls. | Bottom/edge placement conflicts with timeline. | Consistent visual language. | Make playback opt-in, enlarge controls, and bind to same timeline state. |
| Proximity alert / scenario badge / bearing panel / geofence manager / spatial search panels | Contextual overlays for map operations. | Useful, conditional. | Clear when one is active; crowded when many appear. | Many compete for corners. | Consistent panels but no overlay priority. | Add an overlay stack manager with priority and collision avoidance. |
| ADS-B, heatmap, entities, fleet, geofences, deck trails, threat zones, footprints | Data layers for situational awareness. | Useful but not all default-essential. | Labels are clear in layer list, not always on map. | Map layer placement expected. | Consistent. | Default to essential live layers. Make analysis/training layers explicit opt-ins. |

### Telemetry

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Embedded full map | Gives spatial context for selected drone. | Essential, but current implementation is too heavy. | Clear as map, less clear as telemetry-specific view. | Central placement works. | Reuses map design. | Use a telemetry map variant with minimal overlays. |
| Drone selector | Chooses active telemetry target. | Essential. | Clear. | Top/right rail is expected. | Consistent. | Keep. Add stronger selected-drone lock before commands. |
| Telemetry metric cards | Show altitude, speed, battery, signal, heading, mode. | Essential. | Clear. | Right rail is expected. | Consistent. | Keep in telemetry panel and reduce duplicate map HUD. |
| Command panel | Sends drone commands. | Essential if app supports control. | Labels are clear, but risk is high. | Near telemetry context is logical. | Consistent. | Add armed/offline gating, confirmation for high-impact commands, and visible command result feedback. |
| Logs/status panels | Show command and telemetry history. | Useful. | Clear. | Below controls is appropriate. | Consistent. | Keep, but separate monitoring from command actions visually. |

### Intelligence

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Intel left rail/entity list | Supports entity triage and selection. | Essential. | Clear, but dense. | Expected left-side list. | Consistent. | Keep. Add responsive collapse/stacking on medium screens. |
| Entity search input | Finds entities. | Essential. | Placeholder explains usage but is not a label. | Expected above list. | Consistent. | Add visible or programmatic label. |
| Filter chips | Narrow entity set by type/status/threat. | Essential. | Clear visually, but state is color-only. | Expected near search. | Consistent. | Add `aria-pressed`, group semantics, and selected count summary. |
| Bookmark/bulk/select controls | Support triage workflows. | Useful. | Mixed due icon-only and custom checkbox visuals. | Near list is expected. | Consistent styling. | Use real checkbox/selection semantics and accessible names. |
| Create entity button | Adds new intelligence entity. | Essential for Intel authoring. | Plus icon alone is weak. | Near entity list header is expected. | Consistent but too terse. | Label as `NEW` or `CREATE`; add accessible name. |
| Entity detail rail | Shows selected entity metadata and relationships. | Essential. | Clear when selection exists. | Right rail is expected. | Consistent. | Collapse on smaller screens and provide clear empty state. |
| Center tabs: graph, timeline, matrix | Switch analysis modes. | Essential. | Labels clear; tab semantics missing. | Expected top of analysis region. | Consistent. | Add `tablist`, `tab`, `aria-selected`, keyboard behavior. |
| Graph nodes and edges | Shows entity relationships. | High value. | Visual clarity good for mouse users; weak for keyboard/screen readers. | Central canvas is right. | Consistent. | Add list/table fallback and keyboard navigation. |
| Timeline lanes and event dots | Shows temporal correlations. | High value. | Dots rely on hover/title. | Central canvas is right. | Consistent. | Add accessible names and a tabular event fallback. |
| Threat/connection matrix | Shows correlation intensity. | Useful. | Headers and cells need more explicit labels. | Matrix tab is right. | Consistent. | Use table/grid semantics, captions, scopes, and cell descriptions. |
| Bottom tools tray: feed, tags, NL query, anomaly, export | Adds analysis utilities. | Useful, but too many at once. | Individually clear; collectively overloaded. | Fixed bottom tray shrinks workspace. | Consistent panel style. | Move to collapsible tools drawer or secondary tabs. |
| Natural-language query input | Lets users ask intelligence questions. | Useful and strong for demos. | Placeholder examples help. | Bottom/side placement is acceptable. | Consistent. | Add label and show result history/confidence. |
| Entity create modal/form | Creates structured entities. | Essential. | Field groups are clear, but labels are not always associated. | Modal is expected. | Consistent. | Add modal semantics, focus trap, validation, and labelled inputs. |

### Missions

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Mission list | Lets users select active mission. | Essential. | Clear. | Left rail is expected. | Consistent. | Auto-select first active mission or show a stronger CTA when one exists. |
| New mission form | Creates mission records. | Essential. | Placeholders only; validation weak. | Inline in list is logical. | Consistent. | Convert to semantic form with labels, Enter submit, disabled/error state. |
| Mission detail header | Confirms selected mission state. | Essential. | Clear. | Main pane top is expected. | Consistent. | Keep. Include status and primary next action. |
| Mission tabs | Organize entities, evidence, debrief, briefing, report, notes. | Essential, but numerous. | Labels are clear. | Expected below header. | Consistent. | Add proper tab semantics. Consider grouping debrief/briefing/report as `Outputs`. |
| Entity assignment and remove actions | Manages mission scope. | Essential. | Remove action is hover-only/icon-only. | In entity list is expected. | Consistent. | Add visible-on-focus controls, labels, and confirmation for destructive changes. |
| Debrief frame upload | Adds evidence for detection/debrief. | Useful. | Visual upload affordance clear, keyboard access weak. | Debrief tab is expected. | Consistent. | Use focusable file control pattern and show analysis/delete feedback. |
| Briefing/report outputs | Generate mission communications. | Useful. | Output can read like a raw wall of text; mojibake appears in report strings. | Correct tab placement. | Consistent. | Add section navigation, copy feedback, and fix encoding text. |
| Delete mission/action buttons | Removes mission or related data. | Essential but dangerous. | Often icon-only or terse. | Expected near item/action row. | Consistent. | Add confirmation/undo and clear accessible names. |

### Analytics

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| KPI cards | Summarize operational and intelligence totals. | Essential for analytics. | Clear. | Top grid expected. | Consistent. | Keep, but avoid `fleet.length || 1` false counts. |
| Charts | Show trends and distributions. | Useful. | Visual clarity good; nonvisual summaries missing. | Main analytics surface expected. | Consistent. | Add captions, summary tables, and responsive grid behavior. |
| Temporal heatmap | Shows activity by time. | Useful. | Color-only meaning and title-only tooltips are weak. | Analytics section is expected. | Consistent. | Add accessible descriptions and textual summaries. |
| Entity type cards | Break down entity mix. | Useful. | Clear. | Analytics grid expected. | Consistent. | Make grid responsive and preserve priority ordering on mobile. |
| Network view | Shows relationship/network summary. | Useful for analyst users. | Clear visually; can imply false data if dummy rows appear. | Analytics lower area expected. | Consistent. | Use explicit empty/demo state instead of fabricated minimum counts. |

### Settings

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Theme/preferences controls | Personalize UI. | Useful. | Clear. | Settings top is expected. | Consistent. | Keep. Use labelled controls and persist feedback. |
| Onboarding reset/help | Replays tour. | Useful. | Clear. | Settings is expected. | Consistent. | Keep after fixing mobile tour selectors. |
| Connection status | Shows API/WebSocket/backend health. | Essential. | Clear and trustworthy in local test. | High in settings is expected. | Consistent. | Keep. Link to diagnostics or retry where useful. |
| System health | Shows platform state. | Essential. | Clear. | Settings/health section expected. | Consistent. | Keep. Avoid false active-drone counts. |
| Alert rules | Configures thresholding. | Essential for ops. | Current custom toggles and editable values are compact but not explicit. | Settings is right. | Consistent visual style. | Use labelled switches, labelled number inputs, min/max, and save feedback. |
| Add rule form | Creates new alert rules. | Essential if alerting is configurable. | Fields are understandable but unlabeled. | Near alert rules is expected. | Consistent. | Convert to real form with labels and predictable close/create keyboard behavior. |
| Audit log | Shows administrative history. | Useful and trust-building. | Clear; filter states and clear confirmation are weak. | Settings lower area expected. | Consistent. | Add pressed state/counts and real confirm or undo for clear. |
| Data sources panel | Explains live/degraded/simulated/planned sources. | Essential for trust. | Clear but not actionable. | Settings and dashboard are both useful. | Consistent. | Add configure/test links, last error, and non-color status cues. |
| Platform status/about | Shows app and environment status. | Useful. | Clear. | Settings bottom is expected. | Consistent. | Keep. Avoid burying critical connection state below long settings content. |
| Shortcuts list | Documents keyboard control. | Useful. | Clear. | Settings/help is expected. | Consistent. | Keep in help/settings; make actual shortcuts match documented behavior. |

### Responsive And Accessibility Elements

| Element family | Purpose | Necessity | Clarity | Placement | Consistency | Flow impact and action |
| --- | --- | --- | --- | --- | --- | --- |
| Icon-only buttons | Save space in dense tools. | Useful, but overused. | Many are unclear without hover. | Often expected in rails, not in forms/destructive actions. | Visually consistent. | Add `aria-label`, focus-visible styles, and tooltips on focus. Use text labels for destructive or high-impact actions. |
| Small controls under 32px | Support dense desktop interface. | Sometimes necessary. | Hard to use on touch. | Common in map/toolbars. | Consistent tactical style. | Keep only for desktop expert rails. Use 40-44px targets on mobile/touch areas. |
| Hover-only actions | Reduce visual clutter. | Useful for desktop secondary actions. | Not discoverable on touch/keyboard. | Often row-level. | Common but risky. | Make actions visible on focus and touch, and use accessible names. |
| Color/status pulses | Signal live, warning, degraded, simulated states. | Useful. | Color-only meaning is insufficient. | Used throughout. | Consistent brand language. | Add text or icons for status meaning and support `prefers-reduced-motion`. |
| Tabs implemented as buttons | Switch local content. | Essential. | Labels clear. | Expected. | Visually consistent. | Add ARIA tab semantics and keyboard navigation. |
| Inputs using placeholders only | Capture search, command, mission, and settings input. | Essential. | Placeholder helps but disappears during typing. | Generally expected. | Consistent. | Add visible labels or `aria-label`s. |
| Modals without dialog primitives | Focus user on creation/report flows. | Essential for some tasks. | Visually clear. | Expected overlay placement. | Consistent. | Add dialog semantics, focus trap, Escape close, and scroll lock. |

## Remove Or Merge Candidates

- Remove `Entities` and `Timeline` from the primary sidebar unless they deep-link to actual Intel subviews.
- Remove or hide command palette actions that do not execute.
- Merge `Quick actions` and `Command palette` into one truthful action model.
- Remove the separate dashboard `Widgets` mode or rename it to a layout customization flow.
- Remove one of the two map playback surfaces.
- Hide synthetic comms on the operational dashboard unless clearly labelled as simulation.
- Hide or collapse mobile status bar when bottom nav is present.
- Merge repeated telemetry metrics between map HUD and telemetry panel.
- Move bottom-right keyboard help into settings/help or the unified global utilities cluster.

## Suggested Implementation Order

1. Shell safety pass: mobile nav reachability, bottom collision fixes, toast placement, accessible names for shell controls.
2. Truthful actions pass: remove/wire incomplete command palette and quick actions; fix keyboard help Escape claim.
3. Map simplification pass: one timeline, grouped map controls, layer presets, scenario-vs-live separation.
4. Telemetry split pass: telemetry-specific map variant, duplicate metric reduction, command confirmation.
5. Form/accessibility pass: modal primitives, labelled inputs, real forms, tab semantics, visible/focusable destructive actions.
6. Dashboard hierarchy pass: critical-first alert queue, top-four operational priorities, synthetic comms labeling.
7. Intel/analytics responsive pass: collapsible panels, accessible graph/table fallbacks, responsive grids, no false dummy counts.

## Bottom Line

The interface should not add more controls yet. It needs a hierarchy pass and a truthfulness pass. Every visible element should either help the operator answer "what is happening, where, how bad, and what can I safely do next" or be moved behind an expert or analysis mode.

For a LinkedIn/demo audience, the strongest interactive story is configurable scenarios with clear scenario-vs-live separation, inject history, visible consequences on the map, and a debrief/report output. For an operational audience, the strongest UX move is restraint: fewer controls on first load, clearer state, and no simulated data pretending to be live.
