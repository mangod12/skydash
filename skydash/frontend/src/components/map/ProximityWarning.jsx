import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';

const PROXIMITY_THRESHOLD_KM = 0.5;
const DEG_TO_RAD = Math.PI / 180;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ProximityWarning() {
  const dronePos = useMapStore((s) => s.dronePosition);
  const entities = useIntelStore((s) => s.entities);

  const threats = useMemo(() => {
    if (!dronePos) return [];
    return entities
      .filter((e) =>
        e.coordinates &&
        (e.threatLevel === 'high' || e.threatLevel === 'critical'),
      )
      .map((e) => ({
        id: e.id,
        name: e.name,
        threat: e.threatLevel,
        dist: haversineKm(dronePos.lat, dronePos.lng, e.coordinates[0], e.coordinates[1]),
      }))
      .filter((t) => t.dist <= PROXIMITY_THRESHOLD_KM)
      .sort((a, b) => a.dist - b.dist);
  }, [dronePos, entities]);

  return (
    <AnimatePresence>
      {threats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-3 left-3 z-30 max-w-[220px]"
        >
          <div className="bg-red-950/80 backdrop-blur-xl border border-red-500/30 rounded-xl p-3 shadow-lg shadow-red-500/10">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-red-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.15em] text-red-400">
                PROXIMITY ALERT
              </span>
            </div>
            <div className="space-y-1.5">
              {threats.map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <span className="text-[10px] text-red-200 truncate max-w-[130px]">
                    {t.name}
                  </span>
                  <span className="text-[9px] font-mono tabular-nums text-red-400">
                    {Math.round(t.dist * 1000)}m
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
