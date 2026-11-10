import http from 'node:http';

import { config } from './config.js';
import { creatorTravelTime } from './domain/creatorTiming.js';
import { TARGETS, TARGET_COORDINATES, normalizeTargetName } from './domain/targets.js';
import { rallyRepo } from './storage/rallyRepo.js';

const JSON_LIMIT = 64 * 1024;

function send(res, status, body, origin = '') {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function getAllowedOrigin(req) {
  const origin = String(req.headers.origin || '');
  if (!origin) return '';
  const allowed = config.dashboardOrigin.split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : '';
}

function isAuthorized(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return Boolean(config.dashboardToken) && token === config.dashboardToken;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > JSON_LIMIT) reject(new Error('Request body is too large.'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function finiteOrNull(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validDiscordUserId(value) {
  const match = String(value || '').trim().match(/^<?@?(\d{15,22})>?$/);
  return match ? match[1] : '';
}

function parseCoordinates(value) {
  const match = String(value || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function selectGuildId(value) {
  const guildId = String(value || config.dashboardGuildId || '');
  return config.guildIds.includes(guildId) ? guildId : '';
}

async function refreshCreatorTimings(guildId, creator) {
  if (!Number.isFinite(creator.coord_x) || !Number.isFinite(creator.coord_y)) return;
  await Promise.all(TARGETS.map(async target => {
    const travelSec = creatorTravelTime(creator, target);
    if (travelSec != null) await rallyRepo.setTiming({ guildId, creatorId: creator.id, target, travelSec });
  }));
}

async function dashboard(guildId) {
  const [allies, enemies, timings] = await Promise.all([
    rallyRepo.listCreators({ guildId, side: 'ally' }),
    rallyRepo.listCreators({ guildId, side: 'enemy' }),
    rallyRepo.listAllTimings({ guildId })
  ]);
  const timingsByCreator = new Map();
  timings.forEach(timing => {
    if (!timingsByCreator.has(timing.creator_id)) timingsByCreator.set(timing.creator_id, {});
    timingsByCreator.get(timing.creator_id)[timing.target] = timing.travel_sec;
  });
  const withTimings = creator => ({
    ...creator,
    timings: Object.fromEntries(TARGETS.map(target => [target, creatorTravelTime(creator, target)]))
  });
  return {
    guildId,
    ownKingdomId: config.ownKingdomId,
    targets: TARGETS.map(target => ({ target, ...TARGET_COORDINATES[target] })),
    allies: allies.map(withTimings),
    enemies: enemies.map(withTimings)
  };
}

async function mightPulse(path) {
  if (!config.mightPulseApiKey) throw new Error('MightPulse is disabled. Set MIGHTPULSE_API_KEY on Render.');
  const response = await fetch(`https://api.mightpulse.com/v1${path}`, {
    headers: { Authorization: `Bearer ${config.mightPulseApiKey}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || `MightPulse request failed (${response.status}).`);
  return body;
}

function rankingRows(payload) {
  const seen = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return [];
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.some(row => row && typeof row === 'object' && (row.governor_id || row.fid || row.uid))) return value;
      for (const item of value) {
        const rows = visit(item);
        if (rows.length) return rows;
      }
      return [];
    }
    const preferred = [
      value.boards?.mystic_trial,
      Array.isArray(value.boards)
        ? value.boards.find(board => board?.key === 'mystic_trial' || board?.board === 'mystic_trial' || board?.slug === 'mystic_trial')
        : value.boards,
      value.board?.mystic_trial,
      value.mystic_trial,
      value.ranks,
      value.entries,
      value.players,
      value.leaderboard,
      value.board,
      value.data
    ];
    for (const candidate of preferred) {
      const rows = visit(candidate);
      if (rows.length) return rows;
    }
    for (const candidate of Object.values(value)) {
      const rows = visit(candidate);
      if (rows.length) return rows;
    }
    return [];
  }
  return visit(payload);
}

async function mysticTrialCandidates(kingdomId) {
  if (!/^\d+$/.test(String(kingdomId))) throw new Error('Kingdom ID must be numeric.');
  const ranking = await mightPulse(`/kingdoms/${kingdomId}/ranks?board=mystic_trial&limit=10`);
  const ranked = rankingRows(ranking).slice(0, 10);
  const ids = ranked.map(player => player.governor_id || player.fid).filter(Boolean);
  if (!ids.length) return {
    kingdomId: String(kingdomId),
    candidates: [],
    fresh: null,
    diagnostic: `MightPulse returned no player rows. Response fields: ${Object.keys(ranking).join(', ') || '(none)'}`
  };
  const details = await mightPulse(`/players?ids=${encodeURIComponent(ids.join(','))}&include=base`);
  const players = details.players || [];
  const byGovernorId = new Map(players.map(entry => [String(entry.governor_id || entry.fid), entry.player || entry]));
  return {
    kingdomId: String(kingdomId),
    fresh: details.fresh ?? null,
    cachedAt: details.cached_at || null,
    candidates: ranked.map(rank => {
      const governorId = String(rank.governor_id || rank.fid || '');
      const player = byGovernorId.get(governorId) || {};
      return {
        playerId: governorId,
        name: player.nick_name || rank.nick_name || `Player ${governorId}`,
        score: rank.score ?? rank.value ?? 0,
        coordX: Number.isFinite(Number(player.x)) ? Number(player.x) : null,
        coordY: Number.isFinite(Number(player.y)) ? Number(player.y) : null,
        fresh: player.fresh ?? details.fresh ?? null,
        cachedAt: player.cached_at || details.cached_at || null
      };
    })
  };
}

async function handleApi(req, res, url, origin) {
  if (!config.dashboardToken) return send(res, 503, { error: 'Dashboard is disabled. Set DASHBOARD_TOKEN on Render.' }, origin);
  if (!isAuthorized(req)) return send(res, 401, { error: 'Unauthorized.' }, origin);

  const guildId = selectGuildId(url.searchParams.get('guildId'));
  if (!guildId) return send(res, 400, { error: 'Unknown guild.' }, origin);

  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    return send(res, 200, await dashboard(guildId), origin);
  }

  if (req.method === 'PUT' && url.pathname === '/api/creators') {
    const body = await readJson(req);
    const side = body.side === 'enemy' ? 'enemy' : body.side === 'ally' ? 'ally' : '';
    const name = String(body.name || '').trim();
    const defaultTarget = body.defaultTarget ? normalizeTargetName(body.defaultTarget) : '';
    const coordinates = parseCoordinates(body.coordinates);
    const coordX = coordinates?.x ?? finiteOrNull(body.coordX);
    const coordY = coordinates?.y ?? finiteOrNull(body.coordY);
    const petBonusPercent = Math.max(0, finiteOrNull(body.petBonusPercent) ?? 30);
    const petsUntil = Math.max(0, Math.floor(Number(body.petsUntil) || 0));
    if (!side || !name || name.length > 80 || (body.defaultTarget && !defaultTarget)) {
      return send(res, 400, { error: 'Creator side, name, or default target is invalid.' }, origin);
    }
    if ((coordX == null) !== (coordY == null)) {
      return send(res, 400, { error: 'Coordinates must be in the form X,Y.' }, origin);
    }
    const creator = await rallyRepo.upsertCreator({
      guildId, side, name,
      displayName: String(body.displayName || '').trim(),
      discordUserId: validDiscordUserId(body.discordUserId),
      playerId: String(body.playerId || '').trim(),
      coordX, coordY, petBonusPercent, petsUntil,
      bufferSec: Math.max(0, Math.floor(Number(body.bufferSec) || 0)),
      enabled: body.enabled !== false,
      defaultTarget
    });
    await refreshCreatorTimings(guildId, creator);
    return send(res, 200, { creator }, origin);
  }

  if (req.method === 'PUT' && url.pathname === '/api/counters') {
    const body = await readJson(req);
    const side = body.side === 'enemy' ? 'enemy' : body.side === 'ally' ? 'ally' : '';
    const name = String(body.name || '').trim();
    const creator = side && name ? await rallyRepo.getCreatorByName({ guildId, side, name }) : null;
    if (!creator) return send(res, 404, { error: 'Creator not found.' }, origin);

    if (side === 'ally') {
      const target = normalizeTargetName(body.target);
      if (!target || typeof body.enabled !== 'boolean') return send(res, 400, { error: 'Target and enabled state are required.' }, origin);
      await rallyRepo.setCounterTarget({ guildId, creatorId: creator.id, target, enabled: body.enabled });
    } else {
      const allies = Array.isArray(body.allies) ? body.allies.map(value => String(value).trim()).filter(Boolean) : null;
      if (!allies) return send(res, 400, { error: 'Allies list is required.' }, origin);
      await rallyRepo.setEnemyAllies({ guildId, creatorId: creator.id, allies });
    }
    return send(res, 200, { ok: true }, origin);
  }

  if (req.method === 'GET' && url.pathname === '/api/mightpulse/mystic-trial') {
    const kingdomId = url.searchParams.get('kingdomId') || '';
    return send(res, 200, await mysticTrialCandidates(kingdomId), origin);
  }

  if (req.method === 'POST' && url.pathname === '/api/mightpulse/import') {
    const body = await readJson(req);
    const side = body.side === 'enemy' ? 'enemy' : body.side === 'ally' ? 'ally' : '';
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 10) : [];
    if (!side || !candidates.length) return send(res, 400, { error: 'Side and at least one selected player are required.' }, origin);
    const saved = [];
    for (const candidate of candidates) {
      const name = String(candidate.name || '').trim();
      const playerId = String(candidate.playerId || '').trim();
      const coordX = finiteOrNull(candidate.coordX);
      const coordY = finiteOrNull(candidate.coordY);
      if (!name || !playerId || (coordX == null) !== (coordY == null)) continue;
      const existing = await rallyRepo.getCreatorByName({ guildId, side, name });
      const creator = await rallyRepo.upsertCreator({
        guildId, side, name,
        displayName: existing?.display_name || name,
        discordUserId: existing?.discord_user_id || '',
        playerId, coordX, coordY,
        petBonusPercent: existing?.pet_bonus_percent ?? 30,
        petsUntil: existing?.pets_until ?? 0,
        bufferSec: existing?.buffer_sec ?? 0,
        enabled: existing?.enabled ?? true,
        defaultTarget: existing?.default_target || ''
      });
      await refreshCreatorTimings(guildId, creator);
      saved.push(creator.name);
    }
    return send(res, 200, { saved });
  }

  if (req.method === 'DELETE' && url.pathname === '/api/creators') {
    const body = await readJson(req);
    const side = body.side === 'enemy' ? 'enemy' : body.side === 'ally' ? 'ally' : '';
    const name = String(body.name || '').trim();
    if (!side || !name) return send(res, 400, { error: 'Creator side and name are required.' }, origin);
    await rallyRepo.deleteCreatorByName({ guildId, side, name });
    return send(res, 200, { ok: true }, origin);
  }

  return send(res, 404, { error: 'API route not found.' }, origin);
}

export function startKeepAlive() {
  const port = Number(process.env.PORT);
  if (!port) return;

  const server = http.createServer(async (req, res) => {
    const origin = getAllowedOrigin(req);
    if (req.method === 'OPTIONS' && req.url?.startsWith('/api/')) {
      if (!origin) return send(res, 403, { error: 'Origin is not allowed.' });
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        Vary: 'Origin'
      });
      return res.end();
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
      if (url.pathname.startsWith('/api/')) {
        if (!origin) return send(res, 403, { error: 'Origin is not allowed.' });
        return await handleApi(req, res, url, origin);
      }
      return send(res, 404, { error: 'Not found.' });
    } catch (error) {
      console.error('HTTP API error', error);
      return send(res, 500, { error: error.message || 'Internal server error.' }, origin);
    }
  });

  server.listen(port, () => console.log(`HTTP server listening on ${port}.`));
}
