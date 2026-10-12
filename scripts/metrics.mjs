import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
const db = new DatabaseSync(resolve(process.env.DATABASE_PATH ?? 'data/petverse.sqlite'), { readOnly: true });
console.log('Solo sesiones con consentimiento; no representa a todos los jugadores.');
console.table(db.prepare('SELECT kind AS evento, COUNT(*) AS total, COUNT(DISTINCT user_id) AS sesiones FROM metrics GROUP BY kind').all());
db.close();
