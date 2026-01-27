export function computeSendAt({ rallyAt, travelSec, bufferSec }) {
  const ms = rallyAt.getTime() - (travelSec * 1000) - (bufferSec * 1000);
  return new Date(ms);
}

export function formatUtcTime(dt) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}`;
}

export function calculateAllSendTimes({ now, creators }) {
  const groups = new Map();

  creators.forEach((c) => {
    if (!c.enabled) return;
    if (!c.default_target) return;
    if (!Number.isFinite(c.travel_sec)) return;

    if (!groups.has(c.default_target)) groups.set(c.default_target, []);
    groups.get(c.default_target).push({
      name: c.name,
      target: c.default_target,
      travel_sec: c.travel_sec,
      buffer_sec: c.buffer_sec || 0
    });
  });

  const results = [];
  groups.forEach((group, target) => {
    if (!group.length) return;
    const first = group.reduce((best, g) => {
      const bestValue = best.travel_sec + best.buffer_sec;
      const nextValue = g.travel_sec + g.buffer_sec;
      return nextValue > bestValue ? g : best;
    }, group[0]);

    const firstStart = new Date(now.getTime() + first.buffer_sec * 1000);
    group.forEach((g) => {
      const offsetSeconds = first.travel_sec - g.travel_sec;
      const sendAt = new Date(firstStart.getTime() + offsetSeconds * 1000);
      results.push({
        name: g.name,
        target,
        time: sendAt
      });
    });
  });

  results.sort((a, b) => a.time.getTime() - b.time.getTime());
  return results;
}

export function calculateAgainstEnemy({ now, enemy, allies }) {
  if (!enemy || !Number.isFinite(enemy.travel_sec)) return [];

  const results = [];
  allies.forEach((a) => {
    if (!a.enabled) return;
    if (!Number.isFinite(a.travel_sec)) return;
    if (a.travel_sec > enemy.travel_sec) return;
    if (!a.counter_enabled) return;

    const sendAt = new Date(now.getTime() + (enemy.travel_sec - a.travel_sec) * 1000);
    results.push({
      name: a.name,
      target: enemy.target,
      time: sendAt
    });
  });

  results.sort((a, b) => a.time.getTime() - b.time.getTime());
  return results;
}
