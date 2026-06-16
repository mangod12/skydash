const isBrowser = typeof window !== 'undefined';
const devHost = isBrowser ? window.location.hostname : 'localhost';
const devApiBase = `http://${devHost}:8001`;
const devWsBase = `ws://${devHost}:8001`;
const envApiBase = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const envWsBase = import.meta.env.VITE_WS_URL?.trim().replace(/\/+$/, '');

export const API_CONFIGURED = !import.meta.env.PROD || Boolean(envApiBase);
export const WS_CONFIGURED = !import.meta.env.PROD || Boolean(envWsBase);
export const BACKEND_CONFIGURED = API_CONFIGURED || WS_CONFIGURED;

export const API_BASE = envApiBase || (import.meta.env.PROD ? '' : devApiBase);
export const WS_BASE = envWsBase || (import.meta.env.PROD ? '' : devWsBase);
