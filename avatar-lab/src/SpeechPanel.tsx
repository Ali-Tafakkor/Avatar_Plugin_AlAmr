import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AvatarHybridHandle } from './HybridComparisonAvatar';
import { createMicrophoneSpeechController, LaughterDetector,
  type MicrophoneSpeechController, type MicrophoneSpeechStatus, type MicrophoneSpeechFrame,
  type LaughterStatus } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03/speech';
import './speech-panel.css';

const localUrl = (path: string) => new URL('./speech/' + path, document.baseURI).href;
const insideAlamr = location.protocol === 'alamr-env:' || location.protocol === 'alamr-app:';
const initialStatus: MicrophoneSpeechStatus = { phase: 'idle', modelPhase: 'idle', modelProgress: 0,
  level: 0, speaking: false, frames: 0, inferenceMs: 0, latencyMs: 0, warmupMs: 0,
  droppedChunks: 0, deviceId: '', error: null };

function friendlyError(message: string) {
  if (/denied|not.?allowed|permission|not permitted/i.test(message)) return insideAlamr
    ? 'الامر اجازهٔ میکروفن را نداد. در پنل «میکروفون» پایین پنجرهٔ الامر، «اجازه بده» را انتخاب کنید. این مجوز مربوط به خودِ الامر است.'
    : 'دسترسی میکروفن داده نشد. در پیام اجازهٔ مرورگر، دسترسی میکروفن را تأیید کنید؛ اگر قبلاً مسدود کرده‌اید، مجوز همین سایت را بررسی کنید.';
  if (/notfound|device.*not found|no.*microphone/i.test(message)) return 'میکروفن پیدا نشد. اتصال و ورودی انتخاب‌شده را بررسی کنید.';
  if (/notreadable|could not start audio|device.*busy/i.test(message)) return 'میکروفن در دسترس نیست. استفادهٔ برنامه‌های دیگر از آن را بررسی کنید.';
  if (/secure_origin|secure.*context/i.test(message)) return 'این صفحه را از راه‌انداز محلی پروژه باز کنید تا میکروفن در دسترس باشد.';
  if (/fetch|download|404|network|load.*model|asset/i.test(message)) return 'فایل‌های آماده‌سازی در دسترس نیستند. برنامه را با راه‌انداز پروژه دوباره باز کنید.';
  return 'راه‌اندازی گفتار انجام نشد. می‌توانید دوباره امتحان کنید؛ جزئیات در وضعیت فنی ثبت شده است.';
}

function statusLabel(status: MicrophoneSpeechStatus) {
  if (status.phase === 'listening') return status.speaking ? 'صدای شما دریافت می‌شود' : 'میکروفن روشن است؛ صحبت کنید';
  if (status.phase === 'requesting') return insideAlamr
    ? 'در پنل پایین پنجرهٔ الامر، «اجازه بده» را بزنید'
    : 'در پیام مرورگر، اجازهٔ میکروفن را تأیید کنید';
  if (status.phase === 'loading') {
    if (status.modelPhase === 'download') return `آماده‌سازی گفتار… ${Math.round(status.modelProgress * 100).toLocaleString('fa-IR')}٪`;
    return 'آماده‌سازی نهایی گفتار…';
  }
  if (status.phase === 'ready') return 'آمادهٔ شروع میکروفن';
  if (status.phase === 'error') return 'گفتار فعال نشد';
  return 'میکروفن خاموش است';
}

export function SpeechPanel({ avatar, ready, onInspect }: {
  avatar: RefObject<AvatarHybridHandle | null>; ready: boolean; onInspect: () => void;
}) {
  const [status, setStatus] = useState<MicrophoneSpeechStatus>(initialStatus);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [gain, setGain] = useState(1);
  const [noiseGate, setNoiseGate] = useState(0.003);
  const [automaticLaughter, setAutomaticLaughter] = useState(true);
  const [laughterStatus, setLaughterStatus] = useState<LaughterStatus>({ state: 'idle' });
  const [laughterScore, setLaughterScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<MicrophoneSpeechController | null>(null);
  const detector = useRef<LaughterDetector | null>(null);
  const statusRef = useRef(initialStatus);
  const laughterStatusRef = useRef<LaughterStatus>({ state: 'idle' });
  const latestFrame = useRef<MicrophoneSpeechFrame | null>(null);
  const laughterScoreRef = useRef(0);
  const automaticRef = useRef(true);
  const operation = useRef(0);
  const alive = useRef(false);
  const startLaughterRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    alive.current = true;
    let mounted = true;
    const ownController = createMicrophoneSpeechController({
      modelBaseUrl: localUrl('wav2arkit/'), wasmBaseUrl: localUrl('onnx/'),
      modelFile: 'wav2arkit_cpu.onnx', dataFile: null,
      modelParts: [1, 2, 3].map((part, index) => ({
        file: `wav2arkit_cpu.onnx.part${part}`, bytes: index < 2 ? 50331648 : 46211912,
      })),
      workerUrl: localUrl('workers/inference-worker.js'), captureWorkletUrl: localUrl('workers/capture-worklet.js'),
      onFrame(frame) {
        if (!mounted) return;
        latestFrame.current = { ...frame, weights: { ...frame.weights } };
        avatar.current?.setSpeechFrame(frame.weights, { speaking: frame.speaking });
      },
      onStatus(next) {
        if (!mounted) return;
        statusRef.current = next; setStatus(next);
        if (next.phase !== 'listening') avatar.current?.clearSpeech();
      },
      onAudioChunk(samples, rate, timestamp) {
        if (mounted && automaticRef.current) detector.current?.pushAudio(samples, rate, timestamp);
      },
    });
    controller.current = ownController;
    void ownController.listDevices().then(items => { if (mounted) setDevices(items); }).catch(() => {});
    const stop = () => {
      operation.current++;
      ownController.stop();
      const ownDetector = detector.current; detector.current = null; ownDetector?.dispose();
      avatar.current?.clearSpeech(); laughterScoreRef.current = 0;
      laughterStatusRef.current = { state: 'stopped' };
      if (mounted) { setBusy(false); setLaughterScore(0); setLaughterStatus({ state: 'stopped' }); }
    };
    stopRef.current = stop;
    startLaughterRef.current = () => {
      if (!mounted || !automaticRef.current || detector.current) return;
      const ownDetector = new LaughterDetector({
        modelUrl: localUrl('yamnet/yamnet.onnx'), wasmBaseUrl: localUrl('onnx/'),
        workerUrl: localUrl('workers/laughter.worker.js'),
        onScore(result) {
          if (!mounted || detector.current !== ownDetector || !automaticRef.current) return;
          const score = statusRef.current.phase === 'listening' ? result.score : 0;
          laughterScoreRef.current = score; setLaughterScore(score); avatar.current?.setLaughter(score, { at: result.at });
        },
        onStatus(next) {
          if (!mounted || detector.current !== ownDetector) return;
          laughterStatusRef.current = next; setLaughterStatus(next);
        },
      });
      detector.current = ownDetector;
      void ownDetector.start().catch(() => {
        // Speech keeps working when the optional laughter model cannot start.
        if (mounted && detector.current === ownDetector) avatar.current?.setLaughter(0);
      });
    };
    const hidden = () => { if (document.hidden) stop(); };
    const close = () => stop();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', close);
    Object.defineProperty(window, 'avatarSpeechDiagnostics', { configurable: true, get: () => Object.freeze({
      microphone: { ...statusRef.current }, laughter: { ...laughterStatusRef.current, score: laughterScoreRef.current },
      automaticLaughter: automaticRef.current,
      latestFrame: latestFrame.current ? { ...latestFrame.current, weights: { ...latestFrame.current.weights } } : null,
      localAudioOnly: true,
    }) });
    return () => {
      mounted = false; alive.current = false; operation.current++;
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', close);
      const ownDetector = detector.current; detector.current = null; ownDetector?.dispose();
      ownController.dispose(); if (controller.current === ownController) controller.current = null;
      avatar.current?.clearSpeech();
      delete (window as Window & { avatarSpeechDiagnostics?: unknown }).avatarSpeechDiagnostics;
    };
  }, [avatar]);

  useEffect(() => { if (ready) avatar.current?.setSpeechOptions({ gain, laughterEnabled: automaticLaughter }); }, [avatar, ready, gain, automaticLaughter]);

  async function start() {
    const ownController = controller.current;
    if (!ownController || busy || !ready) return;
    const token = ++operation.current;
    setError(null); setBusy(true); onInspect();
    try {
      await ownController.start({ deviceId: deviceId || undefined });
      if (token === operation.current && alive.current) {
        if (automaticRef.current && ownController.getStatus().phase === 'listening') startLaughterRef.current();
        const items = await ownController.listDevices().catch(() => null);
        if (items && token === operation.current && alive.current) setDevices(items);
      }
    } catch (reason) {
      if (token === operation.current && alive.current) {
        setError(friendlyError(reason instanceof Error ? reason.message : String(reason)));
        const ownDetector = detector.current; detector.current = null; ownDetector?.dispose();
      }
    } finally { if (token === operation.current && alive.current) setBusy(false); }
  }

  async function prepare() {
    const ownController = controller.current; if (!ownController || busy) return;
    const token = ++operation.current; setError(null); setBusy(true);
    try { await ownController.prepare(); }
    catch (reason) { if (token === operation.current && alive.current) setError(friendlyError(reason instanceof Error ? reason.message : String(reason))); }
    finally { if (token === operation.current && alive.current) setBusy(false); }
  }

  const listening = status.phase === 'listening';
  return <section className="speech-panel" aria-label="گفتار با میکروفن">
    <div className="speech-heading"><h2>گفتار با میکروفن</h2><span className={listening ? 'speech-live' : ''}>{listening ? 'روشن' : 'خاموش'}</span></div>
    <p className="speech-intro">با صدای خودتان، لب و فک آواتار ترکیبی را حرکت دهید.</p>
    <p className="speech-permission-help">{insideAlamr
      ? 'پس از شروع، پنل «میکروفون» پایین پنجرهٔ الامر باز می‌شود؛ «اجازه بده» را بزنید. نیازی به تنظیمات مرورگر نیست.'
      : 'پس از شروع، در پیام همین مرورگر اجازهٔ میکروفن را بدهید.'}</p>
    <div className="speech-actions">
      <button className="speech-start" disabled={!ready || busy || listening} onClick={() => void start()}>شروع میکروفن</button>
      <button disabled={!busy && !listening} onClick={() => stopRef.current()}>قطع میکروفن</button>
    </div>
    <div className="speech-state" role="status" aria-live="polite"><i className={listening ? 'active' : ''} />{statusLabel(status)}</div>
    <meter aria-label="سطح صدای میکروفن" min="0" max="1" value={status.level} />
    {(error || status.phase === 'error') && <p className="speech-error" role="alert">{error ?? friendlyError(status.error ?? '')}</p>}
    <label className="speech-check"><input type="checkbox" checked={automaticLaughter} onChange={event => {
      const enabled = event.target.checked; automaticRef.current = enabled; setAutomaticLaughter(enabled);
      avatar.current?.setSpeechOptions({ laughterEnabled: enabled });
      if (!enabled) {
        const ownDetector = detector.current; detector.current = null; ownDetector?.dispose();
        avatar.current?.setLaughter(0); laughterScoreRef.current = 0; setLaughterScore(0); setLaughterStatus({ state: 'stopped' });
        laughterStatusRef.current = { state: 'stopped' };
      } else if (listening) startLaughterRef.current();
    }} />خندهٔ خودکار <small>آزمایشی</small></label>
    {automaticLaughter && <p className="speech-laughter" role="status">{laughterStatus.state === 'loading' ? 'آماده‌سازی واکنش به خنده…'
      : laughterStatus.state === 'error' ? 'واکنش خودکار به خنده فعال نشد؛ حرکت گفتار همچنان قابل استفاده است.'
      : laughterScore > 0.15 ? 'خنده شنیده شد'
      : listening && laughterStatus.state === 'ready' ? 'واکنش به خنده آماده است' : 'با شروع میکروفن فعال می‌شود'}</p>}
    <label className="range-label">شدت حرکت لب <output>{gain.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</output>
      <input aria-label="شدت حرکت لب" type="range" min="0.3" max="2" step="0.1" value={gain} onChange={event => setGain(Number(event.target.value))} /></label>
    <div className="speech-secondary"><button className="text-button" disabled={!ready} onClick={onInspect}>نمای نزدیک صورت</button>
      <button className="text-button" disabled={busy || listening || status.modelPhase === 'ready'} onClick={() => void prepare()}>آماده‌سازی پیش از شروع</button></div>
    <details className="speech-settings"><summary>تنظیم میکروفن</summary>
      <label>ورودی صدا<select aria-label="ورودی میکروفن" value={deviceId} disabled={busy || listening} onChange={event => setDeviceId(event.target.value)}>
        <option value="">میکروفن پیش‌فرض</option>{devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `میکروفن ${(index + 1).toLocaleString('fa-IR')}`}</option>)}
      </select></label>
      <button className="text-button" onClick={() => void controller.current?.listDevices().then(setDevices).catch(() => {})}>بازخوانی ورودی‌ها</button>
      <label className="range-label">حذف صدای زمینه<input aria-label="حذف صدای زمینه" type="range" min="0.001" max="0.025" step="0.001" value={noiseGate} onChange={event => {
        const value = Number(event.target.value); setNoiseGate(value); controller.current?.setNoiseGate(value);
      }} /></label><p className="hint">اگر دهان با سکوت حرکت می‌کند، این مقدار را بیشتر کنید. اگر صدای آرام را نمی‌گیرد، کمتر کنید.</p>
    </details>
    <p className="hint">یک جمله بگویید، مکث کنید و بخندید. صدا در همین دستگاه پردازش می‌شود و ضبط یا ارسال نمی‌شود. با پنهان‌شدن صفحه، میکروفن قطع می‌شود.</p>
  </section>;
}
