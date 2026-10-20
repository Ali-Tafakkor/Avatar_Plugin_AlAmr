/** Structural baseline for the proposed hybrid. Does not alter a model or run it. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGLB, readAccessor } from '../آواتار/scripts/glb.mjs';
import { EMOTIONS, FACE_GROUPS, normalizeShape } from '../آواتار/src/web-v2/expressions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => hash(JSON.stringify(value));
const file = async path => {
  const bytes = await readFile(resolve(root, path));
  return { path, bytes: bytes.length, sha256: hash(bytes) };
};
const canonicalBone = name => name.replace(/^mixamorig[:_]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

function accessor(gltf, index) {
  const a = gltf.json.accessors[index];
  return { type: a.type, componentType: a.componentType, count: a.count,
    normalized: Boolean(a.normalized), valuesSha256: digest(readAccessor(gltf, index)) };
}

async function inspectModel(path) {
  const bytes = await readFile(resolve(root, path));
  const gltf = parseGLB(bytes), g = gltf.json;
  const jointIndices = [...new Set((g.skins ?? []).flatMap(skin => skin.joints))];
  const jointNames = jointIndices.map(i => g.nodes[i].name ?? `node-${i}`);
  const meshes = (g.meshes ?? []).map((mesh, index) => ({
    index, name: mesh.name ?? '', targetNames: mesh.extras?.targetNames ?? [],
    primitives: mesh.primitives.map(p => ({
      mode: p.mode ?? 4, material: p.material ?? null,
      vertices: g.accessors[p.attributes.POSITION].count,
      indices: p.indices === undefined ? null : accessor(gltf, p.indices),
      attributes: Object.fromEntries(Object.entries(p.attributes).map(([name, i]) => [name, accessor(gltf, i)])),
      morphTargets: (p.targets ?? []).map(target => Object.fromEntries(
        Object.entries(target).map(([name, i]) => [name, accessor(gltf, i)]))),
    })),
  }));
  const clips = (g.animations ?? []).map(animation => {
    const payload = animation.channels.map(channel => {
      const sampler = animation.samplers[channel.sampler];
      return { target: g.nodes[channel.target.node].name ?? `node-${channel.target.node}`,
        path: channel.target.path, interpolation: sampler.interpolation ?? 'LINEAR',
        times: readAccessor(gltf, sampler.input), values: readAccessor(gltf, sampler.output) };
    });
    return { name: animation.name ?? '', durationSeconds: Math.max(...payload.flatMap(c => c.times)),
      channelCount: payload.length,
      paths: Object.fromEntries([...new Set(payload.map(c => c.path))].map(path => [path, payload.filter(c => c.path === path).length])),
      targetNames: [...new Set(payload.map(c => c.target))],
      // Semantic data rather than accessor indices: useful after an independent export.
      channelsSha256: digest(payload),
      channels: payload.map(c => ({ target: c.target, path: c.path, interpolation: c.interpolation,
        samples: c.times.length, timesSha256: digest(c.times), valuesSha256: digest(c.values) })),
    };
  });
  return {
    path, bytes: bytes.length, sha256: hash(bytes),
    jointCount: jointIndices.length, jointNames, meshCount: meshes.length,
    vertices: meshes.reduce((sum, m) => sum + m.primitives.reduce((s, p) => s + p.vertices, 0), 0),
    uniqueMorphNames: [...new Set(meshes.flatMap(m => m.targetNames))],
    facialBones: jointNames.filter(name => /eye|jaw/i.test(name)),
    fingers: Object.fromEntries(['left', 'right'].map(side => [side,
      Object.fromEntries(['thumb', 'index', 'middle', 'ring', 'pinky'].map(finger => [finger,
        jointNames.filter(name => canonicalBone(name).startsWith(`${side}hand${finger}`))]))])),
    skins: (g.skins ?? []).map(skin => ({
      joints: skin.joints.map(i => g.nodes[i].name ?? `node-${i}`),
      inverseBindMatrices: skin.inverseBindMatrices === undefined ? null : accessor(gltf, skin.inverseBindMatrices),
    })),
    images: (g.images ?? []).map((image, index) => {
      if (image.bufferView === undefined) return { index, uri: image.uri ?? null, embedded: false };
      const view = g.bufferViews[image.bufferView], start = view.byteOffset ?? 0;
      return { index, embedded: true, mimeType: image.mimeType, bytes: view.byteLength,
        sha256: hash(gltf.binary.subarray(start, start + view.byteLength)) };
    }),
    meshes, clips,
  };
}

const [v1, v2, v1Original] = await Promise.all([
  inspectModel('آواتار/assets-source/v1/avatar03.glb'),
  inspectModel('آواتار/assets-source/web-v2/avatar.glb'),
  file('source/Avatar_03/Avatar_03_Complete_Animations_Updated.glb'),
]);
if (v1.sha256 !== v1Original.sha256) throw new Error('V1 active source differs from the preserved original.');
const retainedClips = ['Stand', 'Walk', 'Run', 'Fly', 'HandRaise', 'StandToSit', 'Sitting', 'SittoStand'];
if (retainedClips.some(name => !v1.clips.some(clip => clip.name === name))) throw new Error('A required V1 clip is missing.');
const packPath = 'آواتار/assets-source/web-v2/motions.json';
const pack = JSON.parse(await readFile(resolve(root, packPath), 'utf8'));
const v2HasJumpClip = [...v2.clips, ...pack.clips].some(clip => /jump/i.test(clip.name));
if (v2HasJumpClip) throw new Error('The V2 jump source has changed; review the interpretation before recording a new baseline.');
const dynamicShapes = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight',
  'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookInLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight'];
const usedShapes = [...new Set([
  ...Object.values(EMOTIONS).flatMap(emotion => Object.keys(emotion.values)),
  ...Object.values(FACE_GROUPS).flat(), ...dynamicShapes,
])].sort();
const missingShapes = model => usedShapes.filter(name => !model.uniqueMorphNames.some(shape => normalizeShape(shape) === normalizeShape(name)));
const observedFiles = [
  'آواتار/src/motion.ts', 'آواتار/src/model.ts', 'آواتار/src/index.tsx', 'آواتار/src/v2.tsx',
  'آواتار/src/web-v2/expressions.mjs', 'آواتار/src/web-v2/animation.mjs',
  'آواتار/src/web-v2/actor.mjs', 'آواتار/src/web-v2/runtime.mjs',
  'avatar-lab/src/comparison.mjs', 'avatar-lab/src/legacy-preview.mjs',
  'avatar-lab/dist/index.html',
];
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(),
  purpose: 'Structural source baseline for V1 identity/body + V2 facial system/jump',
  status: { hybridAssetCreated: false, hybridRuntimeCreated: false, hybridVisualAcceptance: null,
    originalAppearanceAndMotionPreservation: 'required, not yet demonstrated for a hybrid',
    facialTopologySuitability: 'requires visual and authoring review; counts do not establish suitability' },
  v1Original, models: { v1, v2 },
  motion: {
    retainedV1Clips: retainedClips,
    replacedInHybridOnly: 'Jump',
    v2MotionPack: { ...await file(packPath), clips: pack.clips.map(c => ({ name: c.name, durationSeconds: c.duration, trackCount: c.tracks.length })) },
    v2Jump: { standaloneAnimationClip: v2HasJumpClip,
      implementation: 'MotionDirector.update: idle/gait base blend, airBlend/tuck and landing compression; host owns root flight',
      acceptedHostProfile: { jumpSpeed: 5.6, gravity: 18.8 },
      transferAcceptance: 'compare donor and hybrid at the same jump timeline; copying overlay constants alone is insufficient' },
  },
  face: {
    sourceEmotions: Object.keys(EMOTIONS), sourceManualGroups: FACE_GROUPS,
    channelsUsedByCurrentExpressionCode: usedShapes,
    v1MissingChannels: missingShapes(v1), v2MissingChannels: missingShapes(v2),
    v2VisemeChannels: v2.uniqueMorphNames.filter(name => /^viseme_/i.test(name)),
    v2SpeechPlaybackImplemented: false,
    transferConstraint: 'morph displacement arrays require correspondence to the target mesh; same channel names do not supply deformation',
    futureCompositionConstraint: 'FaceRig.apply writes every morph; combine future speech with emotion/blink/gaze before a single apply',
  },
  observedFiles: await Promise.all(observedFiles.map(file)),
  limits: ['No mesh, skeleton, texture or animation was edited.',
    'This structural audit is not a rendered facial-quality test, web runtime test, or Quest test.',
    'Source fingerprints are references, not proof that a future derivative preserves appearance or deformation.'],
};
if (report.face.v2MissingChannels.length) throw new Error('Current V2 does not cover the audited expression channels.');
const outputArg = process.argv[2];
if (outputArg) {
  const output = resolve(root, outputArg), inside = relative(root, output);
  if (isAbsolute(inside) || inside === '..' || inside.startsWith('..\\') || inside.startsWith('../')) throw new Error('Output must stay inside the workspace.');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ code: 'HYBRID_SOURCE_BASELINE_RECORDED', output: inside,
    v1Joints: v1.jointCount, v1Vertices: v1.vertices, v1Morphs: v1.uniqueMorphNames.length,
    v2Joints: v2.jointCount, v2Vertices: v2.vertices, v2Morphs: v2.uniqueMorphNames.length,
    preservedV1Clips: retainedClips.length, missingV1FaceChannels: report.face.v1MissingChannels.length,
    v2HasJumpClip, hybridCreated: false }));
} else process.stdout.write(JSON.stringify(report, null, 2) + '\n');
