import fs from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { parseGLB } from '../scripts/glb.mjs';

/** Tests load only the built package's assets. Texture decoding is omitted in
 * memory; native geometry, skinning, morphs and motion values remain intact. */
export async function loadHybridAssets() {
  if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init) { this.type = type; Object.assign(this, init); }
  };
  const legacyBytes = await fs.readFile(new URL('../dist/assets/avatar03.glb', import.meta.url));
  const { json: legacyDocument, binary: legacyBinary } = parseGLB(legacyBytes);
  const webDocument = JSON.parse(await fs.readFile(new URL('../dist/assets/avatar-v2/avatar.gltf', import.meta.url), 'utf8'));
  const webBinary = await fs.readFile(new URL('../dist/assets/avatar-v2/avatar.bin', import.meta.url));
  const parse = async (json, binary) => {
    json = structuredClone(json);
    json.buffers = [{ byteLength: binary.length, uri: 'data:application/octet-stream;base64,' + binary.toString('base64') }];
    json.images = []; json.textures = [];
    json.materials = (json.materials ?? []).map(material => ({ name: material.name }));
    return new GLTFLoader().parseAsync(JSON.stringify(json), '');
  };
  const [legacy, web] = await Promise.all([parse(legacyDocument, legacyBinary), parse(webDocument, webBinary)]);
  const motions = JSON.parse(await fs.readFile(new URL('../dist/assets/avatar-v2/motions.json', import.meta.url), 'utf8'));
  return { legacy, web, motions, legacyBytes };
}
