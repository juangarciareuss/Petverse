import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, STAGES, PERSONALITIES, adopt, stageAt, reconcile, interact } from '../server/domain.mjs';
const born = Date.UTC(2026, 9, 12);
test('las etapas cambian solo al cruzar límites temporales', () => {
  for (const [i, stage] of STAGES.entries()) {
    assert.equal(stageAt(born, born + stage.day * DAY).id, stage.id);
    if (i) assert.equal(stageAt(born, born + stage.day * DAY - 1).id, STAGES[i - 1].id);
  }
  assert.equal(stageAt(born, born - DAY).id, 'newborn');
});
test('regresar tras meses avanza etapa sin castigar confianza ni bienestar', () => {
  const pet = adopt('Mochi', born, 'long-absence'); pet.status.trust = 72;
  const result = reconcile(pet, born + 140 * DAY);
  assert.equal(pet.stage, 'advanced'); assert.equal(pet.status.trust, 72);
  assert.ok(pet.status.hunger <= 85); assert.equal(pet.status.wellbeing, 90);
  assert.equal(pet.specialTraits.length, 1);
  assert.equal(result.events.filter(e => e.kind === 'evolution').length, 1);
  assert.ok(result.events.length <= 3);
  const later = reconcile(pet, born + 141 * DAY);
  assert.equal(later.events.filter(e => e.kind === 'evolution').length, 0);
  assert.equal(pet.specialTraits.length, 1);
});
test('un reloj que retrocede no rejuvenece ni duplica eventos', () => {
  const pet = adopt('Luna', born, 'time-regression');
  const forward = reconcile(pet, born + 11 * DAY);
  const backward = reconcile(pet, born + DAY);
  assert.equal(backward.now, forward.now); assert.equal(pet.stage, 'juvenile');
  assert.deepEqual(backward.events, []);
});
test('personalidad modifica cuidados y recuperación real de energía', () => {
  const affection = adopt('A', born, 'a'), playful = adopt('B', born, 'b'), sleepy = adopt('C', born, 'c');
  affection.personality = PERSONALITIES[0]; playful.personality = PERSONALITIES[2]; sleepy.personality = PERSONALITIES[3];
  const generic = structuredClone(playful);
  interact(affection, 'pet', born); interact(generic, 'pet', born);
  assert.equal(affection.status.trust - generic.status.trust, 1);
  playful.status.mood = 60; sleepy.status.mood = 60;
  interact(playful, 'play', born); interact(sleepy, 'play', born);
  assert.equal(playful.status.mood, 75); assert.equal(sleepy.status.mood, 68);
  assert.ok(sleepy.status.energy < playful.status.energy);
  sleepy.status.energy = 1; reconcile(sleepy, born);
  assert.equal(sleepy.status.energy, 1);
  assert.throws(() => interact(sleepy, 'play', born + 15_000), /prefiere/);
  reconcile(sleepy, born + 3_600_000); assert.equal(sleepy.status.energy, 4);
});
test('sorpresas reproducibles y un solo objeto aunque se actualice la página', () => {
  const pet = adopt('Sol', born, 'deterministic-pet'); let found = false;
  for (let i = 0; i < 80; i++) {
    const now = born + i * DAY / 4, copy = structuredClone(pet);
    assert.deepEqual(reconcile(pet, now), reconcile(copy, now));
    assert.deepEqual(reconcile(pet, now).events, []);
    found ||= pet.inventory.length > 0; assert.ok(pet.inventory.length <= 1);
  }
  assert.ok(found, 'Ejercitar al menos un descubrimiento real.');
});
test('cuidar muchas veces no modifica edad y existe cooldown', () => {
  const pet = adopt('Mochi', born, 'care');
  for (let i = 0; i < 100; i++) interact(pet, 'feed', born + i * 15_000);
  assert.equal(pet.bornAt, born); assert.equal(pet.stage, 'newborn'); assert.equal(pet.status.hunger, 0);
  assert.throws(() => interact(pet, 'feed', born + 99 * 15_000), /Dale un momento/);
});
test('nombres Unicode válidos, sin marcado ni controles', () => {
  assert.equal(adopt('  小月  ', born).name, '小月');
  assert.throws(() => adopt('<script>', born));
  assert.throws(() => adopt('x'.repeat(25), born));
  assert.throws(() => adopt('\u0000Hola', born));
});
