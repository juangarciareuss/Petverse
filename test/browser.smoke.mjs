// QA adicional: requiere Playwright instalado en el entorno, no en producción.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.mjs';
import { openPostgresStore } from '../server/postgres-store.mjs';
import { createApp } from '../server/app.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = mkdtempSync(join(tmpdir(), 'petverse-browser-'));
const file = join(dir, 'game.sqlite');
let store, server;
const pgSchema = `petverse_test_${randomUUID().replaceAll('-', '')}`;
async function start(port = 0) {
  store = process.env.PETVERSE_TEST_DATABASE_URL
    ? await openPostgresStore(process.env.PETVERSE_TEST_DATABASE_URL, { schema: pgSchema, createSchema: true })
    : openStore(file);
  server = createApp({ store, freeTrial: Boolean(process.env.PETVERSE_TEST_DATABASE_URL), developerTools: true });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return server.address().port;
}
async function stop() { await new Promise(resolve => server.close(resolve)); await store.close(); }
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
try {
  const port = await start();
  const origin = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await context.newPage(), errors = [];
  let expectedOffline = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !expectedOffline) errors.push(message.text()); });
  await page.goto(origin);
  await page.locator('#adoption-panel').waitFor({ state: 'visible' });
  if (process.env.PETVERSE_TEST_DATABASE_URL) assert.match(await page.locator('#trial-notice').textContent(), /caduca 30 días/);
  await page.locator('#pet-name').fill('Mochi'); await page.locator('#adopt-form button').click();
  await page.locator('#pet-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#heading').textContent(), 'Hola, Mochi.');
  for (const action of ['feed', 'pet', 'play']) {
    await page.locator(`[data-action="${action}"]`).click();
    await page.waitForFunction(a => document.querySelector('#pet-scene').dataset.reaction === a, action);
  }
  assert.ok(await page.locator('#history li').count() >= 3);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Sin desbordamiento móvil');
  await page.reload(); await page.locator('#pet-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#heading').textContent(), 'Hola, Mochi.');
  const state = await page.evaluate(() => fetch('/api/state').then(response => response.json()));
  assert.deepEqual(state.pet.activities, { feed: 1, pet: 1, play: 1 });
  await page.evaluate(() => { Date.now = () => 4102444800000; });
  const trusted = await page.evaluate(() => fetch('/api/state').then(response => response.json()));
  assert.equal(trusted.pet.ageDays, 0, 'El reloj del navegador no cambia edad');
  await page.locator('#settings-button').click(); await page.locator('#analytics-consent').check();
  await page.waitForFunction(() => !document.querySelector('#analytics-consent').disabled);
  assert.equal(await page.locator('#analytics-consent').isChecked(), true);
  await page.locator('#analytics-consent').uncheck();
  await page.waitForFunction(() => !document.querySelector('#analytics-consent').disabled);
  await page.locator('.dialog-close').click();
  const download = page.waitForEvent('download');
  await page.locator('#share-button').click();
  const card = await download;
  mkdirSync('test-results', { recursive: true });
  await card.saveAs('test-results/recuerdo.png');
  await page.evaluate(() => { document.querySelector('#notice').textContent = ''; });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  // Una lectura normal lenta no debe reemplazar la vista del laboratorio recién abierto.
  let releaseOldRead;
  const oldReadGate = new Promise(resolve => { releaseOldRead = resolve; });
  await page.route('**/api/state', async route => {
    const response = await route.fetch(); await oldReadGate; await route.fulfill({ response });
  }, { times: 1 });
  const pendingRead = page.waitForRequest(request => new URL(request.url()).pathname === '/api/state');
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); await pendingRead;
  // Probar desde el móvil las seis transiciones sin esperar días reales.
  await page.locator('#settings-button').click(); await page.locator('#lab-entry').click();
  await page.locator('#lab-panel').waitFor({ state: 'visible' });
  const oldReadResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/state');
  releaseOldRead(); await oldReadResponse;
  for (const stage of ['baby', 'child', 'juvenile', 'teen', 'adult', 'advanced']) {
    await page.locator('#lab-next').click();
    await page.waitForFunction(s => document.querySelector('#pet-scene').dataset.stage === s, stage);
  }
  assert.equal(await page.locator('#lab-next').isDisabled(), true);
  const simulated = await page.evaluate(() => fetch('/api/lab/state').then(response => response.json()));
  assert.equal(simulated.pet.ageDays, 101);
  const unchanged = await page.evaluate(() => fetch('/api/state').then(response => response.json()));
  assert.equal(unchanged.pet.id, state.pet.id); assert.equal(unchanged.pet.bornAt, state.pet.bornAt);
  assert.deepEqual(unchanged.pet.activities, state.pet.activities); assert.equal(unchanged.pet.ageDays, 0);
  await page.evaluate(() => { document.querySelector('#notice').textContent = ''; });
  await page.screenshot({ path: 'test-results/laboratorio-mobile.png', fullPage: true });
  const labDownload = page.waitForEvent('download'); await page.locator('#share-button').click();
  await (await labDownload).saveAs('test-results/laboratorio-card.png');
  await page.reload(); await page.locator('#lab-panel').waitFor({ state: 'visible' });
  assert.equal((await page.evaluate(() => fetch('/api/lab/state').then(response => response.json()))).pet.id, simulated.pet.id);
  // El mismo navegador conserva su cookie a través de un cierre/reapertura real del backend.
  await stop(); await start(port);
  await page.reload(); await page.locator('#lab-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#pet-scene').getAttribute('data-stage'), 'advanced');
  await page.locator('#lab-reset').click();
  await page.waitForFunction(() => document.querySelector('#pet-scene').dataset.stage === 'newborn');
  await page.locator('#lab-exit').click(); await page.locator('#lab-panel').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#heading').textContent(), 'Hola, Mochi.');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  expectedOffline = true; await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#offline').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#care-section').isVisible(), false, 'Sin cuidados ficticios offline');
  // El evento online reconecta automáticamente; no hacer clic en un botón ya oculto.
  await context.setOffline(false);
  await page.locator('#pet-panel').waitFor({ state: 'visible' }); expectedOffline = false;
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Sin desbordamiento a 320 px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.pet-body').evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  assert.equal((await page.request.get(`${origin}/icon-192.png`)).status(), 200);
  assert.equal((await page.request.get(`${origin}/icon-512.png`)).status(), 200);
  assert.deepEqual(errors, [], 'Sin errores de navegador');
  await context.close();
  console.log('QA móvil/desktop: juego, laboratorio día 101, aislamiento, reanudación, reinicio, PNG, offline, 320 px y movimiento reducido OK.');
} finally {
  await browser.close(); if (server?.listening) await stop();
  if (process.env.PETVERSE_TEST_DATABASE_URL) {
    const cleanup = await openPostgresStore(process.env.PETVERSE_TEST_DATABASE_URL, { schema: pgSchema, createSchema: true, dropSchemaOnClose: true }); await cleanup.close();
  }
  rmSync(dir, { recursive: true, force: true });
}
