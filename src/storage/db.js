import sqlite3 from 'sqlite3';

let db;

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export async function initDb() {
  db = new sqlite3.Database('./rally.sqlite');

  await exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS creators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      target TEXT NOT NULL,
      travel_sec INTEGER NOT NULL DEFAULT 0,
      UNIQUE(guild_id, creator_id, target),
      FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
    );
  `);

  await ensureColumn('creators', 'enabled', `ALTER TABLE creators ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`);
  await ensureColumn('creators', 'default_target', `ALTER TABLE creators ADD COLUMN default_target TEXT NOT NULL DEFAULT ''`);
  await ensureColumn('creators', 'counter_targets_json', `ALTER TABLE creators ADD COLUMN counter_targets_json TEXT NOT NULL DEFAULT '{}'`);
  await ensureColumn('creators', 'enemy_allies_json', `ALTER TABLE creators ADD COLUMN enemy_allies_json TEXT NOT NULL DEFAULT '[]'`);
  await ensureColumn('creators', 'targets_json', `ALTER TABLE creators ADD COLUMN targets_json TEXT NOT NULL DEFAULT '[]'`);

  await ensureColumn('timings', 'travel_sec', `ALTER TABLE timings ADD COLUMN travel_sec INTEGER NOT NULL DEFAULT 0`);

  const hasTravelMin = await hasColumn('timings', 'travel_min');
  if (hasTravelMin) {
    await exec(`UPDATE timings SET travel_sec = travel_min * 60 WHERE travel_sec = 0`);
  }

  return db;
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function tableInfo(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function hasColumn(table, column) {
  const rows = await tableInfo(table);
  return rows.some((r) => r.name === column);
}

async function ensureColumn(table, column, ddl) {
  const exists = await hasColumn(table, column);
  if (!exists) {
    await exec(ddl);
  }
}

export function run(sql, params = []) {
  const d = getDb();
  return new Promise((resolve, reject) => {
    d.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function get(sql, params = []) {
  const d = getDb();
  return new Promise((resolve, reject) => {
    d.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

export function all(sql, params = []) {
  const d = getDb();
  return new Promise((resolve, reject) => {
    d.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
