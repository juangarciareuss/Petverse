import { resolve } from 'node:path';
import { openStore } from './store.mjs';
import { openPostgresStore } from './postgres-store.mjs';
import { createApp } from './app.mjs';

const store = process.env.DATABASE_URL
  ? await openPostgresStore(process.env.DATABASE_URL)
  : openStore(resolve(process.env.DATABASE_PATH ?? 'data/petverse.sqlite'));
const server = createApp({ store, publicOrigin: process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL, production: process.env.NODE_ENV === 'production', freeTrial: process.env.PETVERSE_TRIAL_MODE === 'render-free' });
const port = Number(process.env.PORT ?? 3000);
server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`PetVerse: http://localhost:${server.address().port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await store.close(); process.exit(0); }));
