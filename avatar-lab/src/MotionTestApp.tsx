import React, { Component, Suspense, forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, LoopOnce, LoopRepeat, Quaternion, Vector3, type Object3D } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PlayerRig, createFlatNavigationSurface, computeCameraTransform, type AvatarLocomotion } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { Avatar03Animator, EMOTIONS, type Avatar03Clip, type Avatar03Lighting, type AvatarMotion, type EmotionName } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import { createAvatar03Instance } from '../../آواتار/dist/model.js';
import { createComparisonSession, MOVEMENT_PROFILES, type AvatarId, type ComparisonSession } from './comparison.mjs';
import { fixLegacyPreviewMaterials } from './legacy-preview.mjs';
import { MotionTestAvatar, type MotionTestAvatarHandle } from './MotionTestAvatar';
import { LabStage } from './LabStage';
import './motion-test.css';

const CLIPS = ['Stand', 'Walk', 'Run', 'Fly', 'HandRaise', 'StandToSit', 'Sitting', 'SittoStand'] as const;
type TestClip = typeof CLIPS[number];
type View = 'both' | 'follow' | 'face' | 'legs' | 'review-feet' | 'review-left-hand' | 'review-right-hand' | 'review-v2-body';
const labels: Record<TestClip, string> = { Stand: 'ایستادن', Walk: 'راه‌رفتن', Run: 'دویدن', Fly: 'پرواز', HandRaise: 'بالابردن دست', StandToSit: 'نشستن', Sitting: 'نشسته', SittoStand: 'برخاستن' };
const actorNames = { v1: 'مرجع حرکت · V1', v2: 'مدل وب · حرکت جدید' };
const TEST_MOVEMENT_PROFILES = {
  v1: MOVEMENT_PROFILES.v1,
  v2: { ...MOVEMENT_PROFILES.v1, jumpSpeed: 5.6, gravity: 18.8 },
};
const navigation = createFlatNavigationSurface(0, { minX: -25, maxX: 25, minZ: -25, maxZ: 25 });
const legacyModelUrl = new URL('./motion-test/reference/legacy.gltf', document.baseURI).href;
const modelUrl = new URL('./avatar-v2/avatar.gltf', document.baseURI).href;
const motionsUrl = new URL('./avatar-v2/motions.json', document.baseURI).href;
const INSPECTION_MODE = import.meta.env.MODE === 'inspection';
const once = new Set<Avatar03Clip>(['HandRaise', 'StandToSit', 'SittoStand', 'Jump']);
const errors: string[] = [];
const reportError = (value: unknown) => {
  const message = value instanceof Error ? value.message : String(value);
  if (!errors.includes(message)) errors.push(message);
};

type Playback = { mode: 'control' | 'clip'; clip: TestClip; time: number; paused: boolean; speed: number; duration: number };
type ReferenceStatus = ReturnType<Avatar03Animator['getStatus']>;
interface ReferenceHandle {
  setLocomotion(value: AvatarMotion): void;
  previewClip(value: TestClip | null): void;
  seekClip(time: number): void;
  setPlayback(value: { paused?: boolean; timeScale?: number }): void;
  reset(): void;
  getStatus(): ReferenceStatus | null;
  getRoot(): Group | null;
}
type Refs = { old: React.RefObject<ReferenceHandle | null>; web: React.RefObject<MotionTestAvatarHandle | null> };
type RuntimeStatus = ReturnType<MotionTestAvatarHandle['getStatus']>;
const diagnostics = {
  ready: { v1: false, v2: false }, renderer: 'loading', runtime: 'waiting', frames: 0, renderSeconds: 0,
  reviewPhase: INSPECTION_MODE ? 'در انتظار آماده‌شدن هر دو آواتار' : '', reviewIndex: -1, reviewCycle: 0,
  active: 'v2' as AvatarId, positions: { v1: [-1.25, 0, 0] as readonly number[], v2: [1.25, 0, 0] as readonly number[] },
  speeds: { v1: 0, v2: 0 }, old: null as ReferenceStatus | null, web: null as RuntimeStatus,
  bodyProbe: { referenceToSamplerMaxDeg: null as number | null, referenceToTargetMaxDeg: null as number | null,
    worstSamplerSegment: 'waiting', worstTargetSegment: 'waiting',
    segments: [] as { segment: string; samplerDeg: number | null; targetDeg: number | null }[] },
  renderProbe: { cssSize: [0, 0], canvasPixels: [0, 0], clientSize: [0, 0], cameraPosition: [0, 0, 0], cameraQuaternion: [0, 0, 0, 1],
    cameraFinite: true, projectionFinite: true, projectionAspect: 1, renderCalls: null as number | null, drawCalls: null as number | null, triangles: null as number | null },
};

/** Local inspection adapter; original V1 model and public Plugin API stay unchanged. */
const ReferenceAvatar = forwardRef<ReferenceHandle, { lighting: Avatar03Lighting; onReady: (clips: { name: string; duration: number }[]) => void }>(function ReferenceAvatar({ lighting, onReady }, ref) {
  const gltf = useLoader(GLTFLoader, legacyModelUrl);
  const instance = useMemo(() => createAvatar03Instance(gltf, 1.78, lighting), [gltf, lighting]);
  const animator = useRef<Avatar03Animator | null>(null);
  const playback = useRef({ clip: null as TestClip | null, time: 0, paused: false, timeScale: 1 });
  const callback = useRef(onReady); callback.current = onReady;
  const seek = useCallback((time: number) => {
    const driver = animator.current, name = playback.current.clip;
    if (!driver || !name) return;
    const clip = gltf.animations.find(item => item.name === name);
    if (!clip) return;
    const requested = Math.max(0, Number.isFinite(time) ? time : 0);
    const sampleTime = once.has(name) ? Math.min(requested, clip.duration) : requested % Math.max(clip.duration, 1e-6);
    const action = driver.mixer.clipAction(clip);
    driver.mixer.stopAllAction();
    action.reset().setLoop(once.has(name) ? LoopOnce : LoopRepeat, once.has(name) ? 1 : Infinity).play();
    action.clampWhenFinished = once.has(name); action.time = sampleTime;
    // Direct action sampling avoids wall-clock crossfades when scrubbing backwards.
    driver.mixer.update(0); playback.current.time = requested;
  }, [gltf]);
  useEffect(() => {
    fixLegacyPreviewMaterials(instance.root);
    for (const mesh of instance.meshes) { mesh.castShadow = true; mesh.receiveShadow = true; }
    const driver = new Avatar03Animator(instance.model, gltf.animations); animator.current = driver;
    if (playback.current.clip) { driver.preview(playback.current.clip); seek(playback.current.time); }
    callback.current(gltf.animations.map(clip => ({ name: clip.name, duration: clip.duration })));
    return () => { driver.dispose(); if (animator.current === driver) animator.current = null; };
  }, [gltf, instance, seek]);
  useEffect(() => () => instance.dispose(), [instance]);
  useImperativeHandle(ref, () => ({
    setLocomotion(value) { animator.current?.setMotion(value); },
    previewClip(value) { playback.current.clip = value; playback.current.time = 0; animator.current?.preview(value); if (value) seek(0); },
    seekClip: seek,
    setPlayback(value) {
      if (typeof value.paused === 'boolean') playback.current.paused = value.paused;
      if (typeof value.timeScale === 'number' && Number.isFinite(value.timeScale)) playback.current.timeScale = value.timeScale;
    },
    reset() { playback.current.clip = null; playback.current.time = 0; animator.current?.preview(null); animator.current?.setMotion({ state: 'idle' }); },
    getStatus() { return animator.current?.getStatus() ?? null; },
    getRoot() { return instance.root; },
  }), [seek, instance]);
  useFrame((_state, dt) => {
    if (!playback.current.paused) animator.current?.update(dt * playback.current.timeScale);
  });
  return <group rotation-y={Math.PI}><primitive object={instance.root} dispose={null} /></group>;
});

const renderers = new WeakMap<HTMLCanvasElement, Promise<WebGPURenderer>>();
function createRenderer({ canvas }: { canvas: unknown }) {
  const surface = canvas as HTMLCanvasElement;
  let pending = renderers.get(surface);
  if (!pending) {
    pending = (async () => {
      const renderer = new WebGPURenderer({ canvas: surface, antialias: true }); await renderer.init();
      diagnostics.renderer = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2 fallback';
      return renderer;
    })();
    renderers.set(surface, pending);
  }
  return pending;
}
class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error) { reportError(error); }
  render() { return this.state.error ? <div className="mt-error" role="alert">بارگذاری انجام نشد: {this.state.error}</div> : this.props.children; }
}

function ActorTransform({ session, id, group }: { session: ComparisonSession; id: AvatarId; group: React.RefObject<Group | null> }) {
  const point = useRef(new Vector3()), orientation = useRef(new Quaternion()), parent = useRef(new Quaternion());
  useFrame(() => {
    const node = group.current; if (!node?.parent) return;
    const pose = session.controllers[id].getPoseSnapshot();
    node.parent.updateWorldMatrix(true, false);
    point.current.set(...pose.position); node.parent.worldToLocal(point.current); node.position.copy(point.current);
    if (pose.orientation) orientation.current.set(...pose.orientation);
    else orientation.current.setFromAxisAngle(new Vector3(0, 1, 0), pose.yaw);
    node.parent.getWorldQuaternion(parent.current).invert(); node.quaternion.copy(parent.current).multiply(orientation.current);
    node.updateWorldMatrix(false, true);
  });
  return null;
}
function WorldActor({ session, id, active, children }: { session: ComparisonSession; id: AvatarId; active: AvatarId; children: ReactNode }) {
  const group = useRef<Group>(null), [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <group ref={group}>
    {mounted && <ActorTransform session={session} id={id} group={group} />}{children}
    <mesh rotation-x={-Math.PI / 2} position-y={0.003}><ringGeometry args={[0.48, active === id ? 0.515 : 0.495, 48]} /><meshBasicMaterial color={id === 'v1' ? '#487b95' : '#ae814a'} /></mesh>
    <Html center position={[0, 2.06, 0]} style={{ pointerEvents: 'none' }}><div className={`mt-actor ${id} ${id === active ? 'selected' : ''}`}>{actorNames[id]}{id === active && <small>کنترل فعال</small>}</div></Html>
  </group>;
}

function SceneClock({ session, refs, playback, view }: { session: ComparisonSession; refs: Refs; playback: React.RefObject<Playback>; view: View }) {
  const signalled = useRef(false);
  const cameraPosition = useRef(new Vector3()), cameraQuaternion = useRef(new Quaternion());
  useFrame(({ camera, size, gl }, dt) => {
    diagnostics.renderSeconds += Math.min(Math.max(dt, 0), 0.1);
    const clock = playback.current;
    if (clock.mode === 'clip') {
      if (!clock.paused && diagnostics.ready.v1 && diagnostics.ready.v2) {
        clock.time += Math.min(Math.max(dt, 0), 0.1) * clock.speed;
        if (once.has(clock.clip)) clock.time = Math.min(clock.time, clock.duration);
        else if (clock.duration > 0) clock.time %= clock.duration;
      }
      refs.old.current?.seekClip(clock.time); refs.web.current?.seekClip(clock.time);
    }
    if (INSPECTION_MODE) {
      const referenceRoot = refs.old.current?.getRoot(), runtime = refs.web.current?.getRuntime();
      const samplerRoot = runtime?.mapped?.source?.root as Group | undefined;
      const targetRoot = runtime?.actor?.root as Group | undefined;
      if (referenceRoot && samplerRoot && targetRoot) {
        const segments = ['leftarm:leftforearm', 'leftforearm:lefthand', 'rightarm:rightforearm', 'rightforearm:righthand',
          'leftupleg:leftleg', 'leftleg:leftfoot', 'rightupleg:rightleg', 'rightleg:rightfoot', 'spine2:neck'];
        const directions = (root: Group) => {
          root.updateWorldMatrix(true, true); root.updateMatrixWorld(true);
          const origin = root.getWorldPosition(new Vector3()), inverse = root.getWorldQuaternion(new Quaternion()).invert();
          const bones = new Map<string, Object3D>();
          root.traverse(node => {
            if (node.type !== 'Bone') return;
            // Same canonicalization and aliases as web-v2/actor.mjs boneName().
            const name = node.name.split(/[|:]/).pop()!.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(mixamorig|ccbase|bip001|armature)/, '');
            const aliases: Record<string, string> = { pelvis: 'hips', lthigh: 'leftupleg', rthigh: 'rightupleg', lcalf: 'leftleg', rcalf: 'rightleg',
              lupperarm: 'leftarm', rupperarm: 'rightarm', lforearm: 'leftforearm', rforearm: 'rightforearm',
              eyeleft: 'lefteye', eyeright: 'righteye', eyel: 'lefteye', eyer: 'righteye' };
            bones.set(aliases[name] || name, node);
          });
          const result = new Map<string, Vector3>();
          for (const segment of segments) {
            const [from, to] = segment.split(':'), a = bones.get(from), b = bones.get(to);
            if (!a || !b) continue;
            const start = a.getWorldPosition(new Vector3()).sub(origin).applyQuaternion(inverse);
            const direction = b.getWorldPosition(new Vector3()).sub(origin).applyQuaternion(inverse).sub(start);
            if (direction.lengthSq() > 1e-12) result.set(segment, direction.normalize());
          }
          return result;
        };
        const reference = directions(referenceRoot), sampler = directions(samplerRoot), target = directions(targetRoot);
        const degrees = (a: Vector3 | undefined, b: Vector3 | undefined) => a && b ? a.angleTo(b) * 180 / Math.PI : null;
        const comparisons = segments.map(segment => ({ segment, samplerDeg: degrees(reference.get(segment), sampler.get(segment)),
          targetDeg: degrees(reference.get(segment), target.get(segment)) }));
        const worstSampler = comparisons.filter(item => item.samplerDeg !== null).sort((a, b) => b.samplerDeg! - a.samplerDeg!)[0];
        const worstTarget = comparisons.filter(item => item.targetDeg !== null).sort((a, b) => b.targetDeg! - a.targetDeg!)[0];
        diagnostics.bodyProbe = { referenceToSamplerMaxDeg: worstSampler?.samplerDeg ?? null, referenceToTargetMaxDeg: worstTarget?.targetDeg ?? null,
          worstSamplerSegment: worstSampler?.segment ?? 'missing', worstTargetSegment: worstTarget?.segment ?? 'missing', segments: comparisons };
      }
    }
    diagnostics.frames++; diagnostics.active = session.active;
    for (const id of ['v1', 'v2'] as const) {
      const pose = session.controllers[id].getPoseSnapshot(); diagnostics.positions[id] = pose.position;
      diagnostics.speeds[id] = Math.hypot(pose.velocity[0], pose.velocity[2]);
    }
    diagnostics.old = refs.old.current?.getStatus() ?? null; diagnostics.web = refs.web.current?.getStatus() ?? null;
    if (diagnostics.ready.v1 && diagnostics.ready.v2 && diagnostics.frames > 3 && !signalled.current) {
      signalled.current = true;
      void (async () => {
        if (!window.alamr) { diagnostics.runtime = 'browser-local'; return; }
        diagnostics.runtime = 'painting';
        try {
          const painting = await window.alamr.runtime.painting();
          if (!painting.ok) reportError(painting.error.code);
          const ready = await window.alamr.runtime.ready();
          diagnostics.runtime = ready.ok ? 'ready' : ready.error.code;
          if (!ready.ok) reportError(ready.error.code);
        } catch (reason) { diagnostics.runtime = 'runtime-handshake-failed'; reportError(reason); }
      })();
    }
    if (view === 'both') {
      const a = diagnostics.positions.v1, b = diagnostics.positions.v2;
      const state = session.controller.getCameraSnapshot(), pose = session.controller.getPoseSnapshot();
      const span = Math.hypot(a[0] - b[0], a[2] - b[2]) + 1.25;
      const aspect = Math.max(0.2, size.width / Math.max(size.height, 1));
      const distance = Math.max(state.distance, span / (2 * Math.tan(21 * Math.PI / 180) * aspect) * 1.18, 4);
      const transform = computeCameraTransform({ ...state, distance, mode: 'third-person', firstPersonBlend: 0 },
        { ...pose, position: [(a[0] + b[0]) / 2, Math.max(a[1], b[1]), (a[2] + b[2]) / 2] }, { targetHeight: 0.95 });
      camera.position.set(...transform.position); camera.lookAt(...transform.target);
    }
    // Dedicated inspection views follow the actual V2 joints. A wrist-centred
    // camera avoids the opposite actor and shows the whole hand as curl changes.
    // These camera overrides never run in a normal-mode build.
    if (INSPECTION_MODE && ['review-feet', 'review-left-hand', 'review-right-hand'].includes(view)) {
      const runtime = refs.web.current?.getRuntime(), actor = runtime?.actor;
      const bones = actor?.bones as Map<string, Object3D> | undefined;
      if (bones) {
        actor.refresh?.();
        const focus = new Vector3(); let valid = false;
        if (view === 'review-feet') {
          const left = bones.get('leftfoot'), right = bones.get('rightfoot');
          if (left && right) {
            focus.copy(left.getWorldPosition(new Vector3())).add(right.getWorldPosition(new Vector3())).multiplyScalar(0.5);
            focus.y += 0.10; valid = true;
          }
        } else {
          const side = view === 'review-left-hand' ? 'left' : 'right';
          const wrist = bones.get(side + 'hand');
          if (wrist) {
            focus.copy(wrist.getWorldPosition(new Vector3()));
            const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky'].map(digit => bones.get(side + 'hand' + digit + '3')).filter((bone): bone is Object3D => Boolean(bone));
            if (fingers.length) {
              const centre = fingers.reduce((sum, bone) => sum.add(bone.getWorldPosition(new Vector3())), new Vector3()).multiplyScalar(1 / fingers.length);
              focus.lerp(centre, 0.55);
            }
            valid = true;
          }
        }
        if (valid) {
          const controller = session.controllers.v2, pose = controller.getPoseSnapshot();
          const transform = computeCameraTransform({ ...controller.getCameraSnapshot(), mode: 'third-person', firstPersonBlend: 0 },
            { ...pose, position: focus.toArray() as [number, number, number] }, { targetHeight: 0 });
          camera.position.set(...transform.position); camera.lookAt(...transform.target);
        }
      }
    }
    camera.updateMatrixWorld(true);
    const position = camera.getWorldPosition(cameraPosition.current).toArray(), quaternion = camera.getWorldQuaternion(cameraQuaternion.current).toArray();
    const canvas = gl.domElement;
    const info = (gl as unknown as { info?: { calls?: number; render?: { calls?: number; drawCalls?: number; triangles?: number } } }).info;
    diagnostics.renderProbe = {
      cssSize: [size.width, size.height], canvasPixels: [canvas.width, canvas.height], clientSize: [canvas.clientWidth, canvas.clientHeight],
      cameraPosition: position, cameraQuaternion: quaternion, cameraFinite: [...position, ...quaternion].every(Number.isFinite),
      projectionFinite: camera.projectionMatrix.elements.every(Number.isFinite), projectionAspect: (camera as unknown as { aspect?: number }).aspect ?? 0,
      renderCalls: info?.render?.calls ?? info?.calls ?? null, drawCalls: info?.render?.drawCalls ?? null, triangles: info?.render?.triangles ?? null,
    };
  });
  return null;
}
function LateClock(props: Parameters<typeof SceneClock>[0]) {
  const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);
  return mounted ? <SceneClock {...props} /> : null;
}
const Scene = memo(function Scene({ session, refs, playback, active, view, mode, lighting, onOldReady, onWebReady }: {
  session: ComparisonSession; refs: Refs; playback: React.RefObject<Playback>; active: AvatarId; view: View; mode: Playback['mode']; lighting: Avatar03Lighting;
  onOldReady: (clips: { name: string; duration: number }[]) => void; onWebReady: (value: unknown) => void;
}) {
  const onMotion = useCallback((value: AvatarLocomotion) => {
    if (active === 'v1') refs.old.current?.setLocomotion(value); else refs.web.current?.setLocomotion(value);
  }, [active, refs]);
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 1.5, 5.8], fov: 42, near: 0.03, far: 160 }} gl={createRenderer}>
    <LabStage /><Suspense fallback={null}>
      <PlayerRig controller={session.controllers[active]} navigation={navigation} movement={TEST_MOVEMENT_PROFILES[active]} paused={mode === 'clip'}
        camera={{ initialDistance: 5.8, minDistance: 0.55, maxDistance: 55, targetHeight: view === 'face' ? 1.60 : view === 'legs' ? 0.60 : 0.95 }}
        onAnimationFrame={onMotion} avatar={<>
          <WorldActor session={session} id="v1" active={active}><ReferenceAvatar ref={refs.old} lighting={lighting} onReady={onOldReady} /></WorldActor>
          <WorldActor session={session} id="v2" active={active}><MotionTestAvatar ref={refs.web} controller={session.controllers.v2} navigation={navigation}
            modelUrl={modelUrl} motionsUrl={motionsUrl} legacyModelUrl={legacyModelUrl} lighting={lighting} portrait={view === 'face' && active === 'v2'} onReady={onWebReady} onError={reportError} /></WorldActor>
          <LateClock session={session} refs={refs} playback={playback} view={view} />
        </>} />
    </Suspense>
  </Canvas>;
});

export function MotionTestApp() {
  const [session] = useState(createComparisonSession);
  const old = useRef<ReferenceHandle | null>(null), web = useRef<MotionTestAvatarHandle | null>(null);
  const [refs] = useState<Refs>(() => ({ old, web }));
  const playback = useRef<Playback>({ mode: 'control', clip: 'Stand', time: 0, paused: false, speed: 1, duration: 1 });
  const clipDurations = useRef(new Map<string, number>());
  const [active, setActive] = useState<AvatarId>('v2'), [view, setView] = useState<View>('both');
  const [lighting, setLighting] = useState<Avatar03Lighting>('scene'), [clean, setClean] = useState(false);
  const [mode, setMode] = useState<Playback['mode']>('control'), [emotion, setEmotionState] = useState<EmotionName>('smile');
  const selectedEmotion = useRef<EmotionName>('smile');
  const [ready, setReady] = useState({ v1: false, v2: false });
  const [stats, setStats] = useState(() => ({ ...diagnostics, clock: { ...playback.current }, errors: [...errors] }));
  const snapshot = useCallback(() => ({ ...diagnostics, old: old.current?.getStatus() ?? null, web: web.current?.getStatus() ?? null,
    positions: { ...diagnostics.positions }, speeds: { ...diagnostics.speeds }, ready: { ...diagnostics.ready }, clock: { ...playback.current }, errors: [...errors] }), []);
  const onOldReady = useCallback((clips: { name: string; duration: number }[]) => {
    for (const clip of clips) clipDurations.current.set(clip.name, clip.duration);
    diagnostics.ready.v1 = true; setReady(value => ({ ...value, v1: true }));
    const clock = playback.current; clock.duration = clipDurations.current.get(clock.clip) ?? 1;
    if (clock.mode === 'clip') { old.current?.previewClip(clock.clip); old.current?.setPlayback({ paused: true, timeScale: 1 }); old.current?.seekClip(clock.time); }
  }, []);
  const onWebReady = useCallback((_value: unknown) => {
    diagnostics.ready.v2 = true; setReady(value => ({ ...value, v2: true }));
    web.current?.setEmotion(selectedEmotion.current);
    const clock = playback.current;
    if (clock.mode === 'clip') { web.current?.previewClip(clock.clip); web.current?.setPlayback({ paused: true, timeScale: 1 }); web.current?.seekClip(clock.time); }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setStats(snapshot()), 100);
    const onError = (event: ErrorEvent) => reportError(event.message), onRejection = (event: PromiseRejectionEvent) => reportError(event.reason);
    addEventListener('error', onError); addEventListener('unhandledrejection', onRejection);
    return () => { clearInterval(timer); session.releaseInput(); removeEventListener('error', onError); removeEventListener('unhandledrejection', onRejection); };
  }, [session, snapshot]);
  const cameraView = useCallback((next: View) => {
    const controller = session.controller, yaw = controller.getPoseSnapshot().yaw;
    controller.setCamera({ ...controller.getCameraSnapshot(), yaw: next === 'follow' ? yaw : yaw + (next === 'legs' ? Math.PI * 0.65 : Math.PI),
      pitch: next === 'face' ? 0 : 0.06, distance: next === 'face' ? 1 : next === 'legs' ? 2.8 : next === 'both' ? 5.8 : 4.3, mode: 'third-person', firstPersonBlend: 0 });
    setView(next);
  }, [session]);
  const normalControl = useCallback(() => {
    session.releaseInput(); playback.current.mode = 'control'; playback.current.paused = false;
    old.current?.previewClip(null); old.current?.setPlayback({ paused: false, timeScale: 1 }); old.current?.setLocomotion({ state: 'idle', horizontalSpeed: 0 });
    web.current?.previewClip(null); web.current?.setPlayback({ paused: false, timeScale: 1 }); web.current?.setLocomotion({ state: 'idle', horizontalSpeed: 0, verticalSpeed: 0, grounded: true });
    setMode('control');
  }, [session]);
  const selectClip = useCallback((clip: TestClip) => {
    if (!(CLIPS as readonly string[]).includes(clip)) throw new Error('motion_test_unknown_clip');
    session.reset(); cameraView(view);
    const clock = playback.current; clock.mode = 'clip'; clock.clip = clip; clock.time = 0; clock.duration = clipDurations.current.get(clip) ?? 1;
    old.current?.previewClip(clip); web.current?.previewClip(clip);
    old.current?.setPlayback({ paused: true, timeScale: 1 }); web.current?.setPlayback({ paused: true, timeScale: 1 });
    old.current?.seekClip(0); web.current?.seekClip(0); setMode('clip');
  }, [session, cameraView, view]);
  const seek = useCallback((time: number) => {
    const clock = playback.current;
    if (clock.mode !== 'clip') selectClip(clock.clip);
    clock.paused = true; clock.time = Math.min(clock.duration, Math.max(0, Number.isFinite(time) ? time : 0));
    old.current?.seekClip(clock.time); web.current?.seekClip(clock.time); setStats(snapshot());
  }, [selectClip, snapshot]);
  const setPaused = useCallback((value: boolean) => { playback.current.paused = Boolean(value); setStats(snapshot()); }, [snapshot]);
  const setSpeed = useCallback((value: number) => { if (Number.isFinite(value)) playback.current.speed = Math.max(0.1, Math.min(2, value)); setStats(snapshot()); }, [snapshot]);
  const selectActor = useCallback((id: AvatarId) => {
    const previous = session.active; session.select(id);
    if (previous !== id) {
      old.current?.setLocomotion({ state: 'idle', horizontalSpeed: 0 });
      web.current?.setLocomotion({ state: 'idle', horizontalSpeed: 0, verticalSpeed: 0, grounded: true });
      setActive(id); cameraView(view);
    }
  }, [session, cameraView, view]);
  const reset = useCallback(() => { normalControl(); session.reset(); old.current?.reset(); web.current?.reset(); cameraView('both'); }, [normalControl, session, cameraView]);
  const motion = useCallback((value: 'walk' | 'run' | 'idle') => {
    normalControl(); if (value === 'idle') return;
    session.controller.setAction('forward', true); session.controller.setAction('sprint', value === 'run'); cameraView('follow');
  }, [normalControl, session, cameraView]);
  const jump = useCallback(() => {
    normalControl(); const controller = session.controller;
    controller.setAction('jump', true); setTimeout(() => controller.setAction('jump', false), 100);
  }, [normalControl, session]);
  const setEmotion = useCallback((value: EmotionName) => { selectedEmotion.current = value; setEmotionState(value); web.current?.setEmotion(value); }, []);
  const setCamera = useCallback((yaw: number, pitch: number, distance: number) => {
    const controller = session.controller;
    controller.setCamera({ ...controller.getCameraSnapshot(), yaw, pitch, distance, mode: 'third-person', firstPersonBlend: 0 });
  }, [session]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)))) return;
      if (event.code === 'KeyV') selectActor(session.active === 'v1' ? 'v2' : 'v1');
      if (event.code === 'KeyR') reset(); if (event.code === 'KeyH') setClean(value => !value); if (event.code === 'Escape') setClean(false);
      if (event.code === 'KeyB') web.current?.blink();
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [session, selectActor, reset]);
  useEffect(() => {
    const api = {
      snapshot, selectClip, seek, setPaused, setSpeed, normalControl, selectActor, motion, jump, reset, setEmotion,
      blink: () => web.current?.blink(), setView: cameraView,
      setCamera,
      getRuntime: () => web.current?.getRuntime() ?? null,
      clips: [...CLIPS],
    };
    Object.defineProperty(window, '__motionTest', { configurable: true, value: api });
    return () => { delete (window as unknown as Record<string, unknown>).__motionTest; };
  }, [snapshot, selectClip, seek, setPaused, setSpeed, normalControl, selectActor, motion, jump, reset, setEmotion, cameraView, setCamera, session]);
  const allReady = ready.v1 && ready.v2;
  const inspectionActions = useRef({ selectActor, selectClip, seek, setPaused, setEmotion, cameraView, setCamera, snapshot });
  inspectionActions.current = { selectActor, selectClip, seek, setPaused, setEmotion, cameraView, setCamera, snapshot };
  useEffect(() => {
    if (!INSPECTION_MODE || !allReady) return;
    let cancelled = false;
    const phases: { label: string; clip: TestClip; fraction: number; view: View; yaw: number; pitch: number; distance: number; emotion: EmotionName }[] = [
      ...CLIPS.map(clip => ({ label: `نمای مشترک · ${labels[clip]}`, clip, fraction: clip === 'StandToSit' ? 0.65 : clip === 'SittoStand' ? 0.35 : 0.4,
        view: 'both' as View, yaw: Math.PI, pitch: 0.06, distance: 5.8, emotion: 'neutral' as EmotionName })),
      ...(['Walk', 'Run', 'HandRaise', 'Sitting'] as TestClip[]).map(clip => ({ label: `نیم‌رخ مدل وب · ${labels[clip]}`, clip, fraction: 0.4,
        view: 'follow' as View, yaw: Math.PI / 2, pitch: 0.06, distance: 3.6, emotion: 'neutral' as EmotionName })),
      ...(Object.keys(EMOTIONS) as EmotionName[]).map(emotion => ({ label: `صورت مدل وب · ${EMOTIONS[emotion].label}`, clip: 'Stand' as TestClip, fraction: 0,
        view: 'face' as View, yaw: Math.PI, pitch: 0, distance: 0.9, emotion })),
      // Stable indices 18..22 extend the previous eighteen cases. The existing
      // meta motion-review-case selector can hold each view for before/after work.
      { label: 'پاشنه و کف هر دو کفش · پشت سه‌رخ', clip: 'Stand', fraction: 0.4, view: 'review-feet',
        yaw: Math.PI / 5, pitch: -0.18, distance: 1.25, emotion: 'neutral' },
      { label: 'دست چپ مدل وب · نمای نزدیک', clip: 'Stand', fraction: 0.4, view: 'review-left-hand',
        yaw: -Math.PI * 0.65, pitch: -0.12, distance: 0.58, emotion: 'neutral' },
      { label: 'دست راست مدل وب · نمای نزدیک', clip: 'Stand', fraction: 0.4, view: 'review-right-hand',
        yaw: Math.PI * 0.65, pitch: -0.12, distance: 0.58, emotion: 'neutral' },
      { label: 'تمام بدن مدل وب · ایستاده خنثی', clip: 'Stand', fraction: 0.4, view: 'review-v2-body',
        yaw: Math.PI, pitch: 0.04, distance: 3.0, emotion: 'neutral' },
      { label: 'تمام بدن مدل وب · راه‌رفتن در ۴۰٪ کلیپ', clip: 'Walk', fraction: 0.4, view: 'review-v2-body',
        yaw: Math.PI, pitch: 0.04, distance: 3.0, emotion: 'neutral' },
    ];
    const configuredCase = document.querySelector<HTMLMetaElement>('meta[name="motion-review-case"]')?.content.trim();
    const requestedIndex = configuredCase && /^\d+$/.test(configuredCase) ? Number(configuredCase) : NaN;
    const heldIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < phases.length ? requestedIndex : null;
    const waitRendered = async (seconds: number) => {
      const start = diagnostics.renderSeconds;
      while (!cancelled && diagnostics.renderSeconds - start < seconds) await new Promise<void>(resolve => setTimeout(resolve, 40));
    };
    void (async () => {
      while (!cancelled) {
        diagnostics.reviewCycle++;
        for (let index = heldIndex ?? 0; index < phases.length && !cancelled; index++) {
          const phase = phases[index], actions = inspectionActions.current;
          actions.selectActor('v2'); actions.selectClip(phase.clip);
          actions.seek((clipDurations.current.get(phase.clip) ?? 1) * phase.fraction); actions.setPaused(true);
          actions.setEmotion(phase.emotion); actions.cameraView(phase.view); actions.setCamera(phase.yaw, phase.pitch, phase.distance);
          diagnostics.reviewIndex = index;
          diagnostics.reviewPhase = `${index + 1}/${phases.length} · ${phase.label}`;
          setStats(actions.snapshot());
          if (heldIndex !== null) return;
          await waitRendered(6);
        }
      }
    })().catch(reason => { diagnostics.reviewPhase = 'بازبینی خودکار متوقف شد'; reportError(reason); });
    return () => { cancelled = true; };
  }, [allReady]);
  const clock = stats.clock;
  return <main className={`mt-app ${clean ? 'mt-clean' : ''}`}>
    <section className="mt-viewport" aria-label="مقایسه مرجع نسخه اول و حرکات منتقل‌شده روی مدل وب">
      <SceneBoundary><Scene session={session} refs={refs} playback={playback} active={active} view={view} mode={mode} lighting={lighting} onOldReady={onOldReady} onWebReady={onWebReady} /></SceneBoundary>
      {!allReady && <div className="mt-loading" role="status">در حال آماده‌سازی مدل‌ها…</div>}
      <div className="mt-mark"><span>AL-AMR / LOCAL MOTION TEST</span><b>V1 → WEB V2</b></div>
      <div className="mt-status">{INSPECTION_MODE ? stats.reviewPhase : mode === 'clip' ? `${labels[clock.clip]} · ${clock.time.toFixed(2)} s` : `کنترل ${active === 'v1' ? 'مرجع V1' : 'مدل وب'}`}<small>{stats.renderer}{INSPECTION_MODE ? ` · ${stats.renderSeconds.toFixed(1)} s` : ''}</small>
        <small dir="ltr">CSS {stats.renderProbe.cssSize.map(Math.round).join('×')} / canvas {stats.renderProbe.canvasPixels.join('×')} · camera {stats.renderProbe.cameraFinite ? 'finite' : 'INVALID'} / projection {stats.renderProbe.projectionFinite ? 'finite' : 'INVALID'}</small>
        <small dir="ltr">cam [{stats.renderProbe.cameraPosition.map(value => value.toFixed(2)).join(', ')}] · q [{stats.renderProbe.cameraQuaternion.map(value => value.toFixed(2)).join(', ')}] · draws {stats.renderProbe.drawCalls ?? '?'} / calls {stats.renderProbe.renderCalls ?? '?'}</small>
        {INSPECTION_MODE && <small dir="ltr">body ref/src {stats.bodyProbe.referenceToSamplerMaxDeg?.toFixed(3) ?? '?'}° ({stats.bodyProbe.worstSamplerSegment}) · ref/web {stats.bodyProbe.referenceToTargetMaxDeg?.toFixed(3) ?? '?'}° ({stats.bodyProbe.worstTargetSegment})</small>}
      </div>
      {clean && <button className="mt-restore" onClick={() => setClean(false)}>نمایش کنترل‌ها · Esc</button>}
    </section>
    <aside className="mt-panel">
      <header><span className="mt-eyebrow">آزمایش محلی / انتقال حرکت</span><h1>حرکت آشنا،<br /><em>روی مدل وب</em></h1><p>مرجع نسخهٔ اول و مدل وب با حرکت منتقل‌شده در یک صحنه. صورت و لباس مدل وب برقرار است.</p></header>
      {stats.errors.length > 0 && <p className="mt-error" role="alert">{stats.errors.join(' / ')}</p>}
      <section><h2>بررسی هم‌زمان کلیپ‌ها</h2><div className="mt-grid">{CLIPS.map(clip => <button key={clip} disabled={!allReady} aria-pressed={mode === 'clip' && clock.clip === clip} onClick={() => selectClip(clip)}>{labels[clip]}</button>)}</div>
        <p className="mt-hint">دو آواتار از زمان یکسان در همان کلیپ نمونه‌برداری می‌شوند. حرکات نشستن و برخاستن در پایان مکث می‌کنند.</p>
        <div className="mt-playback"><button disabled={!allReady || mode !== 'clip'} onClick={() => setPaused(!clock.paused)}>{clock.paused ? 'پخش' : 'مکث'}</button><button disabled={!allReady || mode !== 'clip'} onClick={() => seek(0)}>ابتدای کلیپ</button><select aria-label="سرعت پخش" value={clock.speed} onChange={event => setSpeed(Number(event.target.value))}>{[0.25, 0.5, 1, 1.5, 2].map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></div>
        <label className="mt-range">زمان کلیپ <output dir="ltr">{clock.time.toFixed(2)} / {clock.duration.toFixed(2)} s</output><input aria-label="زمان کلیپ" type="range" min="0" max={clock.duration} step="0.005" disabled={!allReady || mode !== 'clip'} value={Math.min(clock.time, clock.duration)} onChange={event => seek(Number(event.target.value))} /></label>
      </section>
      <section><h2>کنترل عادی و پرش</h2><div className="mt-grid"><button disabled={!allReady} aria-pressed={mode === 'control'} onClick={normalControl}>کنترل عادی</button><button disabled={!allReady} onClick={jump}>پرش آواتار انتخاب‌شده</button><button disabled={!allReady} onClick={() => motion('walk')}>حرکت با راه‌رفتن</button><button disabled={!allReady} onClick={() => motion('run')}>حرکت با دویدن</button><button disabled={!allReady} onClick={() => motion('idle')}>توقف</button><button disabled={!allReady} onClick={reset}>بازگشت هر دو · R</button></div>
        <div className="mt-tabs"><button disabled={!allReady} aria-pressed={active === 'v1'} onClick={() => selectActor('v1')}>مرجع V1</button><button disabled={!allReady} aria-pressed={active === 'v2'} onClick={() => selectActor('v2')}>مدل وب</button></div>
        <p className="mt-hint">V تعویض کنترل · W A S D حرکت · Shift دویدن · Space پرش · F پرواز. پرش مدل وب از نسخهٔ دوم حفظ شده است.</p>
      </section>
      <section><h2>دوربین و نمایش</h2><div className="mt-grid">{([['both', 'نمای هر دو'], ['follow', 'دنبال‌کننده'], ['face', 'صورت'], ['legs', 'پا و زانو']] as const).map(([value, label]) => <button key={value} aria-pressed={view === value} onClick={() => cameraView(value)}>{label}</button>)}<button aria-pressed={lighting === 'scene'} onClick={() => setLighting(value => value === 'scene' ? 'unlit' : 'scene')}>{lighting === 'scene' ? 'نمایش بافت اصلی' : 'نور محیط'}</button><button onClick={() => setClean(true)}>نمای فیلم · H</button></div></section>
      <section><h2>صورت مدل وب</h2><div className="mt-grid">{(Object.entries(EMOTIONS) as [EmotionName, typeof EMOTIONS[EmotionName]][]).map(([name, item]) => <button key={name} disabled={!allReady} aria-pressed={emotion === name} onClick={() => setEmotion(name)}>{item.label}</button>)}</div><button className="mt-link" disabled={!allReady} onClick={() => web.current?.blink()}>یک پلک · B</button></section>
      <details><summary>وضعیت فنی</summary><p dir="ltr">{stats.renderer} · {stats.frames} frames · {stats.runtime}</p><pre id="motion-test-diagnostics">{JSON.stringify({ ...stats, web: stats.web ? { ...stats.web, weights: undefined } : null }, null, 2)}</pre></details>
      <footer><i className={allReady ? 'ready' : ''} />{allReady ? 'هر دو آواتار آماده‌اند' : 'در حال بارگذاری'}<span>آزمایش محلی</span></footer>
    </aside>
  </main>;
}

createRoot(document.getElementById('root')!).render(<MotionTestApp />);
