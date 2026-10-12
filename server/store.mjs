import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  if (db.prepare('PRAGMA user_version').get().user_version > 2) {
    db.close(); throw new Error('La base SQLite pertenece a una versión más reciente de PetVerse.');
  }
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, analytics INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pets (user_id TEXT PRIMARY KEY REFERENCES users(id), state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sandboxes (user_id TEXT PRIMARY KEY REFERENCES users(id), state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_user_time ON events(user_id, at DESC);
    CREATE TABLE IF NOT EXISTS requests (user_id TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(user_id,key));
    CREATE TABLE IF NOT EXISTS metrics (user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS metrics_time ON metrics(at);
    PRAGMA user_version=2;
  `);
  let transactionQueue = Promise.resolve();
  const store = {
    db,
    close: () => db.close(),
    health() { db.prepare('SELECT 1').get(); },
    transaction(fn) {
      // La API puede esperar un backend remoto. Serializar la conexión SQLite para
      // no entrelazar transacciones cuando el callback cede el control con await.
      const execute = async () => {
        db.exec('BEGIN IMMEDIATE');
        try { const value = await fn(); db.exec('COMMIT'); return value; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      };
      const pending = transactionQueue.then(execute);
      transactionQueue = pending.catch(() => {});
      return pending;
    },
    async createSession(now) {
      const token = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex'), userId = randomUUID();
      await store.transaction(() => {
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
        db.prepare('INSERT INTO users (id,created_at) VALUES (?,?)').run(userId, now);
        db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(hash(token), userId, csrf, now + 30 * 86_400_000);
      });
      return { token, csrf, userId };
    },
    session(token, now) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      return db.prepare('SELECT s.user_id AS userId, s.csrf, u.analytics FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash(token), now) ?? null;
    },
    pet(userId) {
      const row = db.prepare('SELECT state FROM pets WHERE user_id=?').get(userId);
      return row ? JSON.parse(row.state) : null;
    },
    savePet(userId, pet) { db.prepare('INSERT INTO pets VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state').run(userId, JSON.stringify(pet)); },
    sandbox(userId) {
      const row = db.prepare('SELECT state FROM sandboxes WHERE user_id=?').get(userId);
      return row ? JSON.parse(row.state) : null;
    },
    saveSandbox(userId, state) {
      db.prepare('INSERT INTO sandboxes VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state').run(userId, JSON.stringify(state));
    },
    addEvents(userId, events) {
      const insert = db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?)');
      for (const e of events) insert.run(e.id, userId, e.kind, e.at, JSON.stringify(e));
    },
    events(userId) {
      return db.prepare('SELECT payload FROM events WHERE user_id=? ORDER BY at DESC, rowid DESC LIMIT 40').all(userId).map(row => JSON.parse(row.payload));
    },
    request(userId, key) { return db.prepare('SELECT fingerprint, response FROM requests WHERE user_id=? AND key=?').get(userId, key); },
    saveRequest(userId, key, fingerprint, response, now) {
      db.prepare('INSERT INTO requests VALUES (?,?,?,?,?)').run(userId, key, fingerprint, JSON.stringify(response), now);
    },
    analytics(userId, enabled) {
      db.prepare('UPDATE users SET analytics=? WHERE id=?').run(enabled ? 1 : 0, userId);
      if (!enabled) db.prepare('DELETE FROM metrics WHERE user_id=?').run(userId);
    },
    track(session, kind, now) {
      // Releer consentimiento dentro de la transacción: una petición iniciada
      // antes de revocarlo no debe volver a registrar métricas después.
      db.prepare('INSERT INTO metrics SELECT id,?,? FROM users WHERE id=? AND analytics=1').run(kind, now, session.userId);
    },
    reportMetrics() {
      return db.prepare('SELECT kind AS evento, COUNT(*) AS total, COUNT(DISTINCT user_id) AS sesiones FROM metrics GROUP BY kind').all();
    }
  };
  return store;
}
