import React, { Component, Suspense, memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, Quaternion, Vector3 } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { PlayerRig, createFlatNavigationSurface, computeCameraTransform,
  type AvatarLocomotion } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { AvatarWebV2, AVATAR03_CLIPS, EMOTIONS,
  type Avatar03Handle, type Avatar03Clip, type Avatar03Lighting, type AvatarWebV2Handle,
  type Avatar03Ready, type AvatarV2Status, type EmotionName } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import legacyModelUrl from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03/model?url';
import { createComparisonSession, MOVEMENT_PROFILES, type AvatarId, type ComparisonSession } from './comparison.mjs';
import { LabStage } from './LabStage';
import { LegacyComparisonAvatar } from './LegacyComparisonAvatar';
import type { LegacyMaterialAudit } from './legacy-preview.mjs';
import './comparison.css';

const navigation = createFlatNavigationSurface(0, { minX: -25, maxX: 25, minZ: -25, maxZ: 25 });
const modelUrl = new URL('./avatar-v2/avatar.gltf', document.baseURI).href;
const motionsUrl = new URL('./avatar-v2/motions.json', document.baseURI).href;
const names = { v1: 'آواتار قبلی · نسخهٔ ۱', v2: 'آواتار جدید · نسخهٔ ۲' };
const motions: Record<string, string> = { idle: 'ایستاده', walk: 'راه‌رفتن', run: 'دویدن', jump: 'پرش', fall: 'فرود', land: 'روی زمین', fly: 'پرواز' };
const clips: Record<Avatar03Clip, string> = { Stand: 'ایستادن', Walk: 'راه‌رفتن', Run: 'دویدن', Fly: 'پرواز', Jump: 'پرش', HandRaise: 'بالابردن دست', StandToSit: 'نشستن', Sitting: 'نشسته', SittoStand: 'برخاستن' };
type View = 'both' | 'follow' | 'face' | 'legs';
type Refs = { old: React.RefObject<Avatar03Handle | null>; web: React.RefObject<AvatarWebV2Handle | null> };
const diagnostics = { ready: { v1: false, v2: false }, active: 'v2' as AvatarId, renderer: 'در حال آماده‌سازی', runtime: 'waiting', frames: 0,
  positions: { v1: [-1.25, 0, 0] as readonly number[], v2: [1.25, 0, 0] as readonly number[] },
  speeds: { v1: 0, v2: 0 }, old: null as ReturnType<Avatar03Handle['getStatus']>, web: null as AvatarV2Status | null,
  legacyMaterials: null as LegacyMaterialAudit | null, errors: [] as string[] };
Object.defineProperty(window, 'avatarComparisonDiagnostics', { get: () => ({ ...diagnostics, errors: [...diagnostics.errors] }) });
function reportError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (!diagnostics.errors.includes(message)) diagnostics.errors.push(message);
}
function recordLegacyAudit(audit: LegacyMaterialAudit) { diagnostics.legacyMaterials = audit; }
class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: Error) { return { message: error.message }; }
  componentDidCatch(error: Error) { reportError(error); void window.alamr?.runtime.fail({ code: 'avatar_comparison_failed' }); }
  render() { return this.state.message ? <div className="error" role="alert"><h2>بارگذاری محیط انجام نشد</h2><p>{this.state.message}</p><button onClick={() => location.reload()}>تلاش دوباره</button></div> : this.props.children; }
}
const renderers = new WeakMap<HTMLCanvasElement, Promise<WebGPURenderer>>();
function createRenderer({ canvas }: { canvas: unknown }) {
  const surface = canvas as HTMLCanvasElement;
  let pending = renderers.get(surface);
  if (!pending) {
    pending = (async () => {
      const renderer = new WebGPURenderer({ canvas: surface, antialias: true }); await renderer.init();
      const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean };
      diagnostics.renderer = backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 fallback'; return renderer;
    })();
    renderers.set(surface, pending);
  }
  return pending;
}

// Both adapters stay mounted. Convert each stored world pose to the one active
// rig's local space, so switching never reloads a skeleton or moves its partner.
function WorldPoseFrame({ group, session, id }: { group: React.RefObject<Group | null>; session: ComparisonSession; id: AvatarId }) {
  const point = useRef(new Vector3()); const rotation = useRef(new Quaternion()); const parentRotation = useRef(new Quaternion());
  useFrame(() => {
    const node = group.current; const parent = node?.parent; if (!node || !parent) return;
    const pose = session.controllers[id].getPoseSnapshot();
    parent.updateWorldMatrix(true, false);
    point.current.set(...pose.position); parent.worldToLocal(point.current); node.position.copy(point.current);
    if (pose.orientation) rotation.current.set(...pose.orientation);
    else rotation.current.setFromAxisAngle(new Vector3(0, 1, 0), pose.yaw);
    parent.getWorldQuaternion(parentRotation.current).invert(); node.quaternion.copy(parentRotation.current).multiply(rotation.current);
    node.updateWorldMatrix(false, true);
  }); return null;
}
function WorldActor({ session, id, active, children }: { session: ComparisonSession; id: AvatarId; active: AvatarId; children: ReactNode }) {
  const group = useRef<Group>(null); const [subscribed, setSubscribed] = useState(false);
  // Register after PlayerRig's layout subscriber, before async V2 runtime frames.
  useEffect(() => setSubscribed(true), []);
  return <group ref={group}>
    {subscribed && <WorldPoseFrame group={group} session={session} id={id} />}
    {children}
    <mesh rotation-x={-Math.PI / 2} position-y={0.003}><ringGeometry args={[0.48, active === id ? 0.515 : 0.495, 48]} /><meshBasicMaterial color={id === 'v1' ? '#577e96' : '#a77b3a'} /></mesh>
    <Html center position={[0, 2.02, 0]} style={{ pointerEvents: 'none' }}><div className={`actor-label ${id} ${active === id ? 'selected' : ''}`}>{names[id]}{active === id && <small>کنترل فعال</small>}</div></Html>
  </group>;
}
function SceneFrame({ session, refs, view }: { session: ComparisonSession; refs: Refs; view: View }) {
  const signalled = useRef(false);
  useFrame(({ camera, size }) => {
    diagnostics.frames++; diagnostics.active = session.active;
    for (const id of ['v1', 'v2'] as const) {
      const pose = session.controllers[id].getPoseSnapshot(); diagnostics.positions[id] = pose.position;
      diagnostics.speeds[id] = Math.hypot(pose.velocity[0], pose.velocity[2]);
    }
    diagnostics.old = refs.old.current?.getStatus() ?? null; diagnostics.web = refs.web.current?.getStatus() ?? null;
    if (view === 'both') {
      const a = diagnostics.positions.v1, b = diagnostics.positions.v2;
      const pose = session.controller.getPoseSnapshot(), state = session.controller.getCameraSnapshot();
      const span = Math.hypot(a[0] - b[0], a[2] - b[2]) + 1.25;
      const aspect = Math.max(0.2, size.width / Math.max(size.height, 1));
      const distance = Math.max(state.distance, span / (2 * Math.tan(21 * Math.PI / 180) * aspect) * 1.18, 4);
      const transform = computeCameraTransform({ ...state, distance, mode: 'third-person', firstPersonBlend: 0 },
        { ...pose, position: [(a[0] + b[0]) / 2, Math.max(a[1], b[1]), (a[2] + b[2]) / 2] }, { targetHeight: 0.95 });
      camera.position.set(...transform.position); camera.lookAt(...transform.target);
    }
    if (diagnostics.ready.v1 && diagnostics.ready.v2 && diagnostics.frames > 3 && !signalled.current) {
      signalled.current = true;
      void (async () => {
        if (!window.alamr) { diagnostics.runtime = 'browser-local'; return; }
        const painting = await window.alamr.runtime.painting(); if (!painting.ok) reportError(painting.error.code);
        const ready = await window.alamr.runtime.ready(); diagnostics.runtime = ready.ok ? 'ready' : ready.error.code;
        if (!ready.ok) reportError(ready.error.code);
      })();
    }
  }); return null;
}
function LateSceneFrame(props: Parameters<typeof SceneFrame>[0]) {
  const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);
  return mounted ? <SceneFrame {...props} /> : null;
}
const Scene = memo(function Scene({ session, refs, active, view, lighting, onOldReady, onWebReady }: {
  session: ComparisonSession; refs: Refs; active: AvatarId; view: View; lighting: Avatar03Lighting;
  onOldReady: (info: Avatar03Ready) => void; onWebReady: (info: AvatarV2Status) => void;
}) {
  const onMotion = useCallback((value: AvatarLocomotion) => {
    if (active === 'v1') refs.old.current?.setLocomotion(value); else refs.web.current?.setLocomotion(value);
  }, [active, refs]);
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 1.5, 5.8], fov: 42, near: 0.03, far: 160 }} gl={createRenderer}>
    <LabStage /><Suspense fallback={null}>
      <PlayerRig controller={session.controllers[active]} navigation={navigation} movement={MOVEMENT_PROFILES[active]}
        camera={{ initialDistance: 5.8, minDistance: 0.55, maxDistance: 55, targetHeight: view === 'face' ? 1.60 : view === 'legs' ? 0.60 : 0.95 }}
        onAnimationFrame={onMotion} avatar={<>
          <LateSceneFrame session={session} refs={refs} view={view} />
          <WorldActor session={session} id="v1" active={active}><LegacyComparisonAvatar ref={refs.old} modelUrl={legacyModelUrl} lighting={lighting} onReady={onOldReady} onAudit={recordLegacyAudit} /></WorldActor>
          <WorldActor session={session} id="v2" active={active}><AvatarWebV2 ref={refs.web} controller={session.controllers.v2} navigation={navigation}
            modelUrl={modelUrl} motionsUrl={motionsUrl} lighting={lighting} portrait={view === 'face' && active === 'v2'} onReady={onWebReady} onError={reportError} /></WorldActor>
        </>} />
    </Suspense>
  </Canvas>;
});

export function CompareApp() {
  const [session] = useState(createComparisonSession);
  const old = useRef<Avatar03Handle | null>(null), web = useRef<AvatarWebV2Handle | null>(null);
  const [refs] = useState<Refs>(() => ({ old, web }));
  const [active, setActive] = useState<AvatarId>('v2'), [view, setView] = useState<View>('both');
  const [lighting, setLighting] = useState<Avatar03Lighting>('scene'), [clean, setClean] = useState(false);
  const [ready, setReady] = useState({ v1: false, v2: false }), [stats, setStats] = useState({ ...diagnostics });
  const [emotion, setEmotion] = useState<EmotionName>('smile');
  const onOldReady = useCallback((_info: Avatar03Ready) => { diagnostics.ready.v1 = true; setReady(value => ({ ...value, v1: true })); }, []);
  const onWebReady = useCallback((_info: AvatarV2Status) => { diagnostics.ready.v2 = true; setReady(value => ({ ...value, v2: true })); }, []);
  useEffect(() => {
    const timer = setInterval(() => setStats({ ...diagnostics, positions: { ...diagnostics.positions }, speeds: { ...diagnostics.speeds }, errors: [...diagnostics.errors] }), 150);
    const onError = (event: ErrorEvent) => reportError(event.message), onRejection = (event: PromiseRejectionEvent) => reportError(event.reason);
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection);
    return () => { clearInterval(timer); session.releaseInput(); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, [session]);
  const cameraView = useCallback((next: View) => {
    const controller = session.controller, yaw = controller.getPoseSnapshot().yaw;
    controller.setCamera({ ...controller.getCameraSnapshot(), yaw: next === 'follow' ? yaw : yaw + (next === 'legs' ? Math.PI * 0.65 : Math.PI),
      pitch: next === 'face' ? 0 : 0.06, distance: next === 'face' ? 1 : next === 'legs' ? 2.8 : next === 'both' ? 5.8 : 4.3, mode: 'third-person', firstPersonBlend: 0 });
    setView(next);
  }, [session]);
  const select = useCallback((id: AvatarId) => {
    if (id === session.active) return;
    session.select(id); old.current?.previewClip(null); old.current?.setLocomotion({ state: 'idle', horizontalSpeed: 0 });
    web.current?.reset(); setActive(id); cameraView(view);
  }, [session, view, cameraView]);
  const reset = useCallback(() => {
    session.reset(); old.current?.previewClip(null); old.current?.setLocomotion({ state: 'idle' }); web.current?.reset(); cameraView('both');
  }, [session, cameraView]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)))) return;
      if (event.code === 'KeyV') select(session.active === 'v1' ? 'v2' : 'v1');
      if (event.code === 'KeyR') reset(); if (event.code === 'KeyH') setClean(value => !value); if (event.code === 'Escape') setClean(false);
      if (event.code === 'KeyB' && session.active === 'v2') web.current?.blink();
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [select, reset, session]);
  function demo(mode: 'walk' | 'run') {
    old.current?.previewClip(null); session.releaseInput(); cameraView('follow');
    session.controller.setAction('forward', true); session.controller.setAction('sprint', mode === 'run');
  }
  function jump() { const controller = session.controller; controller.setAction('jump', true); setTimeout(() => controller.setAction('jump', false), 100); }
  const allReady = ready.v1 && ready.v2, profile = MOVEMENT_PROFILES[active];
  return <main className={`comparison-lab ${clean ? 'clean-view' : ''}`}>
    <section className="viewport" aria-label="محیط مشترک مقایسه دو آواتار"><ErrorBoundary><Scene session={session} refs={refs} active={active} view={view} lighting={lighting} onOldReady={onOldReady} onWebReady={onWebReady} /></ErrorBoundary>
      {!allReady && <div className="loading" role="status"><span className="spinner" />در حال آماده‌سازی هر دو آواتار…</div>}
      <div className="scene-mark"><span>AL-AMR</span><b>AVATAR / V1 + V2</b></div>
      <div className="scene-status"><i className={allReady ? 'live' : ''} />کنترل: {active === 'v1' ? 'نسخهٔ قبلی' : 'نسخهٔ جدید'}<small>{stats.speeds[active].toFixed(2)} m/s</small></div>
      {clean && <button className="restore-panel" onClick={() => setClean(false)}>نمایش کنترل‌ها · Esc</button>}
    </section>
    <aside className="panel">
      <header><span className="eyebrow">الامر / همان محیط تست</span><h1>دو آواتار، <em>یک محیط</em></h1><p>نسخهٔ قبلی و نسخهٔ وب اصلاح‌شده، با زمین و دوربین مشترک.</p></header>
      <section className="avatar-selection"><h2>آواتار تحت کنترل</h2><div className="version-tabs">
        <button aria-pressed={active === 'v1'} disabled={!allReady} onClick={() => select('v1')}>قبلی · V1</button><button aria-pressed={active === 'v2'} disabled={!allReady} onClick={() => select('v2')}>جدید · V2</button>
      </div><button className="swap-avatar" disabled={!allReady} onClick={() => select(active === 'v1' ? 'v2' : 'v1')}>تعویض آواتار · V</button>
        <p className="hint">هر دو مدل در صحنه می‌مانند؛ ورودی و دوربین به آواتار انتخاب‌شده منتقل می‌شود.</p></section>
      {stats.errors.length > 0 && <p className="runtime-error" role="alert">{stats.errors.join(' / ')}</p>}
      <section><h2>دوربین</h2><div className="clip-grid">
        {([['both', 'نمای هر دو'], ['follow', 'دنبال‌کننده'], ['face', 'صورت'], ['legs', 'پا و زانو']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => cameraView(id)}>{label}</button>)}
      </div></section>
      <section><h2>حرکت آواتار انتخاب‌شده</h2><div className="clip-grid">
        <button disabled={!allReady} onClick={() => demo('walk')}>راه‌رفتن</button><button disabled={!allReady} onClick={() => demo('run')}>دویدن</button>
        <button disabled={!allReady} onClick={() => { session.releaseInput(); old.current?.previewClip(null); }}>توقف</button><button disabled={!allReady} onClick={jump}>پرش</button>
        <button disabled={!allReady} onClick={reset}>بازگشت هر دو</button>
      </div><p className="hint">W A S D حرکت · Shift دویدن · Space پرش · F پرواز<br />راست‌کلیک و حرکت ماوس: دوربین · غلتک: فاصله<br />سرعت این نسخه: {profile.walkSpeed} / {profile.sprintSpeed} متر بر ثانیه</p></section>
      {active === 'v1' ? <section><h2>انیمیشن‌های اصلی نسخهٔ قبلی</h2><div className="clip-grid">{AVATAR03_CLIPS.map(clip => <button key={clip} disabled={!allReady} aria-pressed={stats.old?.mode === 'preview' && stats.old.clip === clip} onClick={() => { session.releaseInput(); old.current?.previewClip(clip); }}>{clips[clip]}</button>)}</div><p className="hint">برای برگشت به کنترل عادی، «توقف» را بزن.</p></section>
        : <section><h2>چهرهٔ نسخهٔ جدید</h2><div className="clip-grid">{(Object.entries(EMOTIONS) as [EmotionName, typeof EMOTIONS[EmotionName]][]).map(([id, item]) => <button key={id} disabled={!allReady} aria-pressed={emotion === id} onClick={() => { setEmotion(id); web.current?.setEmotion(id); }}>{item.label}</button>)}</div><button className="text-button" disabled={!allReady} onClick={() => web.current?.blink()}>یک پلک · B</button></section>}
      <section><h2>نمایش</h2><div className="clip-grid"><button aria-pressed={lighting === 'scene'} onClick={() => setLighting('scene')}>نور محیط</button><button aria-pressed={lighting === 'unlit'} onClick={() => setLighting('unlit')}>بافت اصلی</button><button onClick={() => setClean(true)}>نمای فیلم · H</button></div></section>
      <div className="comparison-summary" aria-label="وضعیت هر دو آواتار"><p><b>V1</b>{ready.v1 ? 'آماده' : 'بارگذاری'} · {clips[stats.old?.clip ?? 'Stand']} · {stats.speeds.v1.toFixed(2)} m/s</p><p><b>V2</b>{ready.v2 ? 'آماده' : 'بارگذاری'} · {motions[stats.web?.state ?? 'idle']} · {stats.speeds.v2.toFixed(2)} m/s</p></div>
      <details className="diagnostics"><summary>وضعیت فنی</summary><p dir="ltr">{stats.renderer} · {stats.runtime} · {stats.frames} frames</p><pre id="comparison-diagnostics">{JSON.stringify({ ...stats, web: stats.web ? { ...stats.web, weights: undefined } : null })}</pre></details>
      <footer><span className="status-dot" />{allReady ? 'هر دو آواتار آماده‌اند' : 'در حال بارگذاری'}<span>آزمایش محلی</span></footer>
    </aside>
  </main>;
}
