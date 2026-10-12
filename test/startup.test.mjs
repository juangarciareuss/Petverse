import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

test('arranca en producción con la URL automática de Render y mantiene CSRF/origen', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'petverse-startup-'));
  const origin = 'https://petverse-startup-test.onrender.com';
  const env = { ...process.env, NODE_ENV: 'production', RENDER_EXTERNAL_URL: origin, DATABASE_PATH: join(dir, 'game.sqlite'), PORT: '0', HOST: '127.0.0.1' };
  delete env.PUBLIC_ORIGIN;
  const child = spawn(process.execPath, ['server/index.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit; }
    rmSync(dir, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('El servidor no arrancó a tiempo.')), 5000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`El servidor terminó con código ${code}.`)); });
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(base + '/health')).status, 200);
  const login = await fetch(base + '/api/session', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(login.status, 201); assert.match(login.headers.get('set-cookie'), /Secure/);
  const { csrf } = await login.json();
  const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': 'render-startup-test-adopt', Cookie: login.headers.get('set-cookie').split(';')[0] };
  const adopted = await fetch(base + '/api/adopt', { method: 'POST', headers, body: JSON.stringify({ name: 'Luna' }) });
  assert.equal(adopted.status, 200); assert.equal((await adopted.json()).pet.name, 'Luna');
  const blocked = await fetch(base + '/api/actions', { method: 'POST', headers: { ...headers, Origin: 'https://other.example' }, body: JSON.stringify({ action: 'feed' }) });
  assert.equal(blocked.status, 403);
});
