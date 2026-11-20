// Fixed standalone build policy. Never read deployment env or inherited account settings.
export const API_BASE = '', WS_BASE = '', ADSB_URL = '';
export const API_CONFIGURED = false, WS_CONFIGURED = false, ADSB_CONFIGURED = false, BACKEND_CONFIGURED = false;
export const deriveWsBase = () => '';
