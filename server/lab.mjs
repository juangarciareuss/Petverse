import { DAY, STAGES, adopt, welcomeEvent, reconcile, interact, publicPet, GameError } from './domain.mjs';

export const LAB_STEPS = Object.freeze({ '1m': 60_000, '6h': DAY / 4, '1d': DAY, '7d': 7 * DAY });
const MAX_AGE = 3650 * DAY;

export function createSandbox(ownerPet, now) {
  const pet = adopt(ownerPet?.name ?? 'Lumis de prueba', now);
  if (ownerPet) {
    pet.personality = structuredClone(ownerPet.personality);
    pet.appearance = structuredClone(ownerPet.appearance);
  }
  return { pet, virtualNow: now, events: [welcomeEvent(pet)] };
}
function remember(sandbox, events) {
  sandbox.events = [...events.toReversed(), ...sandbox.events].slice(0, 40);
}
export function sandboxState(sandbox) {
  return {
    mode: 'sandbox', serverNow: sandbox.virtualNow,
    pet: publicPet(sandbox.pet, sandbox.virtualNow), events: sandbox.events,
    lab: { simulated: true, elapsedMs: sandbox.virtualNow - sandbox.pet.bornAt }
  };
}
export function advanceSandbox(sandbox, step) {
  if (typeof step !== 'string') throw new GameError('Elige un salto de tiempo disponible.', 400, 'invalid_lab_step');
  let increment = Object.hasOwn(LAB_STEPS, step) ? LAB_STEPS[step] : undefined;
  if (step === 'next_stage') {
    const next = STAGES.find(stage => sandbox.pet.bornAt + stage.day * DAY > sandbox.virtualNow);
    if (!next) throw new GameError('Ya estás en la última etapa. Puedes probar más días o reiniciar la mascota de prueba.', 409, 'last_stage');
    increment = sandbox.pet.bornAt + next.day * DAY - sandbox.virtualNow;
  }
  if (!Number.isFinite(increment) || increment <= 0) throw new GameError('Elige un salto de tiempo disponible.', 400, 'invalid_lab_step');
  if (sandbox.virtualNow + increment - sandbox.pet.bornAt > MAX_AGE) throw new GameError('El laboratorio permite simular hasta diez años. Reinicia la mascota de prueba para continuar.', 409, 'lab_limit');
  sandbox.virtualNow += increment;
  const tick = reconcile(sandbox.pet, sandbox.virtualNow);
  remember(sandbox, tick.events);
  return { ...sandboxState(sandbox), reaction: tick.events.some(e => e.kind === 'evolution') ? 'adopt' : 'idle', message: `Tiempo simulado avanzado. Etapa: ${sandboxState(sandbox).pet.stageLabel.toLowerCase()}.` };
}
export function careInSandbox(sandbox, action) {
  const tick = reconcile(sandbox.pet, sandbox.virtualNow);
  const result = interact(sandbox.pet, action, sandbox.virtualNow);
  remember(sandbox, [...tick.events, result.event]);
  return { ...sandboxState(sandbox), reaction: result.reaction, message: result.message };
}
