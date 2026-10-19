import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

let child, base;
const root = fileURLToPath(new URL('../', import.meta.url));
const pause = ms => new Promise(r => setTimeout(r, ms));
before(async () => {
  const probe = net.createServer();
  await new Promise((ok, bad) => { probe.once('error', bad); probe.listen(0, '127.0.0.1', ok); });
  const port = probe.address().port;
  await new Promise(ok => probe.close(ok));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [resolve(root, 'start.mjs'), '--offline', '--no-open', `--port=${port}`], { stdio: 'pipe' });
  let log = '';
  child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + '/api/status'); if (r.ok) return; } catch {}
    if (child.exitCode !== null) throw new Error('Server exited: ' + log);
    await pause(50);
  }
  throw new Error('Server did not start: ' + log);
});
after(async () => { if (child && child.exitCode === null) { child.kill(); await new Promise(ok => child.once('exit', ok)); } });

test('local server: index and module MIME types are correct', async () => {
  const index = await fetch(base + '/'); assert.equal(index.status, 200); assert.match(index.headers.get('content-type'), /text\/html/); assert.match(await index.text(), /importmap/);
  const module = await fetch(base + '/src/main.mjs'); assert.equal(module.status, 200); assert.match(module.headers.get('content-type'), /javascript/);
});
test('local server: status explicitly distinguishes missing assets from readiness', async () => {
  let state;
  for (let i = 0; i < 100; i++) { state = await (await fetch(base + '/api/status')).json(); if (state.phase !== 'checking') break; await pause(20); }
  assert.ok(['error', 'ready'].includes(state.phase));
  if (state.phase === 'error') assert.match(state.message, /assets.*not installed/i);
});
test('local server: HEAD does not send a file body', async () => {
  const r = await fetch(base + '/style.css', { method: 'HEAD' }); assert.equal(r.status, 200); assert.ok(Number(r.headers.get('content-length')) > 100); assert.equal(await r.text(), '');
});
test('local server: server scripts and package metadata are not public', async () => {
  for (const path of ['/start.mjs', '/tools/setup.mjs', '/package.json']) assert.equal((await fetch(base + path)).status, 403);
});
test('local server: traversal and backslash paths are rejected', async () => {
  for (const path of ['/assets/%2e%2e%2fstart.mjs', '/src%5c..%5cstart.mjs']) assert.equal((await fetch(base + path)).status, 403);
});
test('local server: mutation methods are rejected', async () => {
  const r = await fetch(base + '/', { method: 'POST', body: 'test' }); assert.equal(r.status, 405);
});
test('local server: missing resource has a clear 404 response', async () => {
  assert.equal((await fetch(base + '/assets/not-a-real-asset.xyz')).status, 404);
});
test('local server: client assets include the no-sniff security header', async () => {
  assert.equal((await fetch(base + '/boot.js')).headers.get('x-content-type-options'), 'nosniff');
});
