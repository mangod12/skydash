import { useEffect, useState, useRef } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';
import { ADSB_CONFIGURED, ADSB_URL } from '../../utils/runtimeConfig';

const POLL_INTERVAL = 15000;
const BOUNDS = { lamin: 37.6, lomin: -122.6, lamax: 37.9, lomax: -122.2 };

function parseAircraftState(state) {
  if (!Array.isArray(state)) {
    return {
      icao24: state.icao24,
      callsign: (state.callsign || '').trim(),
      country: state.origin_country || state.country,
      longitude: state.longitude,
      latitude: state.latitude,
      altitude: state.altitude,
      onGround: state.on_ground ?? state.onGround,
      velocity: state.velocity,
      heading: state.heading,
    };
  }

  return {
    icao24: state[0],
    callsign: (state[1] || '').trim(),
    country: state[2],
    longitude: state[5],
    latitude: state[6],
    altitude: state[7],
    onGround: state[8],
    velocity: state[9],
    heading: state[10],
  };
}

export default function AdsbLayer() {
  const [aircraft, setAircraft] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const layers = useMapStore((s) => s.layers);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!layers.adsb) return undefined;

    const fetchAdsb = async () => {
      if (!ADSB_CONFIGURED) {
        setAircraft(generateSimulatedAircraft());
        setIsLive(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          lat_min: String(BOUNDS.lamin),
          lon_min: String(BOUNDS.lomin),
          lat_max: String(BOUNDS.lamax),
          lon_max: String(BOUNDS.lomax),
        });
        const url = `${ADSB_URL}?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const states = data.data || data.states || [];
        if (states.length) {
          setAircraft(states.map(parseAircraftState).filter((a) => a.latitude && a.longitude && !a.onGround));
          setIsLive(true);
        } else {
          setAircraft(generateSimulatedAircraft());
          setIsLive(false);
        }
      } catch {
        setAircraft(generateSimulatedAircraft());
        setIsLive(false);
      }
    };

    fetchAdsb();
    intervalRef.current = setInterval(fetchAdsb, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
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
                {ac.altitude ? `${Math.round(ac.altitude)}m` : '--'} |{' '}
                {ac.velocity ? `${Math.round(ac.velocity)}m/s` : '--'} |{' '}
                HDG {ac.heading ? Math.round(ac.heading) : '--'}
              </div>
              <div className="text-zinc-500">{ac.country}</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Live/Simulated badge */}
      <AdsbBadge isLive={isLive} count={aircraft.length} />
    </>
  );
}

function AdsbBadge({ isLive, count }) {
  return (
    <div className="leaflet-top leaflet-left" style={{ top: 50, left: 10, position: 'absolute', zIndex: 1000 }}>
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-2.5 py-1 flex items-center gap-2 pointer-events-none">
        <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className={`text-[9px] font-mono font-bold tracking-wider ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
          ADS-B {isLive ? 'LIVE' : 'SIM'}
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
