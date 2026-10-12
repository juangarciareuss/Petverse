const $ = selector => document.querySelector(selector);
let csrf, state, analytics = false, busy = false, expanded = false, installPrompt, reactionTimer, noticeTimer;
const endpoint = async (path, data, key) => {
  const headers = {};
  if (data !== undefined) { headers['Content-Type'] = 'application/json'; if (csrf) headers['X-CSRF-Token'] = csrf; }
  if (key) headers['Idempotency-Key'] = key;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api/${path}`, { method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data), credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    const value = await response.json();
    if (!response.ok) { const error = new Error(value.error ?? 'No pudimos completar la petición.'); error.code = value.code; throw error; }
    $('#connection').textContent = 'Guardado en casa'; $('#connection').dataset.offline = 'false';
    return value;
  } finally { clearTimeout(timeout); }
};
function notify(message) {
  $('#notice').textContent = message; clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('#notice').textContent = ''; }, 6500);
}
function networkError(error) {
  if (error.code) return error.message;
  $('#connection').textContent = 'Sin conexión'; $('#connection').dataset.offline = 'true';
  return 'No hemos podido confirmar el guardado. Comprueba tu conexión y vuelve a intentar.';
}
function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll('[data-action], #pet-touch, #adopt-form button')) button.disabled = value || (button.id === 'pet-touch' && !state?.pet);
  $('#adopt-form').setAttribute('aria-busy', String(value));
}
function renderHistory() {
  const events = state.events;
  $('#story-count').textContent = events.length;
  $('#history-toggle').hidden = events.length <= 3;
  $('#history-toggle').setAttribute('aria-expanded', String(expanded));
  $('#history-toggle').textContent = expanded ? 'Ver menos recuerdos ↑' : 'Ver más recuerdos →';
  const list = $('#history'); list.replaceChildren();
  const labels = { adoption: 'EL PRIMER DÍA', activity: 'UN RATITO JUNTOS', evolution: 'CRECIMIENTO', discovery: 'DESCUBRIMIENTO', surprise: 'UNA SORPRESA' };
  for (const event of (expanded ? events : events.slice(0, 3))) {
    const li = document.createElement('li');
    const meta = document.createElement('div'); meta.className = 'event-type';
    const label = document.createElement('span'); label.textContent = labels[event.kind] ?? 'UN RECUERDO';
    const time = document.createElement('time'); time.dateTime = new Date(event.at).toISOString();
    // Fechas absolutas: el reloj del teléfono no participa en calcular la edad.
    time.textContent = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(event.at);
    meta.append(label, time);
    const title = document.createElement('h3'); title.textContent = event.title;
    const detail = document.createElement('p'); detail.textContent = event.detail;
    li.append(meta, title, detail); list.append(li);
  }
}
function render() {
  $('#loading').hidden = true; $('#offline').hidden = true; $('#game').hidden = false;
  const pet = state.pet, adopted = Boolean(pet);
  for (const id of ['pet-panel', 'care-section', 'story-section', 'share-button']) $(`#${id}`).hidden = !adopted;
  $('#adoption-panel').hidden = adopted; $('#pet-touch').disabled = !adopted || busy;
  if (!pet) return;
  $('#heading').textContent = `Hola, ${pet.name}.`; $('#subtitle').textContent = 'Qué bonito tener un ratito para vosotros.';
  $('#stage-badge').textContent = `${pet.stageLabel.toUpperCase()} · DÍA ${pet.ageDays}`;
  $('#pet-scene').dataset.color = pet.appearance.color; $('#pet-scene').dataset.stage = pet.stage; $('#pet-scene').dataset.expression = pet.expression;
  $('#pet-touch').setAttribute('aria-label', `Acariciar a ${pet.name}`);
  $('#pet-art').setAttribute('aria-label', `${pet.name}, Lumis ${pet.stageLabel.toLowerCase()} de personalidad ${pet.personality.label.toLowerCase()}`);
  const moods = { happy: 'Está feliz de tenerte cerca.', sleepy: 'Le apetece descansar un poquito.', calm: 'Está a gusto en su pequeño hogar.' };
  $('#pet-mood').textContent = `${pet.name} ${moods[pet.expression].charAt(0).toLowerCase()}${moods[pet.expression].slice(1)}`;
  for (const element of document.querySelectorAll('[data-meter]')) {
    const key = element.dataset.meter;
    const value = key === 'hunger' ? 100 - pet.status.hunger : pet.status[key];
    element.querySelector('progress').value = value; element.querySelector('strong').textContent = `${value} / 100`;
  }
  $('#personality-label').textContent = `Una personalidad ${pet.personality.label.toLowerCase()}`;
  const descriptions = { affectionate: 'Las caricias refuerzan especialmente vuestra confianza.', curious: 'Su curiosidad hace más frecuentes los descubrimientos.', playful: 'Los juegos le dan una dosis extra de alegría.', sleepy: 'Juega con calma y recupera energía más rápido al descansar.' };
  $('#personality-description').textContent = descriptions[pet.personality.id];
  $('#age-label').textContent = `${pet.ageDays} ${pet.ageDays === 1 ? 'día' : 'días'} contigo`;
  if (pet.nextStage) {
    const hours = Math.max(0, Math.ceil((pet.nextStage.at - state.serverNow) / 3_600_000));
    const duration = hours >= 24 ? `${Math.ceil(hours / 24)} días` : `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    $('#growth-description').textContent = `Próxima etapa: ${pet.nextStage.label.toLowerCase()}, en ${duration}. El tiempo sigue contando aunque cierres el juego.`;
  } else $('#growth-description').textContent = `Su historia sigue creciendo. Rasgo especial: ${pet.specialTraits.join(', ')}.`;
  $('#inventory').hidden = pet.inventory.length === 0;
  $('#inventory').textContent = `Sus pequeños tesoros: ${pet.inventory.map(item => item.label).join(', ')}. Solo recuerdos, sin ventajas de progreso.`;
  renderHistory();
}
function animate(reaction) {
  clearTimeout(reactionTimer); $('#pet-scene').dataset.reaction = 'idle';
  requestAnimationFrame(() => { $('#pet-scene').dataset.reaction = reaction; });
  reactionTimer = setTimeout(() => { $('#pet-scene').dataset.reaction = 'idle'; }, 2600);
}
// Si la red corta la respuesta después de guardar, conservamos la clave para reintentar sin duplicar.
function pendingCommand(path, payload) {
  let prior;
  try { prior = JSON.parse(sessionStorage.getItem('pv_pending')); } catch { /* almacenamiento restringido */ }
  if (prior?.path === path && JSON.stringify(prior.payload) === JSON.stringify(payload)) return prior;
  const key = crypto.randomUUID?.() ?? [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
  const command = { path, payload, key };
  try { sessionStorage.setItem('pv_pending', JSON.stringify(command)); } catch { /* modo privado restringido */ }
  return command;
}
async function command(path, payload) {
  if (busy) return;
  const pending = pendingCommand(path, payload);
  setBusy(true);
  try {
    const result = await endpoint(path, payload, pending.key);
    try { sessionStorage.removeItem('pv_pending'); } catch { /* opcional */ }
    // Un replay puede contener una foto anterior: refrescamos la vista autoritativa.
    state = result.replayed ? await endpoint('state') : result;
    render(); animate(result.reaction); notify(result.message);
  } catch (error) {
    if (error.code) try { sessionStorage.removeItem('pv_pending'); } catch { /* opcional */ }
    notify(networkError(error));
  } finally { setBusy(false); }
}
async function bootstrap() {
  $('#loading').hidden = false; $('#offline').hidden = true;
  try {
    let session = await endpoint('session');
    if (!session.authenticated) session = await endpoint('session', {});
    csrf = session.csrf; analytics = session.analytics;
    $('#analytics-consent').checked = analytics;
    state = await endpoint('state'); render();
  } catch (error) {
    $('#loading').hidden = true; $('#offline').hidden = false; $('#game').hidden = true;
    $('#offline-message').textContent = error.code ? error.message : 'Necesitamos conexión para guardar los cuidados y consultar la edad de tu mascota.';
    networkError(error);
  }
}
$('#adopt-form').addEventListener('submit', event => { event.preventDefault(); command('adopt', { name: $('#pet-name').value.trim() }); });
for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => command('actions', { action: button.dataset.action }));
$('#pet-touch').addEventListener('click', () => command('actions', { action: 'pet' }));
$('#retry').addEventListener('click', bootstrap);
$('#history-toggle').addEventListener('click', () => { expanded = !expanded; renderHistory(); });
$('#settings-button').addEventListener('click', () => $('#settings').showModal());
$('#analytics-consent').addEventListener('change', async event => {
  const input = event.target; input.disabled = true;
  try { const value = await endpoint('preferences', { analytics: input.checked }); analytics = value.analytics; notify(analytics ? 'Gracias. Las métricas de uso están activadas.' : 'Métricas desactivadas y registros de uso borrados.'); }
  catch (error) { input.checked = analytics; notify(networkError(error)); }
  finally { input.disabled = false; }
});
async function refresh() {
  if (!csrf || busy || document.hidden || $('#settings').open) return;
  try { state = await endpoint('state'); render(); }
  catch (error) { if (error.code === 'session_required') await bootstrap(); else networkError(error); }
}
setInterval(refresh, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('online', () => { if (!csrf) bootstrap(); else refresh(); });
window.addEventListener('offline', () => { $('#connection').textContent = 'Sin conexión'; $('#connection').dataset.offline = 'true'; });
$('#share-button').addEventListener('click', async () => {
  if (!state?.pet) return;
  const button = $('#share-button'); button.disabled = true;
  try {
    const pet = state.pet, svg = $('#pet-art').cloneNode(true);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', '520'); svg.setAttribute('height', '540');
    // Convertimos estilos dependientes de CSS en atributos del recurso exportado.
    const colors = { peach: ['#ffe0bc', '#ecb58e'], mint: ['#d7edcd', '#a7c795'], lilac: ['#ede0f2', '#c6acd3'] }[pet.appearance.color];
    svg.querySelector('.fur-light').setAttribute('stop-color', colors[0]); svg.querySelector('.fur-dark').setAttribute('stop-color', colors[1]);
    svg.querySelector('.eyes-closed').setAttribute('opacity', '0');
    svg.querySelector('.advanced-star').setAttribute('display', pet.stage === 'advanced' ? 'block' : 'none');
    const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
    const image = new Image();
    try { image.src = url; await image.decode(); }
    finally { URL.revokeObjectURL(url); }
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1100;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eff2e5'; ctx.fillRect(0, 0, 900, 1100);
    ctx.textAlign = 'center'; ctx.fillStyle = '#385b43'; ctx.font = 'bold 44px system-ui'; ctx.fillText('petverse.', 450, 100);
    ctx.font = '24px system-ui'; ctx.fillStyle = '#7b896c'; ctx.fillText('Una pequeña amistad que crece', 450, 157);
    ctx.drawImage(image, 190, 245, 520, 540);
    ctx.fillStyle = '#385b43'; ctx.font = '48px Georgia'; ctx.fillText(pet.name, 450, 875, 790);
    ctx.font = '25px system-ui'; ctx.fillStyle = '#7b896c'; ctx.fillText(`${pet.stageLabel} · ${pet.ageDays} días contigo`, 450, 929);
    ctx.font = '23px Georgia'; ctx.fillText('Crecer lleva tiempo. Querer, solo un instante.', 450, 1030);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo crear la tarjeta.');
    const file = new File([blob], 'mi-recuerdo-petverse.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Mi amistad con ${pet.name}` });
    else {
      const download = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = download; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(download), 1000);
      notify('Tu tarjeta está lista para guardar y compartir donde quieras.');
    }
  } catch (error) { if (error.name !== 'AbortError') notify('No pudimos crear el recuerdo. Prueba otra vez.'); }
  finally { button.disabled = false; }
});
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('#install-button').hidden = false; });
$('#install-button').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('#install-button').hidden = true; });
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => { /* El juego funciona sin instalación. */ });
bootstrap();
