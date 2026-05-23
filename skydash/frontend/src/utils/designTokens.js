// Centralized color constants matching CSS design tokens
// Use these instead of hardcoded hex values

export const COLORS = {
  brand: '#6366f1',      // indigo-500
  brandLight: '#818cf8', // indigo-400
  data: '#06b6d4',       // cyan-500
  dataLight: '#22d3ee',  // cyan-400
  healthy: '#10b981',    // emerald-500
  warning: '#f59e0b',    // amber-500
  critical: '#ef4444',   // red-500
  criticalDark: '#dc2626', // red-600
  intel: '#8b5cf6',      // violet-500
  intelLight: '#a78bfa', // violet-400
  muted: '#71717a',      // zinc-500
  surface: '#09090b',    // zinc-950
};

export const THREAT_COLORS = {
  none: COLORS.muted,
  low: COLORS.healthy,
  medium: COLORS.warning,
  high: COLORS.critical,
  critical: COLORS.criticalDark,
};

export const PATTERN_COLORS = {
  orbit: COLORS.dataLight,
  grid: COLORS.warning,
  waypoint: COLORS.intel,
};
