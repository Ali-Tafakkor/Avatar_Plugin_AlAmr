const fs = require('node:fs/promises');
const p = require('C:/Users/Ilia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser = await p.chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1040}});
    await page.goto('http://127.0.0.1:5393/');
    const selector = '#avatar-studio-evidence';
    await page.waitForFunction(s=>JSON.parse(document.querySelector(s)?.textContent||'{}').avatar?.morphCount===66, selector);
    await page.getByLabel('انتخاب آواتار').selectOption('elder');
    await page.waitForFunction(s=>{
      const d=JSON.parse(document.querySelector(s)?.textContent||'{}');return d.character==='elder'&&d.ready&&d.avatar?.inventory?.triangles>70000;
    }, selector);
    await page.getByRole('button',{name:'چهره',exact:true}).click();
    await page.waitForTimeout(1400);
    await page.screenshot({path:'avatar-elder-man/evidence/first-portrait.png'});
    for (const [label,file] of [['سه‌رخ','quarter'],['نیم‌رخ','profile'],['پشت','back']]) { await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(500);await page.screenshot({path:'avatar-elder-man/evidence/first-'+file+'.png'}); }
    const state=JSON.parse(await page.locator(selector).textContent());
    await fs.writeFile('avatar-elder-man/evidence/first-camera.json',JSON.stringify({camera:state.camera,canvas:await page.locator('canvas').boundingBox()},null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
