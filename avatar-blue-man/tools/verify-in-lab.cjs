const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.AVATAR_PLAYWRIGHT_MODULE || 'playwright');

const origin = process.env.AVATAR_LAB_URL || 'http://127.0.0.1:5393/';
const output = path.resolve(process.argv[2] || '.local/blue-man/browser');
const evidence = '#avatar-studio-evidence';
const emotions = [
  ['neutral', 'خنثی'], ['smile', 'لبخند'], ['laugh', 'خنده'],
  ['sad', 'ناراحتی'], ['angry', 'اخم'], ['surprise', 'تعجب'],
];

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.AVATAR_CHROME,
    args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 });
    const errors = [], requests = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.route('**/*', async route => {
      const request = new URL(route.request().url());
      if (request.origin !== new URL(origin).origin) {
        errors.push(`Unexpected external request: ${request.origin}`);
        return route.abort();
      }
      requests.add(request.pathname);
      return route.continue();
    });
    const button = name => page.getByRole('button', { name, exact: true });
    const select = page.getByLabel('انتخاب آواتار');
    const read = async () => JSON.parse(await page.locator(evidence).textContent());
    const waitFor = async (character, criteria = {}) => {
      await page.waitForFunction(({ evidence, character, criteria }) => {
        const raw = document.querySelector(evidence)?.textContent;
        if (!raw) return false;
        const state = JSON.parse(raw), actor = state.avatar;
        return state.ready && state.character === character && actor
          && Object.entries(criteria).every(([key, value]) => JSON.stringify(actor[key]) === JSON.stringify(value));
      }, { evidence, character, criteria }, { timeout: 35000 });
      return read();
    };
    const capture = async filename => {
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(output, filename + '.jpg'), quality: 93 });
    };

    await page.goto(origin);
    const purple = await waitFor('purple', { emotion: 'neutral' });
    assert.deepEqual(await select.locator('option').evaluateAll(options => options.map(option => option.value)), ['purple', 'olive', 'blue']);
    assert.ok(![...requests].some(file => file.includes('blue-')));
    await select.selectOption('blue');
    await page.waitForFunction(({ evidence, previous }) => {
      const state = JSON.parse(document.querySelector(evidence).textContent);
      return state.character === 'blue' && state.ready && state.avatar?.inventory?.triangles > previous;
    }, { evidence, previous: purple.avatar.inventory.triangles }, { timeout: 15000 });
    const blue = await waitFor('blue', { emotion: 'neutral', rootPosition: [0, 0, 0] });
    assert.equal(blue.avatar.morphCount, 66);
    assert.deepEqual(blue.avatar.missingShapes, []);
    assert.ok(blue.avatar.inventory.triangles > purple.avatar.inventory.triangles);
    assert.ok([...requests].some(file => file.includes('blue-face-albedo')));
    assert.ok([...requests].some(file => file.includes('blue-clothing-albedo')));
    await capture('full-body');
    await button('چهره').click();
    await capture('portrait');
    for (const [file, label] of [['three-quarter', 'سه‌رخ'], ['profile', 'نیم‌رخ'], ['back-hair', 'پشت']]) {
      await button(label).click();
      await capture(file);
    }
    await button('نمای نزدیک یقه').click();
    await capture('collar');
    await button('سه‌رخ').click();
    await capture('collar-quarter');
    await button('نیم‌رخ').click();
    await capture('collar-profile');
    await button('چهره').click();
    await button('چهره و حرکت').click();
    await page.getByRole('slider', { name: 'شدت احساس' }).focus();
    await page.keyboard.press('End');
    const expressions = {};
    for (const [name, label] of emotions) {
      await button(label).click();
      await waitFor('blue', { emotion: name });
      await page.waitForTimeout(650);
      expressions[name] = (await read()).avatar.weights;
      if (name === 'laugh') await capture('laugh');
    }
    assert.ok(expressions.laugh.jawOpen > (expressions.neutral.jawOpen ?? 0) + .1);
    assert.ok(expressions.surprise.eyeWideLeft > (expressions.neutral.eyeWideLeft ?? 0) + .1);
    await button('یک پلک').click();
    await button('خنثی').click();
    await button('تمام‌قد').click();
    const clips = {};
    for (const [name, label] of [['Walk', 'راه‌رفتن'], ['Run', 'دویدن'], ['HandRaise', 'بالابردن دست'], ['Sitting', 'نشسته']]) {
      await button(label).click();
      const { avatar } = await waitFor('blue', { clip: name });
      clips[name] = { mode: avatar.mode, time: avatar.time };
      if (name === 'Sitting') await capture('sitting');
    }
    const keyboard = page.getByRole('button', { name: /کنترل با صفحه‌کلید/ });
    await keyboard.click();
    await page.keyboard.down('w');
    let walking;
    try {
      await page.waitForFunction(selector => {
        const actor = JSON.parse(document.querySelector(selector).textContent).avatar;
        return actor?.state === 'walk' && Math.abs(actor.rootPosition[2]) > .1;
      }, evidence);
      walking = (await read()).avatar.rootPosition;
    } finally {
      await page.keyboard.up('w');
    }
    const stopped = await waitFor('blue', { state: 'idle' });
    await page.waitForFunction(({ evidence, time }) => {
      const actor = JSON.parse(document.querySelector(evidence).textContent).avatar;
      return actor?.state === 'idle' && actor.time !== time;
    }, { evidence, time: stopped.avatar.time });
    // Locomotion has a short jump and the diagnostics panel samples once
    // per second. Launch close to the next sample to observe the air pose.
    await page.waitForTimeout(620);
    await page.keyboard.press('Space');
    await page.waitForFunction(selector => {
      const actor = JSON.parse(document.querySelector(selector).textContent).avatar;
      return actor?.jumpWeight > 0 && actor.rootPosition[1] > .1;
    }, evidence, { timeout: 4000 });
    await waitFor('blue', { state: 'idle', jumpWeight: 0 });
    await button('دست چپ').click();
    await button('دست و انگشت').click();
    await page.getByRole('slider', { name: 'خم‌شدن اشاره' }).focus();
    await page.keyboard.press('End');
    await page.waitForFunction(selector =>
      JSON.parse(document.querySelector(selector).textContent).avatar?.hands?.hands.left.curl.index > .95, evidence);
    const fingers = (await read()).avatar.hands.hands.left.curl;
    await capture('hand');
    await select.selectOption('olive');
    const olive = await waitFor('olive', { emotion: 'smile' });
    assert.equal(olive.avatar.inventory.triangles, 80438);
    await select.selectOption('purple');
    assert.deepEqual((await waitFor('purple')).avatar.inventory, purple.avatar.inventory);
    await select.selectOption('blue');
    const remounted = await waitFor('blue', { rootPosition: [0, 0, 0], emotion: 'neutral' });
    assert.deepEqual(remounted.avatar.inventory, blue.avatar.inventory);
    assert.ok(remounted.avatar.hands.hands.left.curl.index < .9);
    assert.deepEqual(remounted.errors, []);
    assert.deepEqual(errors, []);
    const report = {
      renderer: blue.renderer, inventory: blue.avatar.inventory,
      standingFeet: blue.avatar.feet, expressions, clips, walking, jumpedAndLanded: true, fingers,
      selectionAndRemount: ['purple', 'blue', 'olive', 'purple', 'blue'], requests: [...requests],
    };
    await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS: three characters, six expressions, four clips, keyboard, jump, fingers and remount.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
