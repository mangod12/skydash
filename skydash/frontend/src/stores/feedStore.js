import { create } from 'zustand';

const MAX_ITEMS = 100;

const CATEGORIES = ['SIGINT', 'HUMINT', 'GEOINT', 'OSINT', 'CYBER'];
const SEVERITIES = ['critical', 'warning', 'info'];

const ENTITY_IDS = ['ent-001', 'ent-002', 'ent-003', 'ent-004', 'ent-005', 'ent-006', 'ent-007', 'ent-008'];

const LOCATIONS = [
  'Sector 4 North Perimeter', 'Compound ECHO vicinity', 'Logistics Hub DELTA',
  'Grid Ref 37.778N 122.416W', 'Cargo Way overwatch zone', 'Northern gate approach',
  'Industrial Blvd corridor', 'Waterfront surveillance arc',
];

const TEMPLATES = [
  // SIGINT
  { category: 'SIGINT', severity: 'critical', title: 'Encrypted burst transmission detected', summary: 'Anomalous encrypted burst on 5.8 GHz — duration 2.3s, source triangulated to grid sector 4-N.' },
  { category: 'SIGINT', severity: 'warning', title: 'New RF emitter catalogued', summary: 'Unregistered 2.4 GHz transmitter — OFDM modulation, estimated +18 dBm output power.' },
  { category: 'SIGINT', severity: 'info', title: 'COMINT sweep complete', summary: 'Scheduled communications sweep finished — 14 signals catalogued, 2 flagged for analysis.' },
  { category: 'SIGINT', severity: 'warning', title: 'Frequency hopping pattern identified', summary: 'Target emitter switching across 5 channels at 200ms intervals — possible FHSS protocol.' },
  { category: 'SIGINT', severity: 'critical', title: 'Jamming activity detected', summary: 'Broadband RF interference on GPS L1 band — estimated 500m radius, source bearing 045 degrees.' },
  // HUMINT
  { category: 'HUMINT', severity: 'warning', title: 'Asset reports vehicle movement', summary: 'HUMINT source BRAVO reports unmarked cargo van entering restricted zone — 3 occupants observed.' },
  { category: 'HUMINT', severity: 'info', title: 'Scheduled check-in received', summary: 'Field asset ROMEO-4 reports all clear at observation post — no change in pattern of life.' },
  { category: 'HUMINT', severity: 'critical', title: 'Priority intelligence report', summary: 'Asset DELTA indicates imminent material transfer at logistics hub — window 30 min.' },
  { category: 'HUMINT', severity: 'info', title: 'Pattern of life update', summary: 'Subject TANGO-7 observed departing compound via east entrance — on foot, no escort.' },
  { category: 'HUMINT', severity: 'warning', title: 'Unscheduled personnel detected', summary: '4 unknown individuals entered perimeter sector 2 — no prior intelligence on identities.' },
  // GEOINT
  { category: 'GEOINT', severity: 'info', title: 'Satellite pass imagery acquired', summary: 'High-res optical capture of target area — cloud cover 12%, resolution 0.3m GSD.' },
  { category: 'GEOINT', severity: 'warning', title: 'Terrain change detected', summary: 'SAR comparison shows new excavation activity at grid ref 37.776N — 40m x 20m disturbance.' },
  { category: 'GEOINT', severity: 'info', title: 'Thermal anomaly mapped', summary: 'IR overpass detected heat signature cluster at logistics hub — consistent with vehicle engines.' },
  { category: 'GEOINT', severity: 'critical', title: 'Structure modification confirmed', summary: 'Compound ECHO rooftop altered since last pass — new antenna array installed, est. 3m height.' },
  // OSINT
  { category: 'OSINT', severity: 'info', title: 'Social media mention flagged', summary: 'Geotagged post within 500m of surveillance zone — keyword match on monitored terms.' },
  { category: 'OSINT', severity: 'warning', title: 'ADS-B track anomaly', summary: 'Aircraft squawking 7600 entered 20nm radius — transponder code indicates communications failure.' },
  { category: 'OSINT', severity: 'info', title: 'Public records match', summary: 'Vehicle plate 4XBC892 linked to registered owner — corporate fleet, logistics company.' },
  { category: 'OSINT', severity: 'warning', title: 'Maritime AIS gap detected', summary: 'Vessel MMSI 338892100 dark for 47 minutes within harbor approach — last position 37.78N.' },
  // CYBER
  { category: 'CYBER', severity: 'critical', title: 'Intrusion attempt blocked', summary: 'Brute force SSH attempt on sensor node CHARLIE-3 — 2,400 attempts from 3 source IPs.' },
  { category: 'CYBER', severity: 'warning', title: 'Anomalous network traffic', summary: 'Outbound data exfil pattern detected on drone relay link — 340MB transferred to unknown endpoint.' },
  { category: 'CYBER', severity: 'info', title: 'TLS certificate expiring', summary: 'Sensor mesh TLS cert expires in 72h — automated renewal queued, monitoring handshake integrity.' },
  { category: 'CYBER', severity: 'warning', title: 'DNS tunneling signature', summary: 'Suspicious DNS query pattern from internal node — high entropy subdomain requests at 2/sec.' },
  { category: 'CYBER', severity: 'critical', title: 'Zero-day exploit indicator', summary: 'IOC match on known CVE-2026-3841 payload signature in network traffic — isolating affected node.' },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function generateItem() {
  const template = pick(TEMPLATES);
  const hasEntity = Math.random() > 0.5;
  const hasLocation = Math.random() > 0.4;
  return {
    id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    severity: template.severity,
    category: template.category,
    title: template.title,
    summary: template.summary,
    entityId: hasEntity ? pick(ENTITY_IDS) : null,
    location: hasLocation ? pick(LOCATIONS) : null,
  };
}

let intervalId = null;

function scheduleNext(addItem) {
  const delay = 3000 + Math.random() * 5000; // 3-8 seconds
  intervalId = setTimeout(() => {
    addItem(generateItem());
    scheduleNext(addItem);
  }, delay);
}

export const useFeedStore = create((set, get) => ({
  items: [],
  isPaused: false,
  filter: 'all',

  addItem: (item) => set((s) => ({
    items: [item, ...s.items].slice(0, MAX_ITEMS),
  })),

  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),

  setFilter: (filter) => set({ filter }),

  clear: () => set({ items: [] }),

  getFiltered: () => {
    const { items, filter } = get();
    if (filter === 'all') return items;
    return items.filter((i) => i.severity === filter);
  },

  startSimulation: () => {
    if (intervalId) return;
    const { addItem } = get();
    scheduleNext(addItem);
  },

  stopSimulation: () => {
    if (intervalId) {
      clearTimeout(intervalId);
      intervalId = null;
    }
  },
}));
