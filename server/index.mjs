import { resolve } from 'node:path';
import { openStore } from './store.mjs';
import { createApp } from './app.mjs';

const store = openStore(resolve(process.env.DATABASE_PATH ?? 'data/petverse.sqlite'));
const server = createApp({ store, publicOrigin: process.env.PUBLIC_ORIGIN, production: process.env.NODE_ENV === 'production' });
const port = Number(process.env.PORT ?? 3000);
server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`PetVerse: http://localhost:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
