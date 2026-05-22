import { useEffect, useState, useRef } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';

const ADSB_URL = 'https://opensky-network.org/api/states/all';
const POLL_INTERVAL = 15000; // 15s (OpenSky rate limit)

// Bounds around San Francisco
const BOUNDS = { lamin: 37.6, lomin: -122.6, lamax: 37.9, lomax: -122.2 };

function parseAircraftState(state) {
  return {
    icao24: state[0],
    callsign: (state[1] || '').trim(),
    country: state[2],
    longitude: state[5],
    latitude: state[6],
    altitude: state[7], // barometric
    onGround: state[8],
    velocity: state[9],
    heading: state[10],
    verticalRate: state[11],
    category: state[17],
  };
}

export default function AdsbLayer() {
  const [aircraft, setAircraft] = useState([]);
  const layers = useMapStore((s) => s.layers);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchAdsb = async () => {
      try {
        const url = `${ADSB_URL}?lamin=${BOUNDS.lamin}&lomin=${BOUNDS.lomin}&lamax=${BOUNDS.lamax}&lomax=${BOUNDS.lomax}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.states) {
          const parsed = data.states
            .map(parseAircraftState)
            .filter((a) => a.latitude && a.longitude && !a.onGround);
          setAircraft(parsed);
        }
      } catch {
        // OpenSky may rate-limit or be unavailable — use simulated fallback
        setAircraft(generateSimulatedAircraft());
      }
    };

    fetchAdsb();
    intervalRef.current = setInterval(fetchAdsb, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, []);

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
    </>
  );
}

// Simulated aircraft when OpenSky is unavailable
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
