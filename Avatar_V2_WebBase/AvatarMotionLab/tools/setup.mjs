import { mkdir, readFile, writeFile, rename, stat, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { extractMotionPack, parseGLB } from './glb.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_TAG = 'r180';
const AVATAR_COMMIT = '2afe6d79779313db8909badebf46f9805a6c7b70';
const GIT_BLOB_AVATAR = '2865a45b9f82e97e811cc703411233f3be780163';
const threeUrls = path => [
  `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_TAG}/${path}`,
  `https://cdn.jsdelivr.net/npm/three@0.180.0/${path}`,
  `https://unpkg.com/three@0.180.0/${path}`
];
const runtime = [
  ['vendor/three.module.min.js', 'build/three.module.min.js'],
  ['vendor/three.core.min.js', 'build/three.core.min.js'],
  ['vendor/addons/loaders/GLTFLoader.js', 'examples/jsm/loaders/GLTFLoader.js'],
  ['vendor/addons/loaders/DRACOLoader.js', 'examples/jsm/loaders/DRACOLoader.js'],
  ['vendor/addons/utils/BufferGeometryUtils.js', 'examples/jsm/utils/BufferGeometryUtils.js'],
  ['vendor/addons/environments/RoomEnvironment.js', 'examples/jsm/environments/RoomEnvironment.js'],
  ['vendor/addons/libs/meshopt_decoder.module.js', 'examples/jsm/libs/meshopt_decoder.module.js'],
  ['vendor/THREE-LICENSE.txt', 'LICENSE']
];
export async function runtimeReady() {
  try { await Promise.all([...runtime.map(x => x[0]), 'assets/avatar.glb', 'assets/motions.json', 'assets/provenance.json'].map(async p => {
    if ((await stat(join(ROOT, p))).size < 10) throw new Error(p);
  })); return true; } catch { return false; }
}
function blobHash(bytes) { return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function exists(path) { try { return (await stat(path)).size > 10; } catch { return false; } }
async function atomicSave(path, bytes) { await mkdir(dirname(path), { recursive: true }); await writeFile(path + '.part', bytes); await rename(path + '.part', path); }
async function fetchBytes(url, report) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length') || 0), chunks = []; let done = 0, last = 0;
  for await (const chunk of response.body) {
    chunks.push(Buffer.from(chunk)); done += chunk.length;
    if (done > 100 * 1024 * 1024) throw new Error('Download exceeds the safety size limit.');
    if (Date.now() - last > 500) { report({ bytes: done, totalBytes: total }); last = Date.now(); }
  }
  return Buffer.concat(chunks);
}
function curlDownload(url, out) {
  return new Promise((res, rej) => {
    const child = spawn(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--fail', '--location', '--connect-timeout', '20', '--max-time', '180', '--output', out, url], { stdio: 'ignore', windowsHide: true });
    child.on('error', rej); child.on('exit', code => code === 0 ? res() : rej(new Error(`curl exit code ${code}`)));
  });
}
async function getFile(relative, urls, options, report) {
  const path = join(ROOT, relative);
  if (await exists(path)) {
    const bytes = await readFile(path);
    if (!options?.blob || blobHash(bytes) === options.blob) return { relative, bytes, cached: true };
  }
  const failures = [];
  for (const url of urls) {
    try {
      report({ file: relative, source: new URL(url).hostname, bytes: 0, totalBytes: 0 });
      let bytes;
      try { bytes = await fetchBytes(url, report); }
      catch (e) {
        // System curl honors HTTPS_PROXY on Windows and POSIX. TLS verification is never disabled.
        await mkdir(dirname(path), { recursive: true });
        const temp = path + '.curl.part';
        try { await curlDownload(url, temp); bytes = await readFile(temp); } finally { await rm(temp, { force: true }); }
      }
      if (bytes.length < 10) throw new Error('Empty download.');
      if (/^\s*<!doctype html|^\s*<html/i.test(bytes.subarray(0, 100).toString())) throw new Error('The server returned an HTML error page.');
      if (options?.blob && blobHash(bytes) !== options.blob) throw new Error('The asset checksum does not match the pinned original.');
      await atomicSave(path, bytes);
      return { relative, bytes, url };
    } catch (e) { failures.push(`${new URL(url).hostname}: ${e.message}`); }
  }
  throw new Error(`Cannot download ${relative}. ${failures.join(' | ')}. Check your connection or HTTPS_PROXY, then restart. Existing good downloads are kept.`);
}
export async function setup(onProgress = () => {}) {
  let index = 0; const count = runtime.length + 2, records = [];
  const report = detail => onProgress({ phase: 'setup', step: index, steps: count, ...detail });
  const collect = file => records.push({ path: file.relative, bytes: file.bytes.length, sha256: sha256(file.bytes), source: file.url || 'existing local cache' });
  for (const [relative, path] of runtime) {
    index++; collect(await getFile(relative, threeUrls(path), {}, report));
  }
  index++;
  const avatar = await getFile('assets/avatar.glb', [
    `https://raw.githubusercontent.com/met4citizen/TalkingHead/${AVATAR_COMMIT}/avatars/avatarsdk.glb`,
    `https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@${AVATAR_COMMIT}/avatars/avatarsdk.glb`
  ], { blob: GIT_BLOB_AVATAR }, report);
  const parsed = parseGLB(avatar.bytes);
  const external = [...(parsed.json.images || []), ...(parsed.json.buffers || [])].some(x => x.uri && !x.uri.startsWith('data:'));
  if (external) throw new Error('The avatar unexpectedly references external textures or buffers.');
  collect(avatar);
  if ((parsed.json.extensionsUsed || []).includes('KHR_draco_mesh_compression')) {
    for (const name of ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js']) {
      collect(await getFile('vendor/draco/' + name, threeUrls('examples/jsm/libs/draco/gltf/' + name), {}, report));
    }
  }
  index++;
  const motionFile = join(ROOT, 'assets/motions.json');
  if (!(await exists(motionFile))) {
    const src = await getFile('.cache/Xbot.glb', [
      `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_TAG}/examples/models/gltf/Xbot.glb`,
      `https://cdn.jsdelivr.net/gh/mrdoob/three.js@${THREE_TAG}/examples/models/gltf/Xbot.glb`
    ], {}, report);
    const pack = extractMotionPack(src.bytes);
    await atomicSave(motionFile, Buffer.from(JSON.stringify(pack)));
    await rm(join(ROOT, '.cache/Xbot.glb'), { force: true });
  }
  const motion = await readFile(motionFile); JSON.parse(motion);
  records.push({ path: 'assets/motions.json', bytes: motion.length, sha256: sha256(motion), source: 'Animation-only extraction from Three.js r180 Xbot.glb; mesh discarded.' });
  await atomicSave(join(ROOT, 'assets/provenance.json'), Buffer.from(JSON.stringify({
    version: 1, installedAt: new Date().toISOString(), threeVersion: '0.180.0',
    avatar: { source: 'TalkingHead / AvatarSDK example', commit: AVATAR_COMMIT, gitBlob: GIT_BLOB_AVATAR, usage: 'Non-commercial sample, per upstream documentation. See THIRD_PARTY_NOTICES.md.' },
    files: records, runtimeBytes: records.reduce((sum, x) => sum + x.bytes, 0)
  }, null, 2)));
  onProgress({ phase: 'ready', step: count, steps: count, file: '', bytes: 0, totalBytes: 0 });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup(info => { if (info.file) process.stdout.write(`\r[${info.step}/${info.steps}] ${info.file} ${(info.bytes / 1048576).toFixed(1)} MB          `); })
    .then(() => console.log('\nReady. Run: node start.mjs --offline'))
    .catch(e => { console.error('\n' + e.message); process.exitCode = 1; });
}
