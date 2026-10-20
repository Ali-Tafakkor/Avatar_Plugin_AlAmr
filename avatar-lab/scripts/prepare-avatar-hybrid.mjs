import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

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
  const legacySource = fileURLToPath(import.meta.resolve(packageName + '/model'));
  const modelSource = fileURLToPath(import.meta.resolve(packageName + '/web-model'));
  const motionsSource = fileURLToPath(import.meta.resolve(packageName + '/web-motions'));
  const legacyBytes = await readFile(legacySource), { json: source, binary } = parseLegacyGlb(legacyBytes);
  const legacy = structuredClone(source), legacyTarget = join(publicRoot, 'avatar-hybrid');
  await mkdir(legacyTarget, { recursive: true });
  legacy.buffers[0].uri = 'legacy.bin';
  await writeFile(join(legacyTarget, 'legacy.bin'), binary);
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
  const resources = [...new Set(['avatar.gltf', 'motions.json', 'asset-manifest.json', 'THIRD_PARTY_NOTICES.md', 'provenance.json',
    ...[...(web.buffers ?? []), ...(web.images ?? [])].map(item => item.uri).filter(Boolean)])];
  for (const relative of resources) {
    if (/^[a-z]+:/i.test(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('hybrid_nonlocal_packaged_resource:' + relative);
    const target = join(webTarget, relative); await mkdir(dirname(target), { recursive: true });
    await copyFile(relative === 'motions.json' ? motionsSource : join(dirname(modelSource), relative), target);
  }
  const manifest = { schemaVersion: 1, source: 'installed Plugin exports', legacyModelSha256: hash(legacyBytes),
    legacyBinarySha256: hash(binary), images, webModelSha256: hash(modelBytes), resources: resources.length,
    legacyGeometryAndAnimationChanged: false };
  await writeFile(join(legacyTarget, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await copyFile(new URL('../public/environment-cover.png', import.meta.url), join(publicRoot, 'environment-cover.png'));
  return manifest;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify({ code: 'AVATAR_HYBRID_HOST_USES_PLUGIN_ASSETS', ...await prepareHybridAssets() }));
}
