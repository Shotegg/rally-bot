import http from 'node:http';

import { config } from './config.js';
import { calculateMarchTime } from './domain/marchTime.js';
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

function selectGuildId(value) {
  const guildId = String(value || config.guildIds[0] || '');
  return config.guildIds.includes(guildId) ? guildId : '';
}

async function refreshCreatorTimings(guildId, creator) {
  if (!Number.isFinite(creator.coord_x) || !Number.isFinite(creator.coord_y) || creator.speed_buff <= 0) return;
  await Promise.all(TARGETS.map(async target => {
    const coordinates = TARGET_COORDINATES[target];
    const travelSec = calculateMarchTime({
      fromX: creator.coord_x, fromY: creator.coord_y,
      toX: coordinates.x, toY: coordinates.y,
      speedBuff: creator.speed_buff
    });
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
  const withTimings = creator => ({ ...creator, timings: timingsByCreator.get(creator.id) || {} });
  return {
    guildId,
    ownKingdomId: config.ownKingdomId,
    targets: TARGETS.map(target => ({ target, ...TARGET_COORDINATES[target] })),
    allies: allies.map(withTimings),
    enemies: enemies.map(withTimings)
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
    const coordX = finiteOrNull(body.coordX);
    const coordY = finiteOrNull(body.coordY);
    const speedBuff = finiteOrNull(body.speedBuff);
    if (!side || !name || name.length > 80 || (body.defaultTarget && !defaultTarget)) {
      return send(res, 400, { error: 'Creator side, name, or default target is invalid.' }, origin);
    }
    if ((coordX == null) !== (coordY == null) || (speedBuff != null && speedBuff <= 0)) {
      return send(res, 400, { error: 'Coordinates must be a complete pair and speed buff must be positive.' }, origin);
    }
    const creator = await rallyRepo.upsertCreator({
      guildId, side, name,
      displayName: String(body.displayName || '').trim(),
      discordUserId: validDiscordUserId(body.discordUserId),
      playerId: String(body.playerId || '').trim(),
      coordX, coordY, speedBuff: speedBuff ?? 1,
      bufferSec: Math.max(0, Math.floor(Number(body.bufferSec) || 0)),
      enabled: body.enabled !== false,
      defaultTarget
    });
    await refreshCreatorTimings(guildId, creator);
    return send(res, 200, { creator }, origin);
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
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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
