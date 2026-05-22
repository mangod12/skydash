import {
  Car, User, Building2, Wifi, AlertTriangle,
} from 'lucide-react';

export const TYPE_ICONS = {
  vehicle: Car, person: User, building: Building2,
  device: Wifi, event: AlertTriangle, organization: Building2,
};

export const TYPE_COLORS = {
  vehicle: 'text-blue-400', person: 'text-violet-400',
  building: 'text-amber-400', device: 'text-cyan-400',
  event: 'text-red-400', organization: 'text-indigo-400',
};

const REL_CATEGORY = {
  located_at: 'data', traveled_to: 'data',
  owns: 'intel', communicates_with: 'intel',
  associated_with: 'suspicious',
};

export const CATEGORY_STYLES = {
  data: { bg: 'bg-cyan-500', text: 'text-cyan-400', label: 'DATA' },
  intel: { bg: 'bg-violet-500', text: 'text-violet-400', label: 'INTEL' },
  suspicious: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'SUSPICIOUS' },
  adversarial: { bg: 'bg-red-500', text: 'text-red-400', label: 'ADVERSARIAL' },
};

export const SORT_OPTIONS = [
  { id: 'name', label: 'NAME' },
  { id: 'type', label: 'TYPE' },
  { id: 'threat', label: 'THREAT' },
  { id: 'connections', label: 'CONNECTIONS' },
];

export const THREAT_ORDER = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
export const MAX_ENTITIES = 20;

export function categorizeRelationship(rel) {
  if (rel.confidence < 30) return 'adversarial';
  return REL_CATEGORY[rel.type] || 'suspicious';
}

export function getCellOpacity(count, maxCount) {
  if (count === 0) return 0;
  return 0.2 + 0.8 * (count / Math.max(maxCount, 1));
}

export function getCssColor(category) {
  const map = { data: '#22d3ee', intel: '#8b5cf6', suspicious: '#f59e0b', adversarial: '#ef4444' };
  return map[category] || '#22d3ee';
}
