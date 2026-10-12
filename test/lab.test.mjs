import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.mjs';
import { openPostgresStore } from '../server/postgres-store.mjs';
import { createApp } from '../server/app.mjs';
import { createSandbox, advanceSandbox } from '../server/lab.mjs';
import { DAY, adopt } from '../server/domain.mjs';

async function fixture(t, developerTools = true) {
  let now = Date.UTC(2026, 9, 12);
  const store = process.env.PETVERSE_TEST_DATABASE_URL
    ? await openPostgresStore(process.env.PETVERSE_TEST_DATABASE_URL, { schema: `petverse_test_${randomUUID().replaceAll('-', '')}`, createSchema: true, dropSchemaOnClose: true })
    : openStore(':memory:');
  const server = createApp({ store, clock: () => now, developerTools });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); });
  async function request(path, auth = {}, data, key = randomUUID()) {
    const response = await fetch(`${origin}/api/${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { Cookie: auth.cookie ?? '', ...(data === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrf ?? '', 'Idempotency-Key': key }) },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    return { status: response.status, value: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function login() {
    const result = await request('session', {}, {});
    assert.equal(result.status, 201);
    return { cookie: result.cookie, csrf: result.value.csrf };
  }
  return { store, request, login, advanceRealClock: ms => { now += ms; } };
}
test('el laboratorio llega al día 101 sin alterar mascota, recuerdos ni métricas reales', async t => {
  const app = await fixture(t), auth = await app.login();
  await app.request('adopt', auth, { name: 'Mochi' });
  await app.request('preferences', auth, { analytics: true });
  const realBefore = (await app.request('state', auth)).value;
  const start = await app.request('lab/start', auth, {});
  assert.equal(start.status, 200); assert.equal(start.value.mode, 'sandbox');
  assert.notEqual(start.value.pet.id, realBefore.pet.id);
  assert.equal(start.value.pet.name, realBefore.pet.name);
  assert.deepEqual(start.value.pet.personality, realBefore.pet.personality);
  await app.request('lab/actions', auth, { action: 'play' });
  const expected = [['baby', 1], ['child', 4], ['juvenile', 11], ['teen', 26], ['adult', 51], ['advanced', 101]];
  for (const [stage, day] of expected) {
    const result = await app.request('lab/advance', auth, { step: 'next_stage' });
    assert.equal(result.status, 200); assert.equal(result.value.pet.stage, stage); assert.equal(result.value.pet.ageDays, day);
  }
  assert.deepEqual((await app.request('state', auth)).value, realBefore);
  assert.deepEqual(await app.store.reportMetrics(), []);
  assert.equal((await app.request('lab/advance', auth, { step: 'next_stage' })).status, 409);
  assert.equal((await app.request('session', auth)).value.authenticated, true, 'Edad simulada no caduca la sesión real');
});
test('reintentos concurrentes no duplican saltos ni reinicios de laboratorio', async t => {
  const app = await fixture(t), auth = await app.login();
  const first = (await app.request('lab/start', auth, {})).value;
  const key = randomUUID();
  const results = await Promise.all([app.request('lab/advance', auth, { step: '1d' }, key), app.request('lab/advance', auth, { step: '1d' }, key)]);
  assert.equal(results.filter(result => result.value.replayed).length, 1);
  assert.equal((await app.request('lab/state', auth)).value.pet.ageDays, 1);
  assert.equal((await app.request('lab/advance', auth, { step: '7d' }, key)).status, 409);
  const resetKey = randomUUID();
  const reset = await app.request('lab/reset', auth, {}, resetKey);
  const repeat = await app.request('lab/reset', auth, {}, resetKey);
  assert.notEqual(reset.value.pet.id, first.pet.id); assert.equal(reset.value.pet.id, repeat.value.pet.id);
  assert.equal((await app.request('lab/state', auth)).value.pet.ageDays, 0);
  assert.equal((await app.request('state', auth)).value.pet, null, 'No adopta una mascota normal al abrir/reiniciar laboratorio');
});
test('laboratorio aislado por sesión, protegido por CSRF y desactivable por servidor', async t => {
  const app = await fixture(t), owner = await app.login(), stranger = await app.login();
  assert.equal((await app.request('lab/start', { cookie: owner.cookie }, {})).status, 403);
  assert.equal((await app.request('lab/state')).status, 401);
  await app.request('lab/start', owner, {});
  await app.request('lab/advance', owner, { step: '7d' });
  assert.equal((await app.request('lab/state', stranger)).value.pet, null);
  assert.equal((await app.request('lab/advance', stranger, { step: '1d' })).status, 409);
  assert.equal((await app.request('lab/advance', owner, { step: '1d', bornAt: 0 })).status, 400);
  const off = await fixture(t, false), auth = await off.login();
  assert.equal((await off.request('session', auth)).value.developerTools, false);
  assert.equal((await off.request('lab/state', auth)).status, 404);
  assert.equal((await off.request('lab/start', auth, {})).status, 404);
});
test('el reloj de laboratorio queda fijo al cerrar y las reglas de cuidados siguen funcionando', async t => {
  const app = await fixture(t), auth = await app.login();
  const first = (await app.request('lab/start', auth, {})).value;
  app.advanceRealClock(DAY);
  assert.equal((await app.request('lab/state', auth)).value.serverNow, first.serverNow);
  assert.equal((await app.request('lab/actions', auth, { action: 'pet' })).status, 200);
  assert.equal((await app.request('lab/actions', auth, { action: 'pet' })).status, 429);
  await app.request('lab/advance', auth, { step: '1m' });
  assert.equal((await app.request('lab/actions', auth, { action: 'pet' })).status, 200);
  // Entrar de nuevo reanuda la simulación sin destruir su historia.
  const resumed = (await app.request('lab/start', auth, {})).value;
  assert.equal(resumed.pet.id, first.pet.id); assert.equal(resumed.pet.activities.pet, 2);
});
test('saltos limitados y fechas absolutas rechazadas también en la simulación', () => {
  const sandbox = createSandbox(null, 1_000_000);
  for (const invalid of ['-1d', '101d', '__proto__', 123, ['1d'], null]) {
    assert.throws(() => advanceSandbox(sandbox, invalid));
    assert.equal(sandbox.virtualNow, 1_000_000);
  }
  sandbox.virtualNow = sandbox.pet.bornAt + 3650 * DAY - 60_000;
  const result = advanceSandbox(sandbox, '1m'); assert.equal(result.pet.ageDays, 3650);
  assert.throws(() => advanceSandbox(sandbox, '1m'), /diez años/);
  assert.equal(sandbox.virtualNow, sandbox.pet.bornAt + 3650 * DAY);
});
test('añadir el laboratorio a SQLite v1 conserva la mascota y sesión existentes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'petverse-lab-upgrade-')), file = join(dir, 'legacy.sqlite');
  let store;
  try {
    const now = Date.UTC(2026, 9, 12);
    store = openStore(file);
    const session = await store.createSession(now), pet = adopt('Mi mascota existente', now);
    await store.transaction(() => store.savePet(session.userId, pet));
    // Reproducir el esquema previo en un archivo aislado sin datos de laboratorio.
    store.db.exec('DROP TABLE sandboxes; PRAGMA user_version=1;');
    store.close(); store = openStore(file);
    assert.deepEqual(store.pet(session.userId), pet);
    assert.equal(store.session(session.token, now).userId, session.userId);
    assert.equal(store.sandbox(session.userId), null);
    assert.equal(store.db.prepare('PRAGMA user_version').get().user_version, 2);
  } finally { if (store) store.close(); rmSync(dir, { recursive: true, force: true }); }
});
