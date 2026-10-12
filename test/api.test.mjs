import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openStore } from '../server/store.mjs';
import { openPostgresStore } from '../server/postgres-store.mjs';
import { createApp } from '../server/app.mjs';
import { DAY } from '../server/domain.mjs';
async function fixture(t, path = ':memory:') {
  let now = Date.UTC(2026, 9, 12);
  const store = path === ':memory:' && process.env.PETVERSE_TEST_DATABASE_URL
    ? await openPostgresStore(process.env.PETVERSE_TEST_DATABASE_URL, { schema: `petverse_test_${randomUUID().replaceAll('-', '')}`, createSchema: true, dropSchemaOnClose: true })
    : openStore(path);
  const server = createApp({ store, clock: () => now });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); });
  const request = async (url, { cookie, csrf, data, key, foreignOrigin } = {}) => {
    const response = await fetch(`${origin}${url}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json', Origin: foreignOrigin ?? origin }), ...(key ? { 'Idempotency-Key': key } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const json = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, json, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  };
  const login = async () => {
    const result = await request('/api/session', { data: {} });
    assert.equal(result.status, 201); assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
    return { cookie: result.cookie, csrf: result.json.csrf };
  };
  return { store, request, login, setNow: value => { now = value; }, getNow: () => now };
}
const mutation = (auth, data, key = randomUUID()) => ({ ...auth, data, key });
test('sesión, adopción y tres cuidados reales con historial persistente', async t => {
  const app = await fixture(t), auth = await app.login();
  assert.equal((await app.request('/api/state', auth)).json.pet, null);
  const adopted = await app.request('/api/adopt', mutation(auth, { name: 'Mochi' }));
  assert.equal(adopted.status, 200); assert.equal(adopted.json.pet.name, 'Mochi');
  for (const action of ['feed', 'pet', 'play']) {
    const result = await app.request('/api/actions', mutation(auth, { action }));
    assert.equal(result.status, 200); assert.equal(result.json.reaction, action);
  }
  const saved = await app.request('/api/state', auth);
  assert.deepEqual(saved.json.pet.activities, { feed: 1, pet: 1, play: 1 });
  assert.equal(saved.json.events.filter(e => e.kind === 'activity').length, 3);
  assert.equal((await app.request('/health')).status, 200); assert.equal((await app.request('/')).status, 200);
});
test('aislamiento entre sesiones y protección de origen y CSRF', async t => {
  const app = await fixture(t), owner = await app.login(), stranger = await app.login();
  assert.equal((await app.request('/api/state')).status, 401);
  assert.equal((await app.request('/api/adopt', { ...mutation(owner, { name: 'X' }), foreignOrigin: 'https://evil.example' })).status, 403);
  assert.equal((await app.request('/api/adopt', { ...mutation(owner, { name: 'X' }), csrf: undefined })).status, 403);
  assert.equal((await app.request('/api/adopt', mutation(owner, { name: 'X' }))).status, 200);
  assert.equal((await app.request('/api/state', stranger)).json.pet, null);
  assert.equal((await app.request('/api/actions', mutation(stranger, { action: 'feed' }))).status, 409);
  assert.equal((await app.request('/api/adopt', mutation(stranger, { name: 'Otro', ownerId: 'forged' }))).status, 400);
});
test('idempotencia de adopción y cuidados concurrentes sin duplicar efectos', async t => {
  const app = await fixture(t), auth = await app.login(), adoption = mutation(auth, { name: 'Luna' });
  const results = await Promise.all([app.request('/api/adopt', adoption), app.request('/api/adopt', adoption)]);
  assert.equal(results[0].status, 200); assert.equal(results[1].status, 200);
  assert.equal(results[0].json.pet.id, results[1].json.pet.id);
  const command = mutation(auth, { action: 'pet' });
  const actions = await Promise.all([app.request('/api/actions', command), app.request('/api/actions', command)]);
  assert.equal(actions.filter(r => r.json.replayed).length, 1);
  assert.equal((await app.request('/api/state', auth)).json.pet.activities.pet, 1);
  assert.equal((await app.request('/api/actions', { ...command, data: { action: 'feed' } })).status, 409);
  assert.equal((await app.request('/api/actions', mutation(auth, { action: 'pet' }))).status, 429);
  assert.equal((await app.request('/api/adopt', mutation(auth, { name: 'Duplicada' }))).status, 409);
});
test('edad de servidor y rechazo de fechas del dispositivo', async t => {
  const app = await fixture(t), auth = await app.login();
  await app.request('/api/adopt', mutation(auth, { name: 'Tiempo' }));
  const original = (await app.request('/api/state', auth)).json.pet.bornAt;
  assert.equal((await app.request('/api/actions', mutation(auth, { action: 'feed', bornAt: 0, now: 9999999999999 }))).status, 400);
  app.setNow(original + 4 * DAY);
  const aged = await app.request('/api/state?now=0', auth);
  assert.equal(aged.json.pet.stage, 'child'); assert.equal(aged.json.pet.ageDays, 4); assert.equal(aged.json.pet.bornAt, original);
  assert.equal(aged.json.events.filter(e => e.kind === 'evolution').length, 1);
  assert.equal((await app.request('/api/state', auth)).json.events.filter(e => e.kind === 'evolution').length, 1);
});
test('reabrir SQLite conserva mascota y credenciales de sesión', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'petverse-test-')), path = join(dir, 'game.sqlite');
  // Limpiar después de que fixture cierre el servidor y archivo.
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const app = await fixture(t, path), auth = await app.login();
  const first = await app.request('/api/adopt', mutation(auth, { name: 'Persistente' }));
  const reopened = openStore(path);
  try {
    const session = reopened.session(auth.cookie.slice('pv_session='.length), app.getNow());
    assert.ok(session); assert.equal(reopened.pet(session.userId).id, first.json.pet.id);
    assert.ok(reopened.events(session.userId).some(e => e.kind === 'adoption'));
  } finally { reopened.close(); }
});
test('métricas opcionales: no registrar antes de consentimiento y borrar al revocar', async t => {
  const app = await fixture(t), auth = await app.login();
  await app.request('/api/adopt', mutation(auth, { name: 'Privada' }));
  assert.equal((await app.store.reportMetrics()).reduce((n, row) => n + row.total, 0), 0);
  assert.equal((await app.request('/api/preferences', { ...auth, data: { analytics: true } })).status, 200);
  await app.request('/api/actions', mutation(auth, { action: 'pet' }));
  assert.equal((await app.store.reportMetrics()).reduce((n, row) => n + row.total, 0), 1);
  await app.request('/api/preferences', { ...auth, data: { analytics: false } });
  assert.equal((await app.store.reportMetrics()).reduce((n, row) => n + row.total, 0), 0);
});
test('sin adopción vía GET y HTTPS obligatorio para producción', async t => {
  const app = await fixture(t), auth = await app.login();
  assert.equal((await app.request('/api/adopt?name=forged', auth)).status, 404);
  assert.equal((await app.request('/api/state', auth)).json.pet, null);
  assert.throws(() => createApp({ store: app.store, production: true }), /HTTPS/);
  assert.throws(() => createApp({ store: app.store, publicOrigin: 'https://example.com/' }), /origen/);
});
