import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// scripts/ is one level below the Plugin; original assets are outside the Plugin.
const original = new URL('../../source/Avatar_03/Avatar_03_Complete_Animations_Updated.glb', import.meta.url);
const bytes = await readFile(original);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== 'bf16883394c2f968faa294e8debe02dc38ff8ba4aaf98d32319e025d8185540d') {
  throw new Error('Avatar 03 source changed; review it before updating the packaged asset.');
}
await mkdir(new URL('../dist/assets/', import.meta.url), { recursive: true });
await copyFile(original, new URL('../dist/assets/avatar03.glb', import.meta.url));
// Copy the embedded PNG byte-for-byte for Desktop's local asset protocol.
// Loading it as an image avoids fetching a blob: URL in the isolated document.
const jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
if(document.images.length!==1 || document.images[0].mimeType!=='image/png') throw new Error('Unexpected Avatar 03 texture layout');
const view = document.bufferViews[document.images[0].bufferView];
const start = 28+jsonLength+(view.byteOffset??0);
await writeFile(new URL('../dist/assets/avatar03-texture.png',import.meta.url),bytes.subarray(start,start+view.byteLength));
console.log(`Avatar 03 copied unchanged (${bytes.length} bytes, SHA-256 ${hash}).`);
