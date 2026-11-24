import { mkdir, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { copyBuildAsset, writeBuildAsset } from './write-build-asset.mjs';

const source = name => new URL('../src/speech/' + name, import.meta.url);
const output = name => new URL('../dist/speech/' + name, import.meta.url);
const assets = name => new URL('../dist/assets/speech/' + name, import.meta.url);
const codeOnly = process.argv.includes('--code-only');
await mkdir(output(''), { recursive: true });
for (const name of await readdir(source(''))) if (/\.(mjs|mts|md)$/.test(name)) await copyBuildAsset(source(name), output(name));
await mkdir(assets('workers/'), { recursive: true });
for (const name of ['inference-worker', 'laughter.worker']) {
  const result = await build({
    entryPoints: [fileURLToPath(output(name + '.js'))], outfile: fileURLToPath(assets('workers/' + name + '.js')),
    write: false, bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
    conditions: ['browser'], minify: true, legalComments: 'eof',
  });
  for (const file of result.outputFiles) await writeBuildAsset(pathToFileURL(file.path), file.contents);
}
await copyBuildAsset(output('capture-worklet.js'), assets('workers/capture-worklet.js'));
// The consuming Environment supplies ORT's 14MB WASM runtime. Plugin modules
// are limited to 4MB per WASM binary; do not rename/split code to bypass that.
await copyBuildAsset(source('model-profile.json'), assets('model-profile.json'));
await copyBuildAsset(source('NOTICE.md'), assets('NOTICE.md'));
const manifestPath = new URL('../al-amr.plugin.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.webAssembly = [];
await writeBuildAsset(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
console.log(JSON.stringify({ code: codeOnly ? 'AVATAR_SPEECH_CODE_BUILT' : 'AVATAR_SPEECH_READY', version, workers: 3, modelsAndWasm: 'host-owned' }));
