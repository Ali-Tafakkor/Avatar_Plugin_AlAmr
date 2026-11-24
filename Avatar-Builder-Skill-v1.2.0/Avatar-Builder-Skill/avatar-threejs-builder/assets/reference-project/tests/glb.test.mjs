import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGLB, readAccessor, extractMotionPack } from '../tools/glb.mjs';
function makeGLB(json, bin) {
  let j = Buffer.from(JSON.stringify(json)); j = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 32)]);
  bin = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + j.length + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, jh, j, bh, bin]);
}
function fixture() {
  const times = Buffer.alloc(8); times.writeFloatLE(0, 0); times.writeFloatLE(1, 4);
  const values = Buffer.alloc(32); [0, 0, 0, 1, 0, 0.2, 0, Math.sqrt(0.96)].forEach((v, i) => values.writeFloatLE(v, i * 4));
  const data = { asset: { version: '2.0' }, scenes: [{ nodes: [0] }], scene: 0, nodes: [{ name: 'mixamorigHips', children: [] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 32 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR' }, { bufferView: 1, componentType: 5126, count: 2, type: 'VEC4' }],
    animations: ['idle', 'walk', 'run'].map(name => ({ name, channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }], samplers: [{ input: 0, output: 1 }] })) };
  return makeGLB(data, Buffer.concat([times, values]));
}
test('GLB parser reads valid version-2 JSON and binary chunks', () => { const g = parseGLB(fixture()); assert.equal(g.json.asset.version, '2.0'); assert.equal(g.binary.length, 40); });
test('GLB parser rejects truncation instead of accepting corrupt downloads', () => { assert.throws(() => parseGLB(fixture().subarray(0, 30)), /truncated/); });
test('GLB parser rejects non-GLB and incorrect versions', () => { assert.throws(() => parseGLB(Buffer.alloc(40)), /Not a binary/); const b = fixture(); b.writeUInt32LE(1, 4); assert.throws(() => parseGLB(b), /glTF 2.0/); });
test('Accessor extraction preserves rotation and time data', () => { const g = parseGLB(fixture()); assert.deepEqual(readAccessor(g, 0), [0, 1]); const values = readAccessor(g, 1); assert.equal(values.length, 8); assert.ok(Math.abs(values[5] - 0.2) < 1e-6); });
test('Motion pack retains the skeleton and three clips but no textures or mesh', () => { const p = extractMotionPack(fixture()); assert.deepEqual(p.clips.map(c => c.name), ['idle', 'walk', 'run']); assert.equal(p.nodes[0].name, 'mixamorigHips'); assert.equal(p.clips[0].tracks[0].values.length, 8); assert.equal(p.meshes, undefined); });
