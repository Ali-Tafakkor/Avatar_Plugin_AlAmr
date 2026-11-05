import { cp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'vite';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const lab = resolve(root, '../..'), workspace = resolve(lab, '..');
const plugin = join(workspace, 'آواتار');
const prepared = join(root, '.prepared'), output = join(root, 'dist');
if (!output.startsWith(workspace + sep) || dirname(output) !== root) throw new Error('unsafe_review_output');
await mkdir(prepared, { recursive: true });
const copy = async (from, to) => { await mkdir(dirname(to), { recursive: true }); await copyFile(from, to); };
await copy(join(plugin, 'dist/assets/avatar03.glb'), join(prepared, 'avatar-hybrid/legacy.glb'));
await copy(join(plugin, 'dist/assets/avatar03-texture.png'), join(prepared, 'avatar-hybrid/texture.png'));
await cp(join(plugin, 'dist/assets/avatar-v2'), join(prepared, 'avatar-v2'), { recursive: true });
// Same byte-preserving .buffer mapping as the accepted browser host.
const model = JSON.parse(await readFile(join(prepared, 'avatar-v2/avatar.gltf'), 'utf8'));
for (const buffer of model.buffers) {
  if (!buffer.uri?.endsWith('.bin')) continue;
  const original = buffer.uri; buffer.uri = buffer.uri.replace(/\.bin$/, '.buffer');
  await copy(join(plugin, 'dist/assets/avatar-v2', original), join(prepared, 'avatar-v2', buffer.uri));
}
await writeFile(join(prepared, 'avatar-v2/avatar.gltf'), JSON.stringify(model));
await cp(join(root, 'assets-source'), join(prepared, 'face-study'), { recursive: true });
await copy(join(lab, 'public/environment-cover.png'), join(prepared, 'environment-cover.png'));
const source = JSON.parse(await readFile(join(lab, 'al-amr.environment.json'), 'utf8'));
const manifest = { ...source, environmentId: 'env_local_902d0bec1103', name: 'مقایسهٔ چهرهٔ آواتار — نمونهٔ محلی',
  shortDescription: 'مقایسهٔ ظاهر و احساسات چهره با بدن و لباس یکسان', capabilities: [],
  portal: { ...source.portal, title: 'مقایسهٔ چهرهٔ آواتار', blurb: 'نمونهٔ مستقل الهام‌گرفته از پژوهش DreamFace',
    art: { imageUrl: 'environment-cover.png', alt: 'آزمایشگاه محلی مقایسهٔ کیفیت چهرهٔ آواتار' }, visibility: 'private' } };
await writeFile(join(root, 'al-amr.environment.json'), JSON.stringify(manifest, null, 2) + '\n');
await build({ configFile: join(root, 'vite.config.mjs'), root, build: { outDir: output, emptyOutDir: true } });
const hashes = {};
for (const relative of ['assets-source/skin-albedo.png', '../../../آواتار/dist/assets/avatar03.glb', '../../../آواتار/dist/assets/avatar-v2/avatar.gltf']) {
  const bytes = await readFile(resolve(root, relative));
  hashes[relative] = createHash('sha256').update(bytes).digest('hex');
}
await writeFile(join(root, 'build-receipt.json'), JSON.stringify({ builtAt: new Date().toISOString(),
  provenance: 'Local material/texture study inspired by published DreamFace principles; not ChatAvatar output or model reproduction',
  speechCapture: false, sourceModelGeometryModified: false, hashes }, null, 2));
console.log('FACE_INSPIRATION_LOCAL_BUILD_READY');
