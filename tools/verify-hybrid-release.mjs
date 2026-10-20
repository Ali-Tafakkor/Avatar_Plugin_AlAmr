import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'docs/releases/hybrid-0.1.2/preparation');
await fs.mkdir(output,{recursive:true});
const suites=process.argv.slice(2);
for(const suite of suites.length?suites:['plugin','host']){
  if(!['plugin','host'].includes(suite))throw new Error('Unknown suite');
  const cwd=join(root,suite==='plugin'?'آواتار':'avatar-lab');
  const files=(await fs.readdir(join(cwd,'tests'))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
  const result=spawnSync(process.execPath,['--test',...files],{cwd,encoding:'utf8',maxBuffer:16*1024*1024});
  const text=(result.stdout??'')+(result.stderr??'');
  await fs.writeFile(join(output,suite+'-tests.txt'),text);
  const count=key=>Number(text.match(new RegExp('(?:# |ℹ )'+key+' (\\d+)'))?.[1]??NaN);
  const report={format:1,clientDate:'2026-10-20',scope:'nonvisual packaging/regression checks',suite,exitCode:result.status,passed:count('pass'),failed:count('fail'),files,visualTestsRepeated:false};
  await fs.writeFile(join(output,suite+'-tests.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  if(result.status!==0||!Number.isFinite(report.passed)||report.failed!==0){console.error(text);process.exitCode=1;break;}
}
