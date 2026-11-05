import { copyFile, cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const packageName = '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseLegacyGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('hybrid_invalid_packaged_legacy_glb');
  let json, binary;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    if (offset + length > bytes.length) throw new Error('hybrid_truncated_legacy_glb');
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(offset, offset + length).toString('utf8').replace(/[\u0000\s]+$/g, ''));
    if (type === 0x004e4942) binary = bytes.subarray(offset, offset + length);
    offset += length;
  }
  if (!json || !binary || json.buffers?.length !== 1) throw new Error('hybrid_unsupported_legacy_glb');
  return { json, binary };
}

/** Resolve published package exports, so a copied host works with an installed
 * file/tarball dependency and has no source-workspace or experiment dependency.
 * Externalization preserves every accessor, skin, clip, UV and binary byte.
 */
export async function prepareHybridAssets({ publicRoot = fileURLToPath(new URL('../.public-production/', import.meta.url)) } = {}) {
  // These three generated directories previously retained obsolete .bin copies.
  // Rebuild only direct children of the declared output, preserving all sources.
  const generatedBase=resolve(publicRoot);
  for(const name of ['avatar-hybrid','avatar-v2','appearance']){
    const target=resolve(generatedBase,name);
    if(dirname(target)!==generatedBase||!target.startsWith(generatedBase+sep))throw new Error('avatar_generated_target_escaped');
    await rm(target,{recursive:true,force:true});
  }
  const legacySource = fileURLToPath(import.meta.resolve(packageName + '/model'));
  const modelSource = fileURLToPath(import.meta.resolve(packageName + '/web-model'));
  const motionsSource = fileURLToPath(import.meta.resolve(packageName + '/web-motions'));
  const hybridEntry = fileURLToPath(import.meta.resolve(packageName + '/hybrid'));
  await cp(join(dirname(hybridEntry), 'assets/appearance'), join(publicRoot,'appearance'), {recursive:true});
  const speechEntry = fileURLToPath(import.meta.resolve(packageName + '/speech'));
  const generatedModelTarget = resolve(publicRoot, 'speech/wav2arkit');
  if (!generatedModelTarget.startsWith(resolve(publicRoot) + sep)) throw new Error('speech_generated_target_escaped_host');
  await rm(generatedModelTarget, { recursive: true, force: true });
  await cp(join(dirname(speechEntry), '../assets/speech'), join(publicRoot, 'speech'), { recursive: true });
  // Model files belong to this Environment; the Plugin's managed artifact is
  // limited to 25MiB. It supplies the adapter, workers and pinned model profile.
  await cp(fileURLToPath(new URL('../assets-source/speech/', import.meta.url)), join(publicRoot, 'speech'), { recursive: true });
  const ortRoot = dirname(createRequire(speechEntry).resolve('onnxruntime-web/wasm'));
  const ortTarget = join(publicRoot, 'speech/onnx'); await mkdir(ortTarget, { recursive: true });
  for (const name of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
    await copyFile(join(ortRoot, name), join(ortTarget, name));
  }
  const legacyBytes = await readFile(legacySource), { json: source, binary } = parseLegacyGlb(legacyBytes);
  const legacy = structuredClone(source), legacyTarget = join(publicRoot, 'avatar-hybrid');
  await mkdir(legacyTarget, { recursive: true });
  legacy.buffers[0].uri = 'legacy.buffer';
  await writeFile(join(legacyTarget, 'legacy.buffer'), binary);
  const images = [];
  for (let index = 0; index < (legacy.images?.length ?? 0); index++) {
    const image = legacy.images[index], original = source.images[index];
    if (original.bufferView === undefined) throw new Error('hybrid_legacy_image_must_be_packaged');
    const view = source.bufferViews[original.bufferView], extension = original.mimeType === 'image/jpeg' ? 'jpg' : original.mimeType === 'image/png' ? 'png' : null;
    if (!extension || (view.buffer ?? 0) !== 0) throw new Error('hybrid_unsupported_legacy_image');
    image.uri = `image-${index}.${extension}`; delete image.bufferView;
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    await writeFile(join(legacyTarget, image.uri), bytes); images.push({ file: image.uri, sha256: hash(bytes) });
  }
  await writeFile(join(legacyTarget, 'legacy.gltf'), JSON.stringify(legacy));

  const webTarget = join(publicRoot, 'avatar-v2'), modelBytes = await readFile(modelSource), web = JSON.parse(modelBytes);
  const webBufferRemap = Object.fromEntries((web.buffers ?? []).filter(item => item.uri?.endsWith('.bin'))
    .map(item => [item.uri, item.uri.replace(/\.bin$/, '.buffer')]));
  const resources = [...new Set(['avatar.gltf', 'motions.json', 'asset-manifest.json', 'THIRD_PARTY_NOTICES.md', 'provenance.json',
    ...[...(web.buffers ?? []), ...(web.images ?? [])].map(item => item.uri).filter(Boolean)])];
  for (const relative of resources) {
    if (/^[a-z]+:/i.test(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('hybrid_nonlocal_packaged_resource:' + relative);
    if (relative === 'avatar.gltf') continue;
    const target = join(webTarget, webBufferRemap[relative] ?? relative); await mkdir(dirname(target), { recursive: true });
    await copyFile(relative === 'motions.json' ? motionsSource : join(dirname(modelSource), relative), target);
  }
  for (const buffer of web.buffers ?? []) buffer.uri = webBufferRemap[buffer.uri] ?? buffer.uri;
  const preparedWeb = JSON.stringify(web);
  await writeFile(join(webTarget, 'avatar.gltf'), preparedWeb);
  const manifest = { schemaVersion: 1, source: 'installed Plugin exports', legacyModelSha256: hash(legacyBytes),
    legacyBinarySha256: hash(binary), images, webModelSha256: hash(modelBytes), preparedWebModelSha256: hash(preparedWeb), webBufferRemap, resources: resources.length,
    legacyGeometryAndAnimationChanged: false };
  await writeFile(join(legacyTarget, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await copyFile(new URL('../public/environment-cover.png', import.meta.url), join(publicRoot, 'environment-cover.png'));
  // Native media consent reads this declaration from the built root, separately
  // from the Environment manifest and the CLI Runtime permission fixture.
  await copyFile(new URL('../public/al-amr.product.json', import.meta.url), join(publicRoot, 'al-amr.product.json'));
  return manifest;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify({ code: 'AVATAR_HYBRID_HOST_USES_PLUGIN_ASSETS', ...await prepareHybridAssets() }));
}
