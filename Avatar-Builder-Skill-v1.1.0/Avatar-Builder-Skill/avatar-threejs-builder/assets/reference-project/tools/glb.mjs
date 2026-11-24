/** Minimal read-only glTF 2.0 parser for extracting animation data, not a renderer. */
export function parseGLB(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a binary glTF file (GLB).');
  if (buffer.readUInt32LE(4) !== 2) throw new Error('Only glTF 2.0 is supported.');
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('GLB download is truncated or has an invalid length.');
  let json, binary;
  for (let p = 12; p + 8 <= buffer.length;) {
    const len = buffer.readUInt32LE(p), type = buffer.readUInt32LE(p + 4); p += 8;
    if (p + len > buffer.length) throw new Error('Invalid GLB chunk length.');
    if (type === 0x4e4f534a) json = JSON.parse(buffer.subarray(p, p + len).toString('utf8').replace(/[\u0000\s]+$/g, ''));
    if (type === 0x004e4942) binary = buffer.subarray(p, p + len);
    p += len;
  }
  if (!json || !binary) throw new Error('GLB is missing JSON or binary data.');
  return { json, binary };
}
const typeSize = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const types = { 5120: [1, 'readInt8'], 5121: [1, 'readUInt8'], 5122: [2, 'readInt16LE'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] };
export function readAccessor(gltf, index) {
  const a = gltf.json.accessors?.[index];
  if (!a || !types[a.componentType] || !typeSize[a.type]) throw new Error(`Unsupported accessor ${index}.`);
  const [bytes, method] = types[a.componentType], n = typeSize[a.type];
  const values = new Array(a.count * n).fill(0);
  if (a.bufferView !== undefined) {
    const view = gltf.json.bufferViews[a.bufferView];
    if (view.extensions?.EXT_meshopt_compression) throw new Error('Compressed animation data needs a different motion source.');
    const start = (view.byteOffset || 0) + (a.byteOffset || 0), stride = view.byteStride || n * bytes;
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) values[i * n + c] = gltf.binary[method](start + i * stride + c * bytes);
  }
  if (a.sparse) {
    const sparse = a.sparse, iv = gltf.json.bufferViews[sparse.indices.bufferView], vv = gltf.json.bufferViews[sparse.values.bufferView];
    const [ib, im] = types[sparse.indices.componentType];
    for (let i = 0; i < sparse.count; i++) {
      const k = gltf.binary[im]((iv.byteOffset || 0) + (sparse.indices.byteOffset || 0) + i * ib);
      for (let c = 0; c < n; c++) values[k * n + c] = gltf.binary[method]((vv.byteOffset || 0) + (sparse.values.byteOffset || 0) + (i * n + c) * bytes);
    }
  }
  if (a.normalized && a.componentType !== 5126) {
    const max = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 4294967295 }[a.componentType];
    return values.map(x => Math.max(-1, x / max));
  }
  return values;
}
const round = values => values.map(v => Math.round(v * 1e6) / 1e6);
export function extractMotionPack(buffer) {
  const gltf = parseGLB(buffer), g = gltf.json;
  const names = (g.animations || []).map(a => a.name || 'unnamed');
  const aliases = { idle: /^(idle|idle\d*|standing.?idle)$/i, walk: /^(walk|walking)$/i, run: /^(run|running)$/i };
  const clips = [];
  for (const [key, pattern] of Object.entries(aliases)) {
    const anim = (g.animations || []).find(a => pattern.test(a.name || ''));
    if (!anim) throw new Error(`Motion source has no '${key}' clip. Available: ${names.join(', ')}`);
    let duration = 0;
    const tracks = [];
    for (const c of anim.channels) {
      if (!['rotation', 'translation'].includes(c.target.path)) continue;
      if (c.target.path === 'translation' && !/hips|pelvis/i.test(g.nodes[c.target.node].name || '')) continue;
      const sampler = anim.samplers[c.sampler];
      const times = readAccessor(gltf, sampler.input), values = readAccessor(gltf, sampler.output);
      if (sampler.interpolation === 'CUBICSPLINE') throw new Error('Cubic motion tracks are not supported by this compact extractor.');
      duration = Math.max(duration, times[times.length - 1]);
      tracks.push({ node: c.target.node, path: c.target.path, interpolation: sampler.interpolation || 'LINEAR', times: round(times), values: round(values) });
    }
    clips.push({ name: key, duration, tracks });
  }
  return { version: 1, source: 'Three.js r180 / Xbot / Mixamo motion data',
    roots: g.scenes[g.scene || 0].nodes,
    nodes: g.nodes.map(n => ({ name: n.name || '', children: n.children || [], translation: n.translation, rotation: n.rotation, scale: n.scale, matrix: n.matrix })),
    clips };
}
