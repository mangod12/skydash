import { useState } from 'react';
import { clsx } from 'clsx';
import { Search, Sparkles } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import { formatDistanceToNow } from 'date-fns';

/**
 * Client-side natural language query parser.
 * Parses simple queries like "vehicles near warehouse" or "high threat entities"
 */
function parseQuery(query, entities) {
  const q = query.toLowerCase().trim();
  if (!q) return entities;

  let results = [...entities];

  // Type filters
  const typeMap = {
    vehicle: ['vehicle', 'vehicles', 'car', 'cars', 'suv'],
    person: ['person', 'people', 'persons', 'individual'],
    building: ['building', 'buildings', 'warehouse', 'structure'],
    device: ['device', 'devices', 'signal', 'rf', 'electronic'],
    event: ['event', 'events', 'alert', 'alerts', 'breach'],
  };

  for (const [type, keywords] of Object.entries(typeMap)) {
    if (keywords.some((k) => q.includes(k))) {
      results = results.filter((e) => e.type === type);
    }
  }

  // Threat filters
  if (q.includes('high threat') || q.includes('dangerous') || q.includes('critical')) {
    results = results.filter((e) => e.threatLevel === 'high' || e.threatLevel === 'critical');
  }
  if (q.includes('low threat') || q.includes('safe')) {
    results = results.filter((e) => e.threatLevel === 'low' || e.threatLevel === 'none');
  }
  if (q.includes('suspicious')) {
    results = results.filter((e) => e.tags?.includes('suspicious') || e.threatLevel === 'medium');
  }

  // Confidence filters
  if (q.includes('high confidence') || q.includes('confirmed')) {
    results = results.filter((e) => e.confidence >= 80);
  }
  if (q.includes('low confidence') || q.includes('uncertain')) {
    results = results.filter((e) => e.confidence < 60);
  }

  // Time filters
  if (q.includes('last hour') || q.includes('recent')) {
    const oneHourAgo = Date.now() - 3600000;
    results = results.filter((e) => e.lastSeen >= oneHourAgo);
  }
  if (q.includes('last 24') || q.includes('today')) {
    const oneDayAgo = Date.now() - 86400000;
    results = results.filter((e) => e.lastSeen >= oneDayAgo);
  }

  // Name search fallback
  if (results.length === entities.length) {
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      results = results.filter((e) =>
        words.some((w) =>
          e.name.toLowerCase().includes(w) ||
          e.type.includes(w) ||
          e.tags?.some((t) => t.includes(w)) ||
          Object.values(e.properties || {}).some((v) => String(v).toLowerCase().includes(w))
        )
      );
    }
  }

  return results;
}

export default function NaturalLanguageQuery() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const entities = useIntelStore((s) => s.entities);
  const selectEntity = useIntelStore((s) => s.selectEntity);

  const handleSearch = () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setResults(parseQuery(query, entities));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={12} className="text-violet-400 shrink-0" />
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          INTELLIGENCE QUERY
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. vehicles near warehouse, high threat..."
            className="w-full pl-7 pr-3 py-2 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-violet-500/30 transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-3 py-2 text-[10px] font-semibold tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/25 transition-colors"
        >
          QUERY
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="border border-white/[0.04] rounded-lg p-3 bg-white/[0.02]">
          <div className="text-[9px] text-zinc-500 mb-2">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {results.map((entity) => (
              <button
                key={entity.id}
                onClick={() => selectEntity(entity.id)}
                className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <div>
                  <div className="text-[11px] text-zinc-300">{entity.name}</div>
                  <div className="text-[9px] text-zinc-600">
                    {entity.type.toUpperCase()} | {entity.confidence}% | {formatDistanceToNow(entity.lastSeen, { addSuffix: true })}
                  </div>
                </div>
                <div className={clsx(
                  'text-[8px] px-1.5 py-0.5 rounded font-bold tracking-wider',
                  entity.threatLevel === 'high' || entity.threatLevel === 'critical' ? 'text-red-400 bg-red-500/10' :
                  entity.threatLevel === 'medium' ? 'text-amber-400 bg-amber-500/10' :
                  'text-zinc-500',
                )}>
                  {entity.threatLevel.toUpperCase()}
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="text-[10px] text-zinc-600 text-center py-4">No matching entities</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
