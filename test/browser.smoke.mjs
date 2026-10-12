// QA adicional: requiere Playwright instalado en el entorno, no en producción.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = mkdtempSync(join(tmpdir(), 'petverse-browser-'));
const file = join(dir, 'game.sqlite');
let store, server;
async function start(port = 0) {
  store = openStore(file); server = createApp({ store });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return server.address().port;
}
async function stop() { await new Promise(resolve => server.close(resolve)); store.close(); }
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
  // El mismo navegador conserva su cookie a través de un cierre/reapertura real del backend.
  await stop(); await start(port);
  await page.reload(); await page.locator('#pet-panel').waitFor({ state: 'visible' });
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
  console.log('QA Chromium móvil/desktop: adopción, cuidados, recarga, reloj, privacidad, PNG, reinicio, offline, 320 px y movimiento reducido OK.');
} finally {
  await browser.close(); if (server?.listening) await stop(); rmSync(dir, { recursive: true, force: true });
}
