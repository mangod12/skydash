// Lower bounds shown as "N+". Checked against the source tree in
// platformInventory.test.js: never above the real count, and not stale by more than 25%.
export const INVENTORY = [
  ['Components', 220],
  ['Stores', 15],
  ['Hooks', 14],
  ['Views', 8],
  ['API Endpoints', 60],
  ['Themes', 3],
];

// Small, stable counts are shown exactly; the rest are shown as lower bounds.
const EXACT = new Set(['Views', 'Themes']);
export const formatCount = (label, n) => (EXACT.has(label) ? String(n) : `${n}+`);
