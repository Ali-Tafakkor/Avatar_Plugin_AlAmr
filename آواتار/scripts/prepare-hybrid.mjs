import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { copyBuildAsset, writeBuildAsset } from './write-build-asset.mjs';

const source = name => new URL('../src/hybrid/' + name, import.meta.url);
const output = name => new URL('../dist/hybrid/' + name, import.meta.url);
const provenance = JSON.parse(await readFile(source('accepted-source.json'), 'utf8'));
await mkdir(output(''), { recursive: true });
for (const { file, packageLocalSha256 } of provenance.files) {
  const bytes = await readFile(source(file));
  if (createHash('sha256').update(bytes).digest('hex') !== packageLocalSha256) {
    throw new Error('avatar_hybrid_accepted_runtime_changed:' + file);
  }
  await writeBuildAsset(output(file), bytes);
}
for (const file of ['runtime.d.mts', 'accepted-source.json', 'face-detail.mjs', 'face-detail.d.mts']) {
  await copyBuildAsset(source(file), output(file));
}
const appearanceSource = new URL('../assets-source/appearance/', import.meta.url);
const appearanceOutput = new URL('../dist/assets/appearance/', import.meta.url);
await mkdir(appearanceOutput, { recursive: true });
for (const file of ['face-albedo.png', 'face-provenance.json']) {
  await copyBuildAsset(new URL(file, appearanceSource), new URL(file, appearanceOutput));
}
console.log(JSON.stringify({ code: 'AVATAR_HYBRID_PLUGIN_READY', files: provenance.files.length,
  baseline: provenance.baseline, sharedAssets: ['avatar03.glb', 'avatar-v2/avatar.gltf', 'avatar-v2/motions.json'] }));
