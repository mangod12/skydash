import { create } from 'zustand';
// No inherited login tokens, account reads, auth probes or server session in this build.
export const useAuthStore = create(() => ({ authEnabled: false, user: null, token: null, getAuthHeader: () => ({}), logout: () => {} }));
