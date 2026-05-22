import { create } from 'zustand';

const DRONE_IDS = ['DRONE-01', 'DRONE-02', 'DRONE-03'];
const BASE_LAT = 37.7755;
const BASE_LNG = -122.4180;
const SNAPSHOT_INTERVAL = 1000; // 1 second
const DURATION_SECONDS = 300; // 5 minutes

function generateDemoHistory() {
  const startTime = Date.now() - DURATION_SECONDS * 1000;
  const snapshots = [];

  for (let i = 0; i <= DURATION_SECONDS; i++) {
    const t = i / DURATION_SECONDS;
    const ts = startTime + i * SNAPSHOT_INTERVAL;

    const positions = DRONE_IDS.map((id, idx) => {
      const angle = t * Math.PI * 2 + (idx * Math.PI * 2) / 3;
      const radius = 0.003 + idx * 0.001;
      return {
        droneId: id,
        lat: BASE_LAT + Math.sin(angle) * radius,
        lng: BASE_LNG + Math.cos(angle) * radius,
        alt: 80 + Math.sin(t * Math.PI * 4 + idx) * 20,
        heading: ((angle * 180) / Math.PI + 90) % 360,
        speed: 8 + Math.sin(t * Math.PI * 6) * 3,
        battery: 16.8 - t * 2.5 - idx * 0.3,
      };
    });

    snapshots.push({ timestamp: ts, positions });
  }

  return snapshots;
}

export const usePlaybackStore = create((set, get) => ({
  isPlaying: false,
  speed: 1,
  currentTime: 0,
  startTime: 0,
  endTime: 0,
  history: [],
  active: false,
  intervalId: null,

  loadHistory: (data) => {
    const state = get();
    if (state.intervalId) clearInterval(state.intervalId);

    if (!data || data.length === 0) return;

    set({
      history: data,
      startTime: data[0].timestamp,
      endTime: data[data.length - 1].timestamp,
      currentTime: data[0].timestamp,
      isPlaying: false,
      active: true,
      intervalId: null,
    });
  },

  loadDemo: () => {
    const demo = generateDemoHistory();
    get().loadHistory(demo);
  },

  play: () => {
    const state = get();
    if (state.isPlaying || state.history.length === 0) return;

    const startCurrent = state.currentTime >= state.endTime
      ? state.startTime
      : state.currentTime;

    const id = setInterval(() => {
      const s = get();
      const next = s.currentTime + s.speed * 1000;
      if (next >= s.endTime) {
        set({ currentTime: s.endTime, isPlaying: false });
        clearInterval(s.intervalId);
        set({ intervalId: null });
      } else {
        set({ currentTime: next });
      }
    }, 1000);

    set({ isPlaying: true, currentTime: startCurrent, intervalId: id });
  },

  pause: () => {
    const state = get();
    if (state.intervalId) clearInterval(state.intervalId);
    set({ isPlaying: false, intervalId: null });
  },

  stop: () => {
    const state = get();
    if (state.intervalId) clearInterval(state.intervalId);
    set({
      isPlaying: false,
      currentTime: state.startTime,
      active: false,
      intervalId: null,
    });
  },

  setSpeed: (speed) => set({ speed }),

  seek: (time) => {
    const state = get();
    const clamped = Math.max(state.startTime, Math.min(state.endTime, time));
    set({ currentTime: clamped });
  },

  getCurrentSnapshot: () => {
    const { history, currentTime } = get();
    if (history.length === 0) return null;

    let closest = history[0];
    for (const snap of history) {
      if (snap.timestamp <= currentTime) closest = snap;
      else break;
    }
    return closest;
  },
}));
