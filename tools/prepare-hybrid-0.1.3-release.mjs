import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const kit=resolve(root,'releases/avatar-hybrid-0.1.3');
const source=join(root,'آواتار');
const manifest=JSON.parse(await fs.readFile(join(source,'al-amr.plugin.json'),'utf8'));
if(manifest.version!=='0.1.3')throw new Error('unexpected_version');
try{await fs.access(kit);throw new Error('delivery_exists_do_not_overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const omitted=new Set(['node_modules','.git','.al-amr','.npmrc']);
async function copy(from,to){
  const info=await fs.lstat(from),name=from.split(/[\\/]/).at(-1);
  if(omitted.has(name)||name.startsWith('.env')||/\.(log|tmp|tsbuildinfo|pem|key)$/.test(name)||/\.onnx(?:\.|$)/.test(name))return;
  if(info.isSymbolicLink())throw new Error('delivery_symlink_refused');
  if(info.isDirectory()){await fs.mkdir(to,{recursive:true});for(const child of await fs.readdir(from))await copy(join(from,child),join(to,child));}
  else{await fs.mkdir(resolve(to,'..'),{recursive:true});await fs.copyFile(from,to);}
}
for(const name of ['src','scripts','dist','assets-source','.agents','AGENTS.md','al-amr.plugin.json','alamr.d.ts','package.json','package-lock.json','tsconfig.json','plugin-icon.png','README.md','integration.md','SPEECH_INTEGRATION.md','CHANGELOG.md','LICENSE','CODE-LICENSE.txt','THIRD_PARTY_NOTICES.md'])
  await copy(join(source,name),join(kit,'آواتار',name));
for(const name of await fs.readdir(join(source,'tests')))
  if(!['hybrid-equivalence.test.mjs','neck-collar.test.mjs'].includes(name))await copy(join(source,'tests',name),join(kit,'آواتار/tests',name));
// Two geometry tests write their numerical reports relative to the kit root.
for(const name of ['avatar-hands-2026-11-03','avatar-neck-idle-2026-11-05']){
  const path=join(kit,'docs/runs',name);await fs.mkdir(path,{recursive:true});await fs.writeFile(join(path,'.gitkeep'),'');
}
for(const name of ['AVATAR_GARMENT_NECKLINE_FA.md','LATEST_AVATAR_FA.md'])
  await copy(join(root,name),join(kit,'reference',name));
await fs.writeFile(join(kit,'README_FA.md'),`# تحویل مستقل آواتار Hybrid 0.1.3\n\nپوشهٔ آواتار همین کیت همان Plugin اصلی ریشه است و برای نصب محلی یا انتخاب در دکمهٔ ارسال الامر آماده شده است. راهنمای اتصال داخل آواتار/integration.md است. در پوشهٔ آواتار، npm ci و npm run build اجرا شود. npm test فقط آزمون‌های مستقل این کیت را اجرا می‌کند؛ دو آزمون وابسته به مقایسهٔ تاریخی در مخزن اصلی محفوظ‌اند.\n\nظاهر ۵ نوامبر پذیرفته شده است. مدل قدیمی به‌تنهایی جای runtime کامل را نمی‌گیرد. فایل‌های اختیاری مدل گفتار/WASM متعلق به میزبان و خارج از Plugin هستند. Registry هنوز توسط عامل آپلود یا منتشر نشده است؛ آزادبودن آنلاین 0.1.3 تأیید نشده است.\n`);
await fs.writeFile(join(kit,'.gitignore'),'**/node_modules/\n**/.al-amr/*\n**/.env*\n*.log\n*.tsbuildinfo\n');
await fs.writeFile(join(kit,'.gitattributes'),'* -text\n');
const files=[];const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function inventory(dir){for(const name of (await fs.readdir(dir)).sort()){
  const p=join(dir,name),stat=await fs.lstat(p);if(stat.isDirectory())await inventory(p);else{const bytes=await fs.readFile(p);files.push({path:relative(kit,p).replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes)});}
}}
await inventory(kit);
await fs.writeFile(join(kit,'release-inventory.json'),JSON.stringify({version:'0.1.3',source:'root آواتار',scope:'delivery files except this inventory; later ignored node_modules/report files excluded',files},null,2)+'\n');
for(const file of files)if(hash(await fs.readFile(join(kit,file.path)))!==file.sha256)throw new Error('delivery_readback_failed');
console.log(JSON.stringify({version:'0.1.3',files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),path:kit,registryAction:'none'}));
