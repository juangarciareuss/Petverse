import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openPostgresStore } from '../server/postgres-store.mjs';
import { adopt, welcomeEvent } from '../server/domain.mjs';
const connectionString = process.env.PETVERSE_TEST_DATABASE_URL;

test('PostgreSQL conserva mascota, cookie y recuerdos tras cerrar y reabrir conexiones', { skip: !connectionString }, async () => {
  const schema = `petverse_test_${randomUUID().replaceAll('-', '')}`, now = Date.UTC(2026, 9, 12);
  let first, second;
  try {
    first = await openPostgresStore(connectionString, { schema, createSchema: true });
    const session = await first.createSession(now);
    const pet = adopt('Luna', now);
    await first.transaction(async () => {
      await first.savePet(session.userId, pet); await first.addEvents(session.userId, [welcomeEvent(pet)]);
    }, session.userId);
    await first.close();
    second = await openPostgresStore(connectionString, { schema, createSchema: true, dropSchemaOnClose: true });
    assert.equal((await second.session(session.token, now)).userId, session.userId);
    assert.equal((await second.pet(session.userId)).name, 'Luna');
    assert.equal((await second.events(session.userId)).filter(e => e.kind === 'adoption').length, 1);
  } finally {
    if (first) await first.close();
    if (second) await second.close();
    else if (first) { const cleanup = await openPostgresStore(connectionString, { schema, createSchema: true, dropSchemaOnClose: true }); await cleanup.close(); }
  }
});
test('PostgreSQL revierte cambios fallidos y serializa modificaciones de dos servidores', { skip: !connectionString }, async () => {
  const schema = `petverse_test_${randomUUID().replaceAll('-', '')}`, now = Date.UTC(2026, 9, 12);
  const first = await openPostgresStore(connectionString, { schema, createSchema: true, dropSchemaOnClose: true });
  let second;
  try {
    second = await openPostgresStore(connectionString, { schema });
    const session = await first.createSession(now);
    await assert.rejects(first.transaction(async () => {
      await first.savePet(session.userId, adopt('No debe guardarse', now));
      throw new Error('Fallo simulado antes de commit');
    }, session.userId));
    assert.equal(await first.pet(session.userId), null);
    await first.transaction(() => first.savePet(session.userId, adopt('Mochi', now)), session.userId);
    const increment = store => store.transaction(async () => {
      const pet = await store.pet(session.userId);
      pet.activities.pet += 1; await store.savePet(session.userId, pet);
    }, session.userId);
    await Promise.all([increment(first), increment(second)]);
    assert.equal((await first.pet(session.userId)).activities.pet, 2);
    // Simular una acción iniciada antes de revocar: el consentimiento actual manda.
    await first.transaction(() => first.analytics(session.userId, true), session.userId);
    const oldSession = await first.session(session.token, now);
    await first.transaction(() => first.analytics(session.userId, false), session.userId);
    await second.transaction(() => second.track(oldSession, 'pet', now), session.userId);
    assert.deepEqual(await first.reportMetrics(), []);
  } finally { if (second) await second.close(); await first.close(); }
});
