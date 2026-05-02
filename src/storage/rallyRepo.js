import { run, get, all } from './db.js';

function normalizeTargets(targets) {
  return [...new Set((targets || []).map(t => String(t).trim()).filter(Boolean))];
}

function normalizeNames(names) {
  return [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))];
}

function toBool01(v) {
  return v ? 1 : 0;
}

function safeJsonParse(value, fallback) {
  try {
    if (value == null || value === '') return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapCreatorRow(row) {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    display_name: row.display_name || row.name || '',
    discord_user_id: row.discord_user_id || '',
    default_target: row.default_target || '',
    targets: safeJsonParse(row.targets_json, []),
    counter_targets: safeJsonParse(row.counter_targets_json, {}),
    enemy_allies: safeJsonParse(row.enemy_allies_json, [])
  };
}

export const rallyRepo = {
  async upsertCreator({
    guildId,
    side,
    name,
    displayName = '',
    discordUserId = '',
    targets = [],
    bufferSec = 0,
    enabled = true,
    defaultTarget = ''
  }) {
    const t = normalizeTargets(targets);

    await run(
      `
      INSERT INTO creators (guild_id, side, name, display_name, discord_user_id, buffer_sec, enabled, default_target, targets_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, side, name)
      DO UPDATE SET
        display_name=excluded.display_name,
        discord_user_id=excluded.discord_user_id,
        buffer_sec=excluded.buffer_sec,
        enabled=excluded.enabled,
        default_target=excluded.default_target,
        targets_json=excluded.targets_json
      `,
      [guildId, side, name, displayName || name, discordUserId || '', bufferSec, toBool01(enabled), defaultTarget, JSON.stringify(t)]
    );

    return this.getCreatorByName({ guildId, side, name });
  },

  async getCreatorByName({ guildId, side, name }) {
    const row = await get(
      `SELECT * FROM creators WHERE guild_id=? AND side=? AND name=?`,
      [guildId, side, name]
    );
    if (!row) return null;
    return mapCreatorRow(row);
  },

  async listCreators({ guildId, side }) {
    const rows = await all(
      `SELECT * FROM creators WHERE guild_id=? AND side=? ORDER BY name ASC`,
      [guildId, side]
    );

    return rows.map(mapCreatorRow);
  },

  async getCreatorById({ guildId, creatorId }) {
    const row = await get(
      `SELECT * FROM creators WHERE guild_id=? AND id=?`,
      [guildId, creatorId]
    );
    if (!row) return null;
    return mapCreatorRow(row);
  },

  async setTiming({ guildId, creatorId, target, travelSec }) {
    await run(
      `
      INSERT INTO timings (guild_id, creator_id, target, travel_sec)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, creator_id, target)
      DO UPDATE SET travel_sec=excluded.travel_sec
      `,
      [guildId, creatorId, target, travelSec]
    );
  },

  async listTimingsForSide({ guildId, side, target }) {
    const rows = await all(
      `
      SELECT c.*, t.travel_sec
      FROM creators c
      LEFT JOIN timings t
        ON t.creator_id=c.id AND t.guild_id=c.guild_id AND t.target=?
      WHERE c.guild_id=? AND c.side=?
      ORDER BY c.name ASC
      `,
      [target, guildId, side]
    );

    return rows.map(r => ({
      ...mapCreatorRow(r),
      travel_sec: (r.travel_sec == null ? null : Number(r.travel_sec))
    }));
  },

  async listCreatorsWithDefaultTarget({ guildId, side, target }) {
    const rows = await all(
      `
      SELECT c.*, t.travel_sec
      FROM creators c
      LEFT JOIN timings t
        ON t.creator_id=c.id AND t.guild_id=c.guild_id AND t.target=c.default_target
      WHERE c.guild_id=? AND c.side=? AND c.default_target=?
      ORDER BY c.name ASC
      `,
      [guildId, side, target]
    );

    return rows.map(r => ({
      ...mapCreatorRow(r),
      travel_sec: (r.travel_sec == null ? null : Number(r.travel_sec))
    }));
  },

  async listCreatorsWithDefaultTargets({ guildId, side }) {
    const rows = await all(
      `
      SELECT c.*, t.travel_sec
      FROM creators c
      LEFT JOIN timings t
        ON t.creator_id=c.id AND t.guild_id=c.guild_id AND t.target=c.default_target
      WHERE c.guild_id=? AND c.side=?
      ORDER BY c.name ASC
      `,
      [guildId, side]
    );

    return rows.map(r => ({
      ...mapCreatorRow(r),
      travel_sec: (r.travel_sec == null ? null : Number(r.travel_sec))
    }));
  },

  async listAllTimings({ guildId }) {
    const rows = await all(
      `
      SELECT creator_id, target, travel_sec
      FROM timings
      WHERE guild_id=?
      `,
      [guildId]
    );

    return rows.map(r => ({
      creator_id: r.creator_id,
      target: r.target,
      travel_sec: (r.travel_sec == null ? null : Number(r.travel_sec))
    }));
  },

  async listTimingsForCreator({ guildId, creatorId }) {
    const rows = await all(
      `
      SELECT target, travel_sec
      FROM timings
      WHERE guild_id=? AND creator_id=?
      `,
      [guildId, creatorId]
    );
    return rows.map(r => ({
      target: r.target,
      travel_sec: (r.travel_sec == null ? null : Number(r.travel_sec))
    }));
  },

  async setDefaultTarget({ guildId, creatorId, target }) {
    await run(
      `UPDATE creators SET default_target=? WHERE guild_id=? AND id=?`,
      [target, guildId, creatorId]
    );
  },

  async setEnabled({ guildId, creatorId, enabled }) {
    await run(
      `UPDATE creators SET enabled=? WHERE guild_id=? AND id=?`,
      [toBool01(enabled), guildId, creatorId]
    );
  },

  async setCounterTarget({ guildId, creatorId, target, enabled }) {
    const row = await get(
      `SELECT counter_targets_json FROM creators WHERE guild_id=? AND id=?`,
      [guildId, creatorId]
    );

    const map = safeJsonParse(row?.counter_targets_json, {});
    map[target] = Boolean(enabled);

    await run(
      `UPDATE creators SET counter_targets_json=? WHERE guild_id=? AND id=?`,
      [JSON.stringify(map), guildId, creatorId]
    );
  },

  async setCounterTargetsMap({ guildId, creatorId, map }) {
    await run(
      `UPDATE creators SET counter_targets_json=? WHERE guild_id=? AND id=?`,
      [JSON.stringify(map || {}), guildId, creatorId]
    );
  },

  async setEnemyAllies({ guildId, creatorId, allies }) {
    const normalized = normalizeNames(allies);
    await run(
      `UPDATE creators SET enemy_allies_json=? WHERE guild_id=? AND id=?`,
      [JSON.stringify(normalized), guildId, creatorId]
    );
  },

  async setEnemyAlly({ guildId, creatorId, allyName, enabled }) {
    const row = await get(
      `SELECT enemy_allies_json FROM creators WHERE guild_id=? AND id=?`,
      [guildId, creatorId]
    );

    const allies = normalizeNames(safeJsonParse(row?.enemy_allies_json, []));
    const next = enabled
      ? normalizeNames([...allies, allyName])
      : allies.filter(name => name !== allyName);

    await run(
      `UPDATE creators SET enemy_allies_json=? WHERE guild_id=? AND id=?`,
      [JSON.stringify(next), guildId, creatorId]
    );
  },

  async deleteCreatorByName({ guildId, side, name }) {
    await run(
      `DELETE FROM creators WHERE guild_id=? AND side=? AND name=?`,
      [guildId, side, name]
    );
  }
};
