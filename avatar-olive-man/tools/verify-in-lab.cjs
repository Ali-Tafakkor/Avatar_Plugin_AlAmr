const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.OLIVE_PLAYWRIGHT_MODULE || 'playwright');

const url = process.env.OLIVE_LAB_URL || 'http://127.0.0.1:5390/';
const output = path.resolve(process.argv[2] || '.local/olive-avatar-test');
const offlineDist = process.env.OLIVE_OFFLINE_DIST && path.resolve(process.env.OLIVE_OFFLINE_DIST);
const evidence = '#avatar-studio-evidence';

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.OLIVE_CHROME,
    args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 });
    const errors = [], requests = new Set(), cases = {};
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.route('**/*', async route => {
      const request = new URL(route.request().url());
      if (request.origin !== new URL(url).origin) {
        errors.push(`Unexpected external request: ${request.origin}`);
        await route.abort();
        return;
      }
      requests.add(request.pathname);
      if (!offlineDist) return route.continue();
      const pathname = request.pathname === '/' ? '/index.html' : decodeURIComponent(request.pathname);
      const file = path.resolve(offlineDist, '.' + pathname);
      assert.ok(file.startsWith(offlineDist + path.sep));
      await route.fulfill({ path: file });
    });
    const button = name => page.getByRole('button', { name, exact: true });
    const select = page.getByLabel('انتخاب آواتار');
    const capture = async name => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(output, `${name}.jpg`), quality: 93 });
    };
    const orbit = async (turns, tilt = 0) => {
      const canvas = await page.locator('canvas').boundingBox();
      assert.ok(canvas);
      const x = canvas.x + canvas.width * .42;
      const y = canvas.y + canvas.height * .51;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + canvas.height * turns, y + canvas.height * tilt, { steps: 12 });
      await page.mouse.up();
    };
    const zoom = async amount => {
      const canvas = await page.locator('canvas').boundingBox();
      assert.ok(canvas);
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
      await page.mouse.wheel(0, -amount);
    };
    const waitFor = criteria => page.waitForFunction(({ selector, criteria }) => {
      const raw = document.querySelector(selector)?.textContent;
      if (!raw) return false;
      const state = JSON.parse(raw), avatar = state.avatar;
      if (!state.ready || state.character !== criteria.character || !avatar) return false;
      if (criteria.emotion && avatar.emotion !== criteria.emotion) return false;
      if (criteria.clip && avatar.clip !== criteria.clip) return false;
      if (criteria.curl && avatar.hands?.hands.left.curl.index < .95) return false;
      if (criteria.walking && (avatar.state !== 'walk' || Math.abs(avatar.rootPosition[2]) < .3)) return false;
      return true;
    }, { selector: evidence, criteria }, { timeout: 50000 });
    const read = async () => JSON.parse(await page.locator(evidence).textContent());

    await page.goto(url);
    await waitFor({ character: 'purple', emotion: 'neutral' });
    const initial = await read();
    assert.ok(![...requests].some(file => file.includes('olive-') && file.endsWith('.jpg')));
    await select.selectOption('olive');
    await waitFor({ character: 'olive', emotion: 'smile' });
    const olive = await read();
    assert.equal(olive.avatar.morphCount, 66);
    assert.deepEqual(olive.avatar.missingShapes, []);
    assert.ok(olive.avatar.inventory.triangles > initial.avatar.inventory.triangles);
    const previousOliveTriangles = 101262;
    assert.ok(olive.avatar.inventory.triangles < previousOliveTriangles);
    assert.ok([...requests].some(file => file.includes('olive-face-albedo')));
    assert.ok([...requests].some(file => file.includes('olive-clothing-albedo')));
    cases.mounted = { purple: initial.avatar.inventory, olive: olive.avatar.inventory };
    cases.triangleReduction = {
      previous: previousOliveTriangles,
      removed: previousOliveTriangles - olive.avatar.inventory.triangles,
    };
    cases.standingFeet = olive.avatar.feet;
    await capture('full-body');
    await button('چهره').click();
    await capture('portrait');
    await orbit(0, -.055);
    await zoom(920);
    await capture('fringe-close');
    await button('سه‌رخ').click();
    await capture('three-quarter');
    await button('نیم‌رخ').click();
    await capture('profile');
    await zoom(700);
    await capture('temple-close');
    await button('روبه‌رو').click();
    await orbit(.235);
    await capture('opposite-profile');
    await button('پشت').click();
    await capture('back-hair');
    await orbit(.075);
    await capture('back-three-quarter');
    await button('نمای نزدیک یقه').click();
    await capture('collar');
    await button('چهره').click();
    await button('چهره و حرکت').click();
    for (const [name, label] of [
      ['neutral', 'خنثی'], ['smile', 'لبخند'], ['laugh', 'خنده'], ['sad', 'ناراحتی'], ['angry', 'اخم'], ['surprise', 'تعجب'],
    ]) {
      await button(label).click();
      await waitFor({ character: 'olive', emotion: name });
      await page.waitForTimeout(380);
      cases[name] = (await read()).avatar.weights;
      if (name === 'laugh') await capture('laugh');
    }
    assert.ok(cases.laugh.jawOpen > cases.neutral.jawOpen);
    assert.ok(cases.surprise.eyeWideLeft > cases.neutral.eyeWideLeft);
    await button('یک پلک').click();
    await button('لبخند').click();
    await button('تمام‌قد').click();
    for (const [clip, label] of [['Walk', 'راه‌رفتن'], ['Run', 'دویدن'], ['HandRaise', 'بالابردن دست'], ['Sitting', 'نشسته']]) {
      await button(label).click();
      await waitFor({ character: 'olive', clip });
      const state = await read();
      cases[clip] = { mode: state.avatar.mode, time: state.avatar.time };
      if (clip === 'Sitting') await capture('sitting');
    }
    await page.getByRole('button', { name: /کنترل با صفحه‌کلید/ }).click();
    await page.keyboard.down('w');
    try {
      await waitFor({ character: 'olive', walking: true });
      cases.keyboard = (await read()).avatar.rootPosition;
    } finally {
      await page.keyboard.up('w');
    }
    await button('دست راست').click();
    await waitFor({ character: 'olive', clip: 'Stand' });
    await capture('right-hand');
    const firstContact = (await read()).avatar.handContact.hands.right;
    await page.waitForTimeout(1100);
    const secondContact = (await read()).avatar.handContact.hands.right;
    assert.ok(firstContact.angle > 0 && firstContact.after <= .0003);
    assert.ok(Math.abs(firstContact.angle - secondContact.angle) < 1e-7);
    cases.rightWristInspection = [firstContact, secondContact];
    await button('دست چپ').click();
    await button('دست و انگشت').click();
    await page.getByRole('slider', { name: 'خم‌شدن اشاره' }).focus();
    await page.keyboard.press('End');
    await waitFor({ character: 'olive', curl: true });
    cases.finger = (await read()).avatar.hands.hands.left.curl;

    await select.selectOption('purple');
    await waitFor({ character: 'purple', emotion: 'neutral' });
    const restored = await read();
    assert.deepEqual(restored.avatar.inventory, initial.avatar.inventory);
    await select.selectOption('olive');
    await waitFor({ character: 'olive', emotion: 'smile' });
    const remounted = await read();
    assert.deepEqual(remounted.avatar.inventory, olive.avatar.inventory);
    assert.deepEqual(remounted.avatar.rootPosition, [0, 0, 0]);
    assert.ok(remounted.avatar.hands.hands.left.curl.index < .9);
    cases.remount = { renderer: remounted.renderer, root: remounted.avatar.rootPosition };
    assert.deepEqual(remounted.errors, []);
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify({
      origin: new URL(url).origin,
      delivery: offlineDist ? 'built files routed locally in Chrome' : 'HTTP preview in Chrome',
      approvals: 'owner visual acceptance pending',
      requests: [...requests],
      cases,
    }, null, 2) + '\n');
    console.log('PASS: local assets, both avatars, six expressions, clips, keyboard, fingers and remount.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
