import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { adopt, welcomeEvent, reconcile, interact, publicPet, GameError, validateName } from './domain.mjs';
import { hash } from './store.mjs';
import { createSandbox, sandboxState, advanceSandbox, careInSandbox } from './lab.mjs';

const PUBLIC = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
function cookie(req) {
  return (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith('pv_session='))?.slice(11);
}
async function body(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new GameError('Se requiere JSON.', 415);
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new GameError('La petición es demasiado grande.', 413);
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new GameError('JSON no válido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GameError('Se requiere un objeto JSON.');
  return value;
}
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createApp({ store, clock = Date.now, publicOrigin, production = false, freeTrial = false, developerTools = false }) {
  if (production && (!publicOrigin || !publicOrigin.startsWith('https://'))) throw new Error('Producción requiere PUBLIC_ORIGIN con HTTPS.');
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) throw new Error('PUBLIC_ORIGIN debe ser solo un origen, sin ruta ni barra final.');
  const sessionLimits = new Map();
  const trialNotice = freeTrial ? 'Prueba gratuita en Render: la base de datos caduca 30 días después de su creación. El servidor puede tardar en despertar. No es almacenamiento permanente.' : null;
  const features = { trialNotice, developerTools };
  const response = (res, status, data, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(data));
  };
  async function snapshot(session, now) {
    const pet = await store.pet(session.userId);
    if (!pet) return { pet: null, events: [], serverNow: now };
    const tick = reconcile(pet, now);
    await store.savePet(session.userId, pet); await store.addEvents(session.userId, tick.events);
    return { pet: publicPet(pet, tick.now), events: await store.events(session.userId), serverNow: tick.now };
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url, 'http://localhost');
      const now = clock();
      if (url.pathname === '/health' && req.method === 'GET') {
        await store.health(); return response(res, 200, { ok: true });
      }
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) throw new GameError('Método no permitido.', 405);
        const path = resolve(PUBLIC, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
        if (!path.startsWith(PUBLIC + sep) || !TYPES[extname(path)]) throw new GameError('No encontrado.', 404);
        let data;
        try { data = await readFile(path); } catch { throw new GameError('No encontrado.', 404); }
        res.writeHead(200, { 'Content-Type': TYPES[extname(path)], 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : data);
      }
      // Sin CORS; JSON + origen exacto + token CSRF protegen todas las escrituras.
      if (!['GET', 'POST'].includes(req.method)) throw new GameError('Método no permitido.', 405);
      if (req.method === 'POST') {
        const origin = publicOrigin ?? `http://${req.headers.host}`;
        if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') throw new GameError('Origen de petición no permitido.', 403, 'origin');
      }
      let session = await store.session(cookie(req), now);
      if (url.pathname === '/api/session') {
        if (req.method === 'GET') return response(res, 200, session ? { authenticated: true, csrf: session.csrf, analytics: Boolean(session.analytics), ...features } : { authenticated: false, ...features });
        await body(req);
        if (session) return response(res, 200, { authenticated: true, csrf: session.csrf, analytics: Boolean(session.analytics), ...features });
        const address = req.socket.remoteAddress ?? 'unknown';
        const window = Math.floor(now / 3_600_000);
        for (const [key, value] of sessionLimits) if (value.window !== window) sessionLimits.delete(key);
        const entry = sessionLimits.get(address) ?? { window, count: 0 };
        if (entry.count >= 20 || sessionLimits.size > 10_000) throw new GameError('Demasiadas sesiones de prueba. Inténtalo más tarde.', 429);
        entry.count++; sessionLimits.set(address, entry);
        const created = await store.createSession(now);
        return response(res, 201, { authenticated: true, csrf: created.csrf, analytics: false, ...features }, {
          'Set-Cookie': `pv_session=${created.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${production ? '; Secure' : ''}`
        });
      }
      if (!session) throw new GameError('Inicia una sesión de prueba para continuar.', 401, 'session_required');
      const labRoute = url.pathname.startsWith('/api/lab/');
      if (labRoute && !developerTools) throw new GameError('El laboratorio no está activado en este servidor.', 404, 'lab_disabled');
      if (url.pathname === '/api/lab/state' && req.method === 'GET') {
        const sandbox = await store.transaction(() => store.sandbox(session.userId), session.userId);
        return response(res, 200, sandbox ? sandboxState(sandbox) : { mode: 'sandbox', pet: null, events: [], lab: null });
      }
      if (url.pathname === '/api/state' && req.method === 'GET') {
        return response(res, 200, await store.transaction(() => snapshot(session, now), session.userId));
      }
      if (req.method !== 'POST') throw new GameError('No encontrado.', 404);
      if (!equal(req.headers['x-csrf-token'], session.csrf)) throw new GameError('La sesión debe actualizarse. Recarga la página.', 403, 'csrf');
      const data = await body(req);
      if (url.pathname === '/api/preferences') {
        if (typeof data.analytics !== 'boolean') throw new GameError('Preferencia no válida.');
        await store.transaction(() => store.analytics(session.userId, data.analytics), session.userId);
        return response(res, 200, { analytics: data.analytics });
      }
      const labCommands = ['/api/lab/start', '/api/lab/reset', '/api/lab/advance', '/api/lab/actions'];
      if (!['/api/adopt', '/api/actions', ...labCommands].includes(url.pathname)) throw new GameError('No encontrado.', 404);
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[\w-]{16,80}$/.test(key)) throw new GameError('Se requiere un identificador único de petición.');
      // Campos extra (edad, propietario, recompensas, estado) nunca forman parte de comandos válidos.
      const field = ['/api/lab/start', '/api/lab/reset'].includes(url.pathname) ? null : url.pathname === '/api/lab/advance' ? 'step' : url.pathname === '/api/adopt' ? 'name' : 'action';
      if (Object.keys(data).some(k => k !== field)) throw new GameError('La petición contiene campos no permitidos.');
      if (field === 'name') data.name = validateName(data.name);
      const fingerprint = hash(JSON.stringify({ path: url.pathname, ...data }));
      const result = await store.transaction(async () => {
        const prior = await store.request(session.userId, key);
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new GameError('Ese identificador ya pertenece a otra petición.', 409, 'idempotency_conflict');
          return { ...JSON.parse(prior.response), replayed: true };
        }
        if (labRoute) {
          let sandbox = await store.sandbox(session.userId);
          let output;
          if (['/api/lab/start', '/api/lab/reset'].includes(url.pathname)) {
            if (!sandbox || url.pathname === '/api/lab/reset') sandbox = createSandbox(await store.pet(session.userId), now);
            output = { ...sandboxState(sandbox), reaction: 'adopt', message: 'Laboratorio listo. Esta mascota y su reloj son de prueba.' };
          } else {
            if (!sandbox) throw new GameError('Abre primero el laboratorio.', 409, 'lab_not_started');
            output = url.pathname === '/api/lab/advance' ? advanceSandbox(sandbox, data.step) : careInSandbox(sandbox, data.action);
          }
          // No tocar pets, events ni métricas del juego: el laboratorio vive en su propia tabla.
          await store.saveSandbox(session.userId, sandbox);
          await store.saveRequest(session.userId, key, fingerprint, output, now);
          return output;
        }
        if (url.pathname === '/api/adopt') {
          if (await store.pet(session.userId)) throw new GameError('Ya tienes una mascota. Cuídala para continuar vuestra historia.', 409, 'already_adopted');
          const pet = adopt(data.name, now);
          await store.savePet(session.userId, pet); await store.addEvents(session.userId, [welcomeEvent(pet)]);
          await store.track(session, 'adopt', now);
          const output = { ...await snapshot(session, now), reaction: 'adopt', message: `${pet.name} ya está en casa.` };
          await store.saveRequest(session.userId, key, fingerprint, output, now); return output;
        }
        const pet = await store.pet(session.userId);
        if (!pet) throw new GameError('Primero adopta una mascota.', 409);
        const tick = reconcile(pet, now);
        const action = interact(pet, data.action, tick.now);
        await store.savePet(session.userId, pet); await store.addEvents(session.userId, [...tick.events, action.event]);
        await store.track(session, data.action, tick.now);
        const output = { pet: publicPet(pet, tick.now), events: await store.events(session.userId), serverNow: tick.now, reaction: action.reaction, message: action.message };
        await store.saveRequest(session.userId, key, fingerprint, output, now); return output;
      }, session.userId);
      return response(res, 200, result);
    } catch (error) {
      const status = error instanceof GameError ? error.status : 500;
      if (status === 500) console.error('Error del servidor:', error.message);
      response(res, status, { error: status === 500 ? 'No pudimos guardar el cambio. Inténtalo de nuevo.' : error.message, code: error.code ?? 'server_error' });
    }
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  return server;
}
