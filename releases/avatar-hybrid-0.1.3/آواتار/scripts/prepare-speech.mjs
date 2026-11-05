import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'src/speech'), output = join(root, 'dist/speech');
const assets = join(root, 'dist/assets/speech');
const codeOnly = process.argv.includes('--code-only');
await mkdir(output, { recursive: true });
for (const name of await readdir(source)) if (/\.(mjs|mts|md)$/.test(name)) await copyFile(join(source, name), join(output, name));
await mkdir(join(assets, 'workers'), { recursive: true });
for (const name of ['inference-worker', 'laughter.worker']) {
  await build({ entryPoints: [join(output, name + '.js')], outfile: join(assets, 'workers', name + '.js'),
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['browser'], minify: true, legalComments: 'eof' });
}
await copyFile(join(output, 'capture-worklet.js'), join(assets, 'workers/capture-worklet.js'));
// The consuming Environment supplies ORT's 14MB WASM runtime. Plugin modules
// are limited to 4MB per WASM binary; do not rename/split code to bypass that.
await copyFile(join(source, 'model-profile.json'), join(assets, 'model-profile.json'));
await copyFile(join(source, 'NOTICE.md'), join(assets, 'NOTICE.md'));
const manifestPath = join(root, 'al-amr.plugin.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.webAssembly = [];
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ code: codeOnly ? 'AVATAR_SPEECH_CODE_BUILT' : 'AVATAR_SPEECH_READY', version: '0.1.3', workers: 3, modelsAndWasm: 'host-owned' }));
