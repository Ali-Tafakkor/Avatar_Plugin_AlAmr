import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, runtimeReady, setup } from './tools/setup.mjs';

const offline = process.argv.includes('--offline');
const noOpen = process.argv.includes('--no-open');
const portArgument = process.argv.find(a => a.startsWith('--port='));
const requestedPort = Number(portArgument?.split('=')[1] || process.env.PORT || 4173);
if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65535) throw new Error('Choose a port between 1024 and 65535.');
let status = { phase: 'checking', message: 'Checking local assets', step: 0, steps: 10 };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const allowedRoots = new Set(['src', 'assets', 'vendor']);
const allowedFiles = new Set(['index.html', 'style.css', 'boot.js', 'favicon.svg']);
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api/status') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(status)); return; }
    let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    if (relative.split('/').includes('..') || relative.includes('\\') || relative.includes('\0') || (!allowedFiles.has(relative) && !allowedRoots.has(relative.split('/')[0]))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const path = resolve(ROOT, relative);
    if (!path.startsWith(ROOT + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    const info = await stat(path);
    if (!info.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Content-Length': info.size,
      'Cache-Control': ['.glb', '.wasm'].includes(extname(path)) ? 'public, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(path));
  } catch (e) { if (!res.headersSent) res.writeHead(e.code === 'ENOENT' ? 404 : 400); res.end('Unable to read this resource.'); }
});
async function listen() {
  let port = requestedPort;
  while (true) {
    try {
      await new Promise((resolvePromise, reject) => {
        const onError = e => { server.off('listening', onListen); reject(e); };
        const onListen = () => { server.off('error', onError); resolvePromise(); };
        server.once('error', onError); server.once('listening', onListen); server.listen(port, '127.0.0.1');
      }); break;
    } catch (e) { if (e.code === 'EADDRINUSE' && port < requestedPort + 10 && port < 65535) port++; else throw e; }
  }
  const url = `http://127.0.0.1:${port}`;
  console.log(`\nAVATAR / MOTION LAB\n${url}\nLocal-only server. Press Ctrl+C to stop.\n`);
  if (!noOpen) {
    const command = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore', windowsHide: true }); child.on('error', () => {}); child.unref();
  }
  if (await runtimeReady()) { status = { phase: 'ready', message: 'All assets are local' }; return; }
  if (offline) { status = { phase: 'error', message: 'Local assets are not installed. Run node start.mjs once with an internet connection.' }; console.error(status.message); return; }
  console.log('First run: downloading the pinned model, runtime and motion data. Afterwards no internet is needed.');
  let lastFile = '';
  try {
    await setup(s => {
      status = { ...status, ...s };
      if (s.file && s.file !== lastFile) { console.log(`[${s.step}/${s.steps}] ${s.file}`); lastFile = s.file; }
    });
    status = { phase: 'ready', message: 'Installed. Ready to open the character.' }; console.log('\nAssets ready. Future runs work offline.');
  } catch (e) { status = { phase: 'error', message: e.message }; console.error('\nSETUP ERROR: ' + e.message); }
}
process.on('SIGINT', () => { server.close(); process.exit(0); });
listen().catch(e => { console.error(e.message); process.exitCode = 1; server.close(); });
