import { useEffect, useState } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';
import { ADSB_CONFIGURED, ADSB_URL } from '../../utils/runtimeConfig';

const POLL_INTERVAL = 15000;
const BOUNDS = { lamin: 37.6, lomin: -122.6, lamax: 37.9, lomax: -122.2 };

function parseAircraftState(state) {
  if (!state || typeof state !== 'object') return null;
  const array = Array.isArray(state);
  const value = (key, index) => array ? state[index] : state[key];
  const latitude = value('latitude', 6);
  const longitude = value('longitude', 5);
  const id = value('icao24', 0);
  if (typeof id !== 'string' || !id.trim()
      || !Number.isFinite(latitude) || Math.abs(latitude) > 90
      || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  const callsign = value('callsign', 1);
  const country = value('origin_country', 2) ?? state.country;
  return {
    icao24: id.trim(),
    callsign: typeof callsign === 'string' ? callsign.trim() : '',
    country: typeof country === 'string' ? country : '',
    latitude, longitude,
    altitude: value('altitude', 7),
    onGround: value('on_ground', 8) ?? state.onGround,
    velocity: value('velocity', 9),
    heading: value('heading', 10),
  };
}

export default function AdsbLayer() {
  const [aircraft, setAircraft] = useState([]);
  const [status, setStatus] = useState(ADSB_CONFIGURED ? 'LOADING' : 'SIM');
  const layers = useMapStore((s) => s.layers);

  useEffect(() => {
    if (!layers.adsb) return undefined;

    let active = true;
    let inFlight = false;
    let controller;
    let timeout;
    let first = true;
    const fetchAdsb = async () => {
      if (inFlight) return;
      if (first) {
        setAircraft([]);
        setStatus(ADSB_CONFIGURED ? 'LOADING' : 'SIM');
        first = false;
      }
      if (!ADSB_CONFIGURED) {
        setAircraft(generateSimulatedAircraft());
        setStatus('SIM');
        return;
      }
      inFlight = true;
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const params = new URLSearchParams({
          lat_min: String(BOUNDS.lamin), lon_min: String(BOUNDS.lomin),
          lat_max: String(BOUNDS.lamax), lon_max: String(BOUNDS.lomax),
        });
        const res = await fetch(`${ADSB_URL}?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success === false) throw new Error('Feed unavailable');
        const states = data.data ?? data.states;
        if (!Array.isArray(states) && states !== null) throw new Error('Invalid feed');
        const parsed = (states || []).map(parseAircraftState).filter(Boolean);
        if (states?.length && !parsed.length) throw new Error('Invalid aircraft records');
        const unique = [...new Map(parsed.map(item => [item.icao24, item])).values()];
        if (active) {
          setAircraft(unique.filter(item => !item.onGround));
          setStatus('LIVE');
        }
      } catch {
        if (active) {
          setAircraft([]);
          setStatus('UNAVAILABLE');
        }
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    };
    fetchAdsb();
    const interval = setInterval(fetchAdsb, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
      clearTimeout(timeout);
      controller?.abort();
    };
  }, [layers.adsb]);

  if (!layers.adsb) return null;

  return (
    <>
      {aircraft.map((ac) => (
        <CircleMarker
          key={ac.icao24}
          center={[ac.latitude, ac.longitude]}
          radius={3}
          pathOptions={{
            color: '#facc15',
            fillColor: '#facc15',
            fillOpacity: 0.6,
            weight: 1,
            opacity: 0.8,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]} permanent={false}>
            <div className="text-[10px] font-mono space-y-0.5">
              <div className="font-bold">{ac.callsign || ac.icao24}</div>
              <div className="text-zinc-400">
                {Number.isFinite(ac.altitude) ? `${Math.round(ac.altitude)}m` : '--'} |{' '}
                {Number.isFinite(ac.velocity) ? `${Math.round(ac.velocity)}m/s` : '--'} |{' '}
                HDG {Number.isFinite(ac.heading) ? Math.round(ac.heading) : '--'}
              </div>
              <div className="text-zinc-500">{ac.country}</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Live/Simulated badge */}
      <AdsbBadge status={status} count={aircraft.length} />
    </>
  );
}

function AdsbBadge({ status, count }) {
  const isLive = status === 'LIVE';
  return (
    <div className="leaflet-top leaflet-left" style={{ top: 50, left: 10, position: 'absolute', zIndex: 1000 }}>
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-2.5 py-1 flex items-center gap-2 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className={`text-[9px] font-mono font-bold tracking-wider ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
          ADS-B {status}
        </span>
        <span className="text-[9px] font-mono text-zinc-600">{count}</span>
      </div>
    </div>
  );
}

function generateSimulatedAircraft() {
  const now = Date.now() / 1000;
  return [
    { icao24: 'a1b2c3', callsign: 'UAL1532', country: 'United States', latitude: 37.78 + Math.sin(now * 0.01) * 0.02, longitude: -122.38 + Math.cos(now * 0.01) * 0.03, altitude: 3048, velocity: 125, heading: 280, onGround: false },
    { icao24: 'd4e5f6', callsign: 'SWA445', country: 'United States', latitude: 37.72 + Math.cos(now * 0.008) * 0.025, longitude: -122.42 + Math.sin(now * 0.012) * 0.02, altitude: 1524, velocity: 95, heading: 150, onGround: false },
    { icao24: 'g7h8i9', callsign: 'DAL89', country: 'United States', latitude: 37.82 + Math.sin(now * 0.006) * 0.015, longitude: -122.35 + Math.cos(now * 0.009) * 0.025, altitude: 5486, velocity: 210, heading: 45, onGround: false },
    { icao24: 'j1k2l3', callsign: 'N482PA', country: 'United States', latitude: 37.76 + Math.cos(now * 0.015) * 0.01, longitude: -122.45 + Math.sin(now * 0.007) * 0.015, altitude: 610, velocity: 45, heading: 320, onGround: false },
    { icao24: 'm4n5o6', callsign: 'ASA1207', country: 'United States', latitude: 37.85 + Math.sin(now * 0.005) * 0.03, longitude: -122.30 + Math.cos(now * 0.011) * 0.02, altitude: 7620, velocity: 245, heading: 190, onGround: false },
  ];
}
