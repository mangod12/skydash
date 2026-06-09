const isBrowser = typeof window !== 'undefined';
const devHost = isBrowser ? window.location.hostname : 'localhost';
const devApiBase = `http://${devHost}:8001`;
const devWsBase = `ws://${devHost}:8001`;
const prodHttpBase = isBrowser ? window.location.origin : '';
const prodWsBase = isBrowser
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : '';

export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? prodHttpBase : devApiBase);
export const WS_BASE = import.meta.env.VITE_WS_URL || (import.meta.env.PROD ? prodWsBase : devWsBase);
