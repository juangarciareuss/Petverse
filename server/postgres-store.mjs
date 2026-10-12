import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from './store.mjs';

export async function openPostgresStore(connectionString, { schema = 'public', createSchema = false, dropSchemaOnClose = false } = {}) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Esquema PostgreSQL no válido.');
  if (dropSchemaOnClose && (!createSchema || !schema.startsWith('petverse_test_'))) throw new Error('Solo se pueden limpiar esquemas aislados de pruebas.');
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000, options: `-c search_path=${schema}` });
  // No registrar errores de conexión completos: pueden contener datos del proveedor.
  pool.on('error', () => console.error('Se perdió una conexión de PostgreSQL.'));
  try {
    if (createSchema) await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at BIGINT NOT NULL, analytics BOOLEAN NOT NULL DEFAULT FALSE);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS pets (user_id TEXT PRIMARY KEY REFERENCES users(id), state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, at BIGINT NOT NULL, payload TEXT NOT NULL, sequence BIGSERIAL UNIQUE);
      CREATE INDEX IF NOT EXISTS events_user_time ON events(user_id, at DESC, sequence DESC);
      CREATE TABLE IF NOT EXISTS requests (user_id TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, at BIGINT NOT NULL, PRIMARY KEY(user_id,key));
      CREATE TABLE IF NOT EXISTS metrics (user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, at BIGINT NOT NULL);
      CREATE INDEX IF NOT EXISTS metrics_time ON metrics(at);
    `);
  } catch (error) { await pool.end(); throw error; }
  const transactionContext = new AsyncLocalStorage();
  const query = (sql, params) => (transactionContext.getStore() ?? pool).query(sql, params);
  let closed = false;
  const store = {
    async close() {
      if (closed) return;
      closed = true;
      try { if (dropSchemaOnClose) await pool.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await pool.end(); }
    },
    async health() { await query('SELECT 1'); },
    async transaction(fn, userId) {
      if (transactionContext.getStore()) throw new Error('No se permiten transacciones anidadas.');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serializar cambios del mismo propietario, incluso entre servidores.
        // Esto protege adopción, objetos únicos, eventos e idempotencia.
        if (userId) await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
        const result = await transactionContext.run(client, fn);
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async createSession(now) {
      const token = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex'), userId = randomUUID();
      await store.transaction(async () => {
        await query('DELETE FROM sessions WHERE expires_at < $1', [now]);
        await query('INSERT INTO users (id,created_at) VALUES ($1,$2)', [userId, now]);
        await query('INSERT INTO sessions VALUES ($1,$2,$3,$4)', [hash(token), userId, csrf, now + 30 * 86_400_000]);
      });
      return { token, csrf, userId };
    },
    async session(token, now) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      const { rows } = await query('SELECT s.user_id AS "userId", s.csrf, u.analytics FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>$2', [hash(token), now]);
      return rows[0] ?? null;
    },
    async pet(userId) {
      const { rows } = await query('SELECT state FROM pets WHERE user_id=$1', [userId]);
      return rows[0] ? JSON.parse(rows[0].state) : null;
    },
    async savePet(userId, pet) {
      await query('INSERT INTO pets VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state', [userId, JSON.stringify(pet)]);
    },
    async addEvents(userId, events) {
      for (const event of events) await query('INSERT INTO events (id,user_id,kind,at,payload) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [event.id, userId, event.kind, event.at, JSON.stringify(event)]);
    },
    async events(userId) {
      const { rows } = await query('SELECT payload FROM events WHERE user_id=$1 ORDER BY at DESC, sequence DESC LIMIT 40', [userId]);
      return rows.map(row => JSON.parse(row.payload));
    },
    async request(userId, key) {
      const { rows } = await query('SELECT fingerprint,response FROM requests WHERE user_id=$1 AND key=$2', [userId, key]);
      return rows[0];
    },
    async saveRequest(userId, key, fingerprint, response, now) {
      await query('INSERT INTO requests VALUES ($1,$2,$3,$4,$5)', [userId, key, fingerprint, JSON.stringify(response), now]);
    },
    async analytics(userId, enabled) {
      await query('UPDATE users SET analytics=$1 WHERE id=$2', [enabled, userId]);
      if (!enabled) await query('DELETE FROM metrics WHERE user_id=$1', [userId]);
    },
    async track(session, kind, now) {
      await query('INSERT INTO metrics SELECT id,$2,$3 FROM users WHERE id=$1 AND analytics=TRUE', [session.userId, kind, now]);
    },
    async reportMetrics() {
      const { rows } = await query('SELECT kind AS evento, COUNT(*) AS total, COUNT(DISTINCT user_id) AS sesiones FROM metrics GROUP BY kind');
      return rows.map(row => ({ ...row, total: Number(row.total), sesiones: Number(row.sesiones) }));
    }
  };
  return store;
}
