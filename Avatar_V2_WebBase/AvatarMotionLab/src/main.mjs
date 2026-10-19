import * as THREE from 'three';
import { createWorld } from './world.mjs';
import { loadActor } from './actor.mjs';
import { retargetMotions, MotionDirector } from './animation.mjs';
import { CharacterCamera } from './camera.mjs';
import { CharacterPhysics } from './physics.mjs';
import { ExpressionState, EMOTIONS, FACE_GROUPS } from './expressions.mjs';
import { InputController } from './input.mjs';
import { clamp } from './math.mjs';

const $ = id => document.getElementById(id);
const persian = x => String(x).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
let toastTimer;
function toast(text, duration = 3500) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), duration); }
function loading(text, fraction, detail = '') { $('loading-text').textContent = text; $('progress').style.width = `${fraction}%`; $('loading-detail').textContent = detail; }
function icon(name) {
  const mouth = { neutral: '<path d="M11 21h10"/>', smile: '<path d="M10 19q6 7 12 0"/>', laugh: '<path d="M10 19h12q-1 9-6 9t-6-9Z"/>', sad: '<path d="M11 23q5-5 10 0M9 10l4 2m6 0 4-2"/>', angry: '<path d="m8 11 6 3m4 0 6-3M11 23h10"/>', surprise: '<ellipse cx="16" cy="22" rx="3.2" ry="4.1"/><path d="M8 10q2-2 5 0m6 0q3-2 5 0"/>' };
  const eyes = name === 'laugh' ? '<path d="M8 14q3-3 5 0m6 0q3-3 5 0"/>' : '<path d="M11 14v1m10-1v1"/>';
  return `<svg class="face-icon" viewBox="0 0 32 34" aria-hidden="true"><ellipse cx="16" cy="17" rx="14" ry="15"/>${eyes}${mouth[name]}</svg>`;
}
function rangePaint(input) { const value = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)); input.style.setProperty('--value', `${value * 100}%`); }

export async function launch() {
  const canvas = $('scene'), viewport = $('viewport');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false }); }
  catch { throw new Error('WebGL 2 could not start. Enable hardware acceleration in Chrome/Edge, restart the browser, and update the graphics driver.'); }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(31, 1, 0.025, 150);
  const resize = () => { const w = viewport.clientWidth, h = viewport.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(viewport); resize();
  const world = createWorld(renderer, scene), physics = new CharacterPhysics(world.collision), emotions = new ExpressionState();
  loading('بارگذاری مدل سه‌بعدی و بافت‌های صورت…', 78);
  const actor = await loadActor(renderer, scene, (loaded, total) => loading('بارگذاری مدل سه‌بعدی و بافت‌های صورت…', 76 + 10 * (total ? loaded / total : 0.5), `${(loaded / 1048576).toFixed(1)} MB · local GLB`));
  const response = await fetch('./assets/motions.json'); if (!response.ok) throw new Error('The local motion pack is missing. Restart node start.mjs.');
  const pack = await response.json();
  const retargeted = await retargetMotions(actor, pack, name => loading('تطبیق انیمیشن با اسکلت کاراکتر…', 89, `${name.toUpperCase()} · world-space bone retargeting`));
  const director = new MotionDirector(actor, retargeted, world.collision), cameraRig = new CharacterCamera(camera, world.occluders);
  const skeleton = new THREE.SkeletonHelper(actor.model); skeleton.visible = false; scene.add(skeleton);
  $('shape-count').textContent = actor.face.shapes.size; $('bone-count').textContent = retargeted.matchedBones; $('vertex-count').textContent = actor.stats.vertices.toLocaleString('en-US');
  if (actor.face.missing.length) console.warn('Missing expression shapes:', actor.face.missing);
  let timeScale = 1;
  const emotionButtons = new Map();
  for (const [name, data] of Object.entries(EMOTIONS)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'emotion'; button.dataset.emotion = name;
    button.title = `${data.label} · ${data.key}`; button.setAttribute('aria-label', data.label); button.setAttribute('aria-pressed', name === emotions.name ? 'true' : 'false');
    button.innerHTML = `<span class="key">${data.key}</span>${icon(data.icon)}<span class="emotion-label">${data.label}</span>`;
    button.addEventListener('click', () => setEmotion(name)); $('emotions').append(button); emotionButtons.set(name, button);
  }
  const manualLabels = { jaw: 'بازشدن فک', smile: 'لبخند', frown: 'افتادگی لب', brows: 'بالارفتن ابروها', browDown: 'اخم ابروها', wide: 'بازشدن چشم‌ها' };
  for (const [key, label] of Object.entries(manualLabels)) {
    const block = document.createElement('div'); block.className = 'manual-range';
    block.innerHTML = `<div class="range-row"><label for="manual-${key}">${label}</label><output id="value-${key}">—</output></div><input id="manual-${key}" type="range" min="0" max="1" step="0.01" value="0">`;
    $('manual-face').append(block); const input = block.querySelector('input'); rangePaint(input);
    input.addEventListener('input', () => { emotions.setManual(key, Number(input.value)); $(`value-${key}`).textContent = Number(input.value).toFixed(2); rangePaint(input); });
  }
  function setEmotion(name) {
    emotions.setEmotion(name);
    for (const [n, button] of emotionButtons) { button.classList.toggle('active', n === name); button.setAttribute('aria-pressed', String(n === name)); }
    for (const key of Object.keys(FACE_GROUPS)) { $(`manual-${key}`).value = 0; rangePaint($(`manual-${key}`)); $(`value-${key}`).textContent = '—'; }
  }
  setEmotion('smile');
  function setMode(mode) {
    cameraRig.setMode(mode, physics);
    if (mode === 'portrait') physics.stop();
    for (const button of document.querySelectorAll('[data-camera]')) button.classList.toggle('active', button.dataset.camera === mode);
    const labels = { portrait: ['از نزدیک ببین.', 'جزئیات صورت، نگاه و حرکت؛ در زمان واقعی.', 'EXPRESSION STUDY'], follow: ['حرکت را حس کن.', 'حرکت با W A S D · دویدن با Shift · پرش با Space', 'LOCOMOTION STUDY'], orbit: ['از هر زاویه بررسی کن.', 'دوربین آزاد دور کاراکتر؛ چرخش با کشیدن ماوس.', 'FULL-BODY STUDY'] };
    $('view-title').textContent = labels[mode][0]; $('view-description').textContent = labels[mode][1]; document.querySelector('.scene-title .eyebrow').textContent = labels[mode][2];
  }
  const toggleHud = () => { const hidden = document.body.classList.toggle('hide-hud'); $('show-hud').hidden = !hidden; };
  function reset() {
    physics.reset(); director.reset(); emotions.setEmotion('smile'); setEmotion('smile'); actor.root.position.set(0, 0, 0); actor.root.rotation.set(0, 0, 0);
    cameraRig.setMode(cameraRig.mode, physics); toast('کاراکتر به نقطهٔ شروع برگشت.');
  }
  const input = new InputController(canvas, {
    jump: () => { if (cameraRig.mode === 'portrait') setMode('follow'); physics.jump(); },
    emotion: number => { const found = Object.entries(EMOTIONS).find(([, v]) => v.key === number); if (found) setEmotion(found[0]); },
    face: () => setMode('portrait'), follow: () => setMode('follow'),
    cycleCamera: () => { const modes = ['portrait', 'follow', 'orbit']; setMode(modes[(modes.indexOf(cameraRig.mode) + 1) % 3]); },
    reset, blink: () => emotions.blink(), hud: toggleHud,
    orbit: (dx, dy) => cameraRig.orbit(dx, dy), zoom: delta => cameraRig.zoom(delta)
  });
  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.camera)));
  $('intensity').addEventListener('input', e => { emotions.intensity = Number(e.target.value); $('intensity-value').textContent = persian(Math.round(emotions.intensity * 100)) + '٪'; rangePaint(e.target); });
  $('time-scale').addEventListener('input', e => { timeScale = Number(e.target.value); $('time-value').textContent = `${timeScale.toFixed(2)}×`; rangePaint(e.target); });
  $('normal-speed').addEventListener('click', () => { $('time-scale').value = 1; $('time-scale').dispatchEvent(new Event('input')); });
  $('auto-blink').addEventListener('change', e => { emotions.blinkEnabled = e.target.checked; });
  $('eye-contact').addEventListener('change', e => { emotions.gazeEnabled = e.target.checked; director.gazeEnabled = e.target.checked; });
  $('micro-motion').addEventListener('change', e => { emotions.microEnabled = e.target.checked; director.breathing = e.target.checked; });
  $('foot-ik').addEventListener('change', e => { director.ikEnabled = e.target.checked; });
  $('blink-once').addEventListener('click', () => emotions.blink());
  $('skeleton').addEventListener('change', e => { skeleton.visible = e.target.checked; });
  $('wireframe').addEventListener('change', e => actor.setWireframe(e.target.checked));
  $('lighting').addEventListener('change', e => world.lighting(e.target.value));
  $('quality').addEventListener('change', e => {
    const ratio = { low: 0.85, balanced: 1.4, high: 2 }[e.target.value]; renderer.setPixelRatio(Math.min(devicePixelRatio, ratio));
    world.sun.shadow.mapSize.setScalar(e.target.value === 'low' ? 1024 : 2048); if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; }
    resize(); toast('کیفیت رندر تغییر کرد.');
  });
  $('reset').addEventListener('click', reset); $('show-hud').addEventListener('click', toggleHud);
  $('capture').addEventListener('click', () => {
    renderer.render(scene, camera);
    canvas.toBlob(blob => {
      if (!blob) { toast('ذخیره تصویر در این مرورگر انجام نشد.'); return; }
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `avatar-${emotions.name}-${Date.now()}.png`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('تصویر همین نمای سه‌بعدی ذخیره شد.');
    }, 'image/png');
  });
  document.querySelectorAll('input[type=range]').forEach(rangePaint);
  // Separate render and simulation clocks. A low frame rate does not weaken gravity or change run speed.
  let last = performance.now(), accumulator = 0, telemetryAt = 0, fps = 60;
  const fixedStep = 1 / 120;
  function frame(now) {
    const rawDt = Math.max(0.0001, (now - last) / 1000); last = now;
    if (document.hidden) { accumulator = 0; return; }
    const dt = Math.min(0.05, rawDt) * timeScale;
    let movement = input.movement;
    if (cameraRig.mode === 'portrait' && (movement.x || movement.z)) setMode('follow');
    accumulator = Math.min(0.12, accumulator + dt);
    while (accumulator >= fixedStep) { physics.update(fixedStep, movement, cameraRig.yaw); accumulator -= fixedStep; }
    actor.root.position.set(physics.x, physics.y, physics.z); actor.root.rotation.y = physics.yaw;
    director.update(dt, physics, emotions.name, camera, cameraRig.mode === 'portrait');
    const eyes = actor.eyes().clone();
    cameraRig.update(Math.min(rawDt, 0.05), physics, eyes, movement);
    const relative = camera.position.clone().sub(eyes).applyQuaternion(actor.root.quaternion.clone().invert());
    const horizontal = Math.hypot(relative.x, relative.z), front = relative.z > 0;
    const gaze = { x: front ? clamp(Math.atan2(relative.x, relative.z) * 0.58, -0.45, 0.45) : 0, y: front ? clamp(Math.atan2(relative.y, horizontal) * 0.7, -0.35, 0.35) : 0 };
    actor.face.apply(emotions.update(dt, gaze)); world.update(physics); renderer.render(scene, camera);
    fps = fps * 0.93 + (1 / rawDt) * 0.07;
    if (now - telemetryAt > 220) {
      telemetryAt = now; $('fps').textContent = Math.round(fps); $('speed').textContent = physics.speed.toFixed(2); $('motion-state').textContent = physics.state.toUpperCase();
      $('ground-state').textContent = physics.grounded ? 'روی زمین' : physics.vy > 0 ? 'در حال پرش' : 'در حال فرود';
      const ground = world.collision.groundAt(physics.x, physics.z, physics.y + 0.015);
      $('jump-height').textContent = persian(Math.max(0, physics.y - ground).toFixed(2)) + ' متر';
    }
  }
  loading('آماده‌سازی نورپردازی و رندر…', 96, `${actor.stats.vertices.toLocaleString('en-US')} vertices · ${actor.face.shapes.size} face shapes`);
  director.update(1 / 60, physics, emotions.name, camera, true);
  cameraRig.update(1 / 60, physics, actor.eyes().clone(), { x: 0, z: 0 });
  actor.face.apply(emotions.update(1 / 60));
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  last = performance.now(); renderer.setAnimationLoop(frame);
  $('progress').style.width = '100%'; $('loading').classList.add('done'); setTimeout(() => { $('loading').hidden = true; $('loading').style.display = 'none'; }, 650);
  if (actor.face.missing.length) toast('بعضی کنترل‌های چهره در مدل موجود نیستند: ' + actor.face.missing.join(', '), 18000);
  else toast('برای دیدن صورت کلید F؛ برای حرکت W A S D. احساس‌ها با کلیدهای ۰ تا ۵.', 6500);
  // Inspection API for reproducible manual QA. No telemetry is transmitted anywhere.
  window.__avatarLab = { actor, physics, director, cameraRig, emotions, world, renderer, scene, camera, setMode, setEmotion, reset,
    snapshot: () => ({ state: physics.state, position: [physics.x, physics.y, physics.z], speed: physics.speed, grounded: physics.grounded, jumps: physics.jumpCount, camera: cameraRig.mode,
      emotion: emotions.name, morphCount: actor.face.shapes.size, missingShapes: actor.face.missing, matchedBones: retargeted.matchedBones, weights: { ...emotions.weights }, stats: { ...actor.stats } }) };
}
