import fs from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Node-only geometry loader: images are omitted from this copy of the JSON, never from the GLB. */
export async function loadRealAvatar() {
  if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init) { this.type = type; Object.assign(this, init); }
  };
  const bytes = await fs.readFile(new URL('../assets-source/web-v2/avatar.glb', import.meta.url));
  const json = JSON.parse(await fs.readFile(new URL('../dist/assets/avatar-v2/avatar.gltf',import.meta.url),'utf8'));
  const bin = await fs.readFile(new URL('../dist/assets/avatar-v2/avatar.bin',import.meta.url));
  json.buffers = [{ byteLength: bin.length, uri: 'data:application/octet-stream;base64,' + bin.toString('base64') }];
  json.images = []; json.textures = [];
  json.materials = json.materials.map(material => ({ name: material.name }));
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const motions = JSON.parse(await fs.readFile(new URL('../dist/assets/avatar-v2/motions.json', import.meta.url), 'utf8'));
  return { gltf, motions, bytes, json };
}
