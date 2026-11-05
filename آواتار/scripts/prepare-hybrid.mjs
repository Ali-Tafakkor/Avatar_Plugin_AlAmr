import { copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = name => new URL('../src/hybrid/' + name, import.meta.url);
const output = name => new URL('../dist/hybrid/' + name, import.meta.url);
const provenance = JSON.parse(await readFile(source('accepted-source.json'), 'utf8'));
await mkdir(output(''), { recursive: true });
for (const { file, packageLocalSha256 } of provenance.files) {
  const bytes = await readFile(source(file));
  if (createHash('sha256').update(bytes).digest('hex') !== packageLocalSha256) {
    throw new Error('avatar_hybrid_accepted_runtime_changed:' + file);
  }
  await copyFile(source(file), output(file));
}
for (const file of ['runtime.d.mts', 'accepted-source.json']) await copyFile(source(file), output(file));
await cp(new URL('../assets-source/appearance/',import.meta.url),new URL('../dist/assets/appearance/',import.meta.url),{recursive:true});
console.log(JSON.stringify({ code: 'AVATAR_HYBRID_PLUGIN_READY', files: provenance.files.length,
  baseline: provenance.baseline, sharedAssets: ['avatar03.glb', 'avatar-v2/avatar.gltf', 'avatar-v2/motions.json'] }));
