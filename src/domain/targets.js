export const TARGETS = ['South Turret', 'West Turret', 'East Turret', 'North Turret', 'Castle'];
export const NO_TARGET = 'No target';

export const TARGET_COORDINATES = {
  'West Turret': { x: 594, y: 604 },
  'South Turret': { x: 594, y: 594 },
  'East Turret': { x: 604, y: 594 },
  'North Turret': { x: 604, y: 604 },
  Castle: { x: 599, y: 599 }
};

// Legacy import aliases: map old/alternate names to the current TARGETS names.
// Example:
// 'Old Turret A': 'Turret 1'
export const TARGET_ALIASES = {
  'Turret 1': 'South Turret',
  'Turret 2': 'West Turret',
  'Turret 3': 'East Turret',
  'Turret 4': 'North Turret',
  'Castle': 'Castle'
};

export function normalizeTargetName(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (TARGETS.includes(raw)) return raw;
  if (TARGET_ALIASES[raw] && TARGETS.includes(TARGET_ALIASES[raw])) return TARGET_ALIASES[raw];

  const lower = raw.toLowerCase();
  const direct = TARGETS.find(t => t.toLowerCase() === lower);
  if (direct) return direct;

  const aliasKey = Object.keys(TARGET_ALIASES).find(k => k.toLowerCase() === lower);
  if (aliasKey) {
    const mapped = TARGET_ALIASES[aliasKey];
    if (TARGETS.includes(mapped)) return mapped;
  }

  return '';
}
