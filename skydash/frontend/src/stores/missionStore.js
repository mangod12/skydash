import { create } from 'zustand';
import { toast } from '../components/common/Toast';
import { apiFetch } from '../utils/api';
import { API_BASE, API_CONFIGURED } from '../utils/runtimeConfig';

const API = API_BASE;
const requireApi = () => {
  if (API_CONFIGURED) return true;
  toast('Backend API not configured', 'warning');
  return false;
};

export const useMissionStore = create((set, get) => ({
  missions: [],
  activeMissionId: null,
  loading: false,
  visionStatus: null,

  fetchMissions: async () => {
    if (!API_CONFIGURED) {
      set({ loading: false });
      return;
    }
    set({ loading: true });
    try {
      const res = await apiFetch(`${API}/api/missions`);
      const json = await res.json();
      if (json.success) {
        set((s) => {
          const missions = json.data || [];
          const activeMissionStillExists = missions.some((mission) => mission.id === s.activeMissionId);
          const nextActiveMission = activeMissionStillExists
            ? s.activeMissionId
            : (missions.find((mission) => mission.status === 'active') || missions[0])?.id || null;
          return { missions, activeMissionId: nextActiveMission };
        });
      }
    } catch (e) {
      console.error('Failed to fetch missions', e);
      toast('Failed to load missions', 'error');
    }
    set({ loading: false });
  },

  createMission: async (data) => {
    if (!requireApi()) return null;
    try {
      const res = await apiFetch(`${API}/api/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({ missions: [json.data, ...s.missions] }));
        return json.data;
      }
    } catch (e) {
      console.error('Failed to create mission', e);
      toast('Failed to create mission', 'error');
    }
    return null;
  },

  updateMission: async (id, data) => {
    if (!requireApi()) return null;
    try {
      const res = await apiFetch(`${API}/api/missions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) => (m.id === id ? { ...m, ...json.data } : m)),
        }));
        return json.data;
      }
    } catch (e) {
      console.error('Failed to update mission', e);
      toast('Failed to update mission', 'error');
    }
    return null;
  },

  deleteMission: async (id) => {
    if (!requireApi()) return false;
    try {
      const res = await apiFetch(`${API}/api/missions/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.filter((m) => m.id !== id),
          activeMissionId: s.activeMissionId === id ? null : s.activeMissionId,
        }));
        return true;
      }
    } catch (e) {
      console.error('Failed to delete mission', e);
      toast('Failed to delete mission', 'error');
    }
    return false;
  },

  setActiveMission: (id) => set({ activeMissionId: id }),

  fetchMissionDetail: async (id) => {
    if (!API_CONFIGURED) return null;
    try {
      const res = await apiFetch(`${API}/api/missions/${id}`);
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === id
              ? {
                  ...m,
                  entityIds: json.data.entities,
                  notes: json.data.notes,
                  detections: json.data.detections,
                }
              : m,
          ),
        }));
        return json.data;
      }
    } catch (e) {
      console.error('Failed to fetch mission detail', e);
    }
    return null;
  },

  addEntityToMission: async (missionId, entityId) => {
    if (!requireApi()) return false;
    try {
      const res = await apiFetch(`${API}/api/missions/${missionId}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId }),
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? { ...m, entityIds: [...(m.entityIds || []), entityId] }
              : m,
          ),
        }));
        return true;
      }
    } catch (e) {
      console.error('Failed to add entity to mission', e);
    }
    return false;
  },

  removeEntityFromMission: async (missionId, entityId) => {
    if (!requireApi()) return false;
    try {
      const res = await apiFetch(`${API}/api/missions/${missionId}/entities/${entityId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? { ...m, entityIds: (m.entityIds || []).filter((eid) => eid !== entityId) }
              : m,
          ),
        }));
        return true;
      }
    } catch (e) {
      console.error('Failed to remove entity from mission', e);
    }
    return false;
  },

  addNote: async (missionId, content) => {
    if (!requireApi()) return null;
    try {
      const res = await apiFetch(`${API}/api/missions/${missionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? { ...m, notes: [json.data, ...(m.notes || [])] }
              : m,
          ),
        }));
        return json.data;
      }
    } catch (e) {
      console.error('Failed to add note', e);
    }
    return null;
  },

  deleteNote: async (missionId, noteId) => {
    if (!requireApi()) return false;
    try {
      const res = await apiFetch(`${API}/api/missions/${missionId}/notes/${noteId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? { ...m, notes: (m.notes || []).filter((n) => n.id !== noteId) }
              : m,
          ),
        }));
        return true;
      }
    } catch (e) {
      console.error('Failed to delete note', e);
    }
    return false;
  },

  fetchVisionStatus: async () => {
    if (!API_CONFIGURED) {
      set({ visionStatus: null });
      return null;
    }
    try {
      const res = await apiFetch(`${API}/api/vision/status`);
      const json = await res.json();
      if (json.success) {
        set({ visionStatus: json.data });
        return json.data;
      }
    } catch (e) {
      console.error('Failed to fetch vision status', e);
    }
    return null;
  },

  analyzeMissionImage: async (missionId, file) => {
    if (!requireApi()) return null;
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await apiFetch(`${API}/api/missions/${missionId}/detections/analyze`, {
        method: 'POST',
        body,
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? { ...m, detections: [json.data, ...(m.detections || [])] }
              : m,
          ),
        }));
        return json.data;
      }
      toast(json.error || 'Detection analysis failed', 'error');
    } catch (e) {
      console.error('Failed to analyze mission image', e);
      toast('Detection analysis failed', 'error');
    }
    return null;
  },

  monitorSampleVideo: async (missionId) => {
    if (!requireApi()) return null;
    try {
      const res = await apiFetch(`${API}/api/missions/${missionId}/detections/sample-monitor`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? { ...m, detections: [json.data, ...(m.detections || [])] }
              : m,
          ),
        }));
        toast('Sample feed analyzed with RT-DETR', 'success');
        return json.data;
      }
      toast(json.error || 'Sample feed analysis failed', 'error');
    } catch (e) {
      console.error('Failed to monitor sample video', e);
      toast('Sample feed analysis failed', 'error');
    }
    return null;
  },

  deleteDetection: async (missionId, detectionId) => {
    if (!requireApi()) return false;
    try {
      const res = await apiFetch(`${API}/api/missions/${missionId}/detections/${detectionId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        set((s) => ({
          missions: s.missions.map((m) =>
            m.id === missionId
              ? { ...m, detections: (m.detections || []).filter((d) => d.id !== detectionId) }
              : m,
          ),
        }));
        return true;
      }
    } catch (e) {
      console.error('Failed to delete detection', e);
    }
    return false;
  },

  getActiveMission: () => {
    const { missions, activeMissionId } = get();
    return missions.find((m) => m.id === activeMissionId) || null;
  },
}));
