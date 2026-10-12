import { createHash, randomUUID } from 'node:crypto';

export const DAY = 86_400_000;
const HOUR = DAY / 24;
export const STAGES = [
  { id: 'newborn', label: 'Recién nacido', day: 0 },
  { id: 'baby', label: 'Bebé', day: 1 },
  { id: 'child', label: 'Infantil', day: 4 },
  { id: 'juvenile', label: 'Juvenil', day: 11 },
  { id: 'teen', label: 'Adolescente', day: 26 },
  { id: 'adult', label: 'Adulto', day: 51 },
  { id: 'advanced', label: 'Evolución especial', day: 101 }
];
export const PERSONALITIES = [
  { id: 'affectionate', label: 'Cariñosa', preference: 'caricias' },
  { id: 'curious', label: 'Curiosa', preference: 'descubrimientos' },
  { id: 'playful', label: 'Juguetona', preference: 'juegos' },
  { id: 'sleepy', label: 'Dormilona', preference: 'momentos tranquilos' }
];
export const ACTIONS = ['feed', 'pet', 'play'];
export class GameError extends Error {
  constructor(message, status = 400, code = 'invalid_request') {
    super(message); this.status = status; this.code = code;
  }
}
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
export function chance(seed) {
  return createHash('sha256').update(seed).digest().readUInt32BE(0) / 2 ** 32;
}
export function stageAt(bornAt, now) {
  const ageDays = Math.max(0, Math.floor((now - bornAt) / DAY));
  return STAGES.findLast(stage => ageDays >= stage.day);
}
export function validateName(value) {
  if (typeof value !== 'string') throw new GameError('Elige un nombre para tu mascota.');
  const name = value.normalize('NFC').trim();
  if ([...name].length < 1 || [...name].length > 24 || /[\p{C}<>]/u.test(name)) {
    throw new GameError('Usa entre 1 y 24 caracteres, sin símbolos de marcado ni controles.');
  }
  return name;
}
export function adopt(name, now, id = randomUUID()) {
  return {
    id, name: validateName(name), species: 'lumis', bornAt: now,
    stage: STAGES[0].id, personality: PERSONALITIES[Math.floor(chance(id) * PERSONALITIES.length)],
    status: { hunger: 25, energy: 85, mood: 80, wellbeing: 90, trust: 10 },
    appearance: { color: ['peach', 'mint', 'lilac'][Math.floor(chance(`${id}:color`) * 3)] },
    specialTraits: [], inventory: [], activities: { feed: 0, pet: 0, play: 0 },
    lastActions: {}, lastVitalsAt: now, lastObservedAt: now,
    lastEventSlot: Math.floor(now / (6 * HOUR)) - 1
  };
}
const event = (pet, kind, title, detail, at, suffix = '') => ({
  id: createHash('sha256').update(`${pet.id}:${kind}:${at}:${suffix}`).digest('hex').slice(0, 32),
  kind, title, detail, at
});
export function welcomeEvent(pet) {
  return event(pet, 'adoption', 'Una pequeña gran amistad', `${pet.name} ha llegado a casa. Vuestra historia empieza hoy.`, pet.bornAt);
}
export function reconcile(pet, requestedNow) {
  // No aceptamos relojes del cliente. Una regresión del reloj del servidor no rejuvenece a la mascota.
  const now = Math.max(requestedNow, pet.lastObservedAt, pet.bornAt);
  const hours = Math.max(0, (now - pet.lastVitalsAt) / HOUR);
  pet.status.hunger = clamp(pet.status.hunger + hours * 2, 0, 85);
  pet.status.energy = clamp(pet.status.energy + hours * (pet.personality.id === 'sleepy' ? 3 : 2));
  pet.status.mood = clamp(pet.status.mood - hours * 0.4, 55, 100);
  // La ausencia no mata ni enferma a la mascota, ni reduce la confianza acumulada.
  pet.lastVitalsAt = now; pet.lastObservedAt = now;
  const events = [];
  const stage = stageAt(pet.bornAt, now);
  if (pet.stage !== stage.id) {
    pet.stage = stage.id;
    events.push(event(pet, 'evolution', 'Un nuevo capítulo', `${pet.name} ha llegado a la etapa ${stage.label.toLowerCase()}. Crece contigo, incluso cuando no estás.`, now));
    if (stage.id === 'advanced' && pet.specialTraits.length === 0) {
      const trait = pet.activities.play > pet.activities.pet ? 'Cola de cometa' : 'Brillo de luna';
      pet.specialTraits.push(trait);
      events.push(event(pet, 'discovery', 'Una sorpresa que llevaba dentro', `${pet.name} ha desarrollado ${trait.toLowerCase()}, inspirado en vuestra historia.`, now));
    }
  }
  const slot = Math.floor(now / (6 * HOUR));
  if (slot > pet.lastEventSlot) {
    // Solo la ventana actual: una larga ausencia no genera cientos de recompensas.
    pet.lastEventSlot = slot;
    const seed = `${pet.id}:surprise:${slot}`;
    const probability = pet.personality.id === 'curious' ? 0.70 : 0.45;
    if (chance(seed) < probability) {
      const options = ['greeting', 'nap', 'gesture'];
      if (!pet.inventory.some(item => item.id === 'moon-pebble')) options.push('find');
      const weighted = [...options, pet.personality.id === 'sleepy' ? 'nap' : pet.personality.id === 'playful' ? 'gesture' : pet.personality.id === 'curious' && options.includes('find') ? 'find' : 'greeting'];
      const kind = weighted[Math.floor(chance(`${seed}:kind`) * weighted.length)];
      const details = {
        greeting: ['Te estaba esperando', `${pet.name} reconoce tus pasos y mueve las orejitas al verte.`],
        nap: ['Una siesta inesperada', `${pet.name} se ha quedado dormida abrazando su propia cola.`],
        gesture: ['Un gesto muy suyo', `${pet.name} inventó un pequeño salto. Parece querer enseñártelo.`],
        find: ['Un tesoro diminuto', `${pet.name} encontró una piedrita de luna y la guardó para ti.`]
      };
      if (kind === 'find') pet.inventory.push({ id: 'moon-pebble', label: 'Piedrita de luna', foundAt: now });
      events.push(event(pet, 'surprise', ...details[kind], now, `${slot}:${kind}`));
    }
  }
  return { now, events };
}
export function interact(pet, action, now) {
  if (!ACTIONS.includes(action)) throw new GameError('Ese cuidado todavía no está disponible.');
  if (pet.lastActions[action] != null && now - pet.lastActions[action] < 15_000) {
    throw new GameError('Dale un momento para disfrutarlo. Prueba otro cuidado.', 429, 'cooldown');
  }
  if (action === 'play' && pet.status.energy < 15) throw new GameError('Ahora prefiere una caricia. Recuperará energía con el descanso.', 409, 'needs_rest');
  pet.lastActions[action] = now;
  pet.activities[action] += 1;
  const personality = pet.personality.id;
  const messages = {
    feed: `${pet.name} saborea su merienda y te mira con gratitud.`,
    pet: personality === 'affectionate' ? `${pet.name} se acurruca en tu mano. ¡Las caricias son su debilidad!` : `${pet.name} cierra los ojitos y se deja querer.`,
    play: personality === 'playful' ? `${pet.name} da un salto de alegría. ¡Podría jugar con esa pelota todo el día!` : personality === 'sleepy' ? `${pet.name} persigue la pelota despacito y luego bosteza. Le gustan los juegos tranquilos.` : `${pet.name} persigue la pelota e inventa un pequeño baile.`
  };
  if (action === 'feed') { pet.status.hunger = clamp(pet.status.hunger - 30); pet.status.energy = clamp(pet.status.energy + 5); }
  if (action === 'pet') pet.status.trust = clamp(pet.status.trust + (personality === 'affectionate' ? 3 : 2));
  if (action === 'play') {
    pet.status.energy = clamp(pet.status.energy - (personality === 'sleepy' ? 12 : 8));
    pet.status.hunger = clamp(pet.status.hunger + 4);
  }
  pet.status.mood = clamp(pet.status.mood + (action === 'play' && personality === 'playful' ? 15 : 8));
  pet.status.wellbeing = clamp(pet.status.wellbeing + 1);
  const titles = { feed: 'Una merienda compartida', pet: 'Un momento de cariño', play: 'Un ratito de juego' };
  return { reaction: action, message: messages[action], event: event(pet, 'activity', titles[action], messages[action], now, `${action}:${pet.activities[action]}`) };
}
export function publicPet(pet, now) {
  const stage = stageAt(pet.bornAt, now);
  const next = STAGES[STAGES.indexOf(stage) + 1] ?? null;
  return {
    ...pet, status: Object.fromEntries(Object.entries(pet.status).map(([k, v]) => [k, Math.round(v)])),
    ageDays: Math.max(0, Math.floor((now - pet.bornAt) / DAY)),
    stage: stage.id, stageLabel: stage.label,
    nextStage: next ? { label: next.label, at: pet.bornAt + next.day * DAY } : null,
    expression: pet.status.energy < 25 ? 'sleepy' : pet.status.mood >= 85 ? 'happy' : 'calm'
  };
}
