import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { openPostgresStore } from '../server/postgres-store.mjs';
const store = process.env.DATABASE_URL ? await openPostgresStore(process.env.DATABASE_URL) : null;
const db = store ? null : new DatabaseSync(resolve(process.env.DATABASE_PATH ?? 'data/petverse.sqlite'), { readOnly: true });
console.log('Solo sesiones con consentimiento; no representa a todos los jugadores.');
console.table(store ? await store.reportMetrics() : db.prepare('SELECT kind AS evento, COUNT(*) AS total, COUNT(DISTINCT user_id) AS sesiones FROM metrics GROUP BY kind').all());
if (store) await store.close(); else db.close();
