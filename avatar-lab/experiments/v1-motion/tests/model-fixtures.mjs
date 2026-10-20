import fs from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Geometry-only fixture. JSON and embedded image references are edited solely
// in memory. Geometry, skinning, animation, morph arrays and source bytes survive.
export async function loadGeometryGlb(url) {
  if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init) { this.type = type; Object.assign(this, init); }
  };
  const bytes = await fs.readFile(url);
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw new Error('Expected GLB v2 fixture');
  let json, binary;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    if (type === 0x004e4942) binary = body;
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error('Fixture must contain JSON and BIN chunks');
  json.buffers = [{ byteLength: binary.length, uri: 'data:application/octet-stream;base64,' + binary.toString('base64') }];
  json.images = []; json.textures = [];
  json.materials = (json.materials ?? []).map(material => ({ name: material.name }));
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  return { gltf, bytes };
}

export async function loadMotionFixtures() {
  const [legacy, web] = await Promise.all([
    loadGeometryGlb(new URL('../../../../source/Avatar_03/Avatar_03_Complete_Animations_Updated.glb', import.meta.url)),
    loadGeometryGlb(new URL('../../../../آواتار/assets-source/web-v2/avatar.glb', import.meta.url)),
  ]);
  return { legacy, web };
}
