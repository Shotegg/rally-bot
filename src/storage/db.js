import pg from 'pg';

let pool;

export function getDb() {
  if (!pool) throw new Error('DB not initialized');
  return pool;
}

function getPoolConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL for Postgres.');
  }

  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  return {
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  };
}

export async function initDb() {
  pool = new pg.Pool(getPoolConfig());

  await exec(`
    CREATE TABLE IF NOT EXISTS creators (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      discord_user_id TEXT NOT NULL DEFAULT '',
      side TEXT NOT NULL CHECK(side IN ('ally','enemy')),
      buffer_sec INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      default_target TEXT NOT NULL DEFAULT '',
      counter_targets_json TEXT NOT NULL DEFAULT '{}',
      enemy_allies_json TEXT NOT NULL DEFAULT '[]',
      targets_json TEXT NOT NULL DEFAULT '[]',
      UNIQUE(guild_id, side, name)
    );

    CREATE TABLE IF NOT EXISTS timings (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      target TEXT NOT NULL,
      travel_sec INTEGER NOT NULL DEFAULT 0,
      UNIQUE(guild_id, creator_id, target)
    );
  `);

  await exec(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS enabled INTEGER NOT NULL DEFAULT 1`);
  await exec(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT ''`);
  await exec(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS discord_user_id TEXT NOT NULL DEFAULT ''`);
  await exec(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS default_target TEXT NOT NULL DEFAULT ''`);
  await exec(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS counter_targets_json TEXT NOT NULL DEFAULT '{}'`);
  await exec(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS enemy_allies_json TEXT NOT NULL DEFAULT '[]'`);
  await exec(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS targets_json TEXT NOT NULL DEFAULT '[]'`);

  await exec(`ALTER TABLE timings ADD COLUMN IF NOT EXISTS travel_sec INTEGER NOT NULL DEFAULT 0`);

  return pool;
}

function toPg(sql, params = []) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

function exec(sql) {
  const { text } = toPg(sql);
  return getDb().query(text);
}

export async function run(sql, params = []) {
  const { text, values } = toPg(sql, params);
  const result = await getDb().query(text, values);
  return result;
}

export async function get(sql, params = []) {
  const { text, values } = toPg(sql, params);
  const result = await getDb().query(text, values);
  return result.rows[0] ?? null;
}

export async function all(sql, params = []) {
  const { text, values } = toPg(sql, params);
  const result = await getDb().query(text, values);
  return result.rows;
}
