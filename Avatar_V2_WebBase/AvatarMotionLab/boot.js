const $ = id => document.getElementById(id);
let imported = false;
function fail(error) {
  $('loading').classList.add('error'); $('loading-title').textContent = 'راه‌اندازی کامل نشد';
  $('loading-text').textContent = 'پنجرهٔ راه‌انداز را بررسی کن؛ پس از رفع خطا آن را ببند و START-WINDOWS.cmd را دوباره اجرا کن. فایل‌های سالمِ دریافت‌شده نگه داشته می‌شوند.';
  $('loading-detail').textContent = error.message || String(error); $('retry').hidden = false;
}
$('retry').addEventListener('click', () => location.reload());
window.addEventListener('error', e => { if (!$('loading').classList.contains('done')) fail(e.error || e.message); });
window.addEventListener('unhandledrejection', e => { if (!$('loading').classList.contains('done')) fail(e.reason); });
async function start() {
  if (imported) return; imported = true;
  $('loading-title').textContent = 'بارگذاری کاراکتر'; $('loading-text').textContent = 'مدل و بافت‌ها از روی همین دستگاه خوانده می‌شوند.';
  $('progress').style.width = '75%';
  try { const { launch } = await import('./src/main.mjs'); await launch(); }
  catch (e) { console.error(e); fail(e); }
}
async function poll() {
  try {
    const response = await fetch('./api/status', { cache: 'no-store' });
    if (response.status === 404) {
      // The installed project can also run on an ordinary static HTTP server.
      const p = await fetch('./assets/provenance.json', { method: 'HEAD' });
      if (p.ok) { await start(); return; }
      throw new Error('Run node start.mjs to install local assets before using a static server.');
    }
    if (!response.ok) throw new Error('The local server did not return its setup status.');
    const s = await response.json();
    if (s.phase === 'ready') { await start(); return; }
    if (s.phase === 'error') { fail(new Error(s.message)); return; }
    if (s.phase === 'setup') {
      $('loading-title').textContent = 'آماده‌سازی اجرای اول';
      $('loading-text').textContent = 'دریافت یک‌بارهٔ مدل، کتابخانهٔ سه‌بعدی و انیمیشن‌ها…';
      const portion = s.totalBytes ? Math.min(1, s.bytes / s.totalBytes) : 0.35;
      $('progress').style.width = `${Math.max(5, ((s.step - 1 + portion) / s.steps) * 72)}%`;
      $('loading-detail').textContent = `${s.step} / ${s.steps}  ·  ${s.file || ''}\n${s.source || ''}  ·  ${((s.bytes || 0) / 1048576).toFixed(1)} MB`;
    }
    setTimeout(poll, 700);
  } catch (e) { fail(e); }
}
if (location.protocol === 'file:') fail(new Error('Do not double-click index.html. Run START-WINDOWS.cmd or node start.mjs.'));
else poll();
