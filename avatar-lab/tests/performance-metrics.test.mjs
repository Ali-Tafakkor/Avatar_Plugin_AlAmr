import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeSamples} from '../src/performance-metrics.mjs';
test('performance report keeps units, p95 tail, unavailable GPU and actual sample averages',()=>{
  const report=summarizeSamples(Array.from({length:20},(_,i)=>({frameMs:i===19?100:10,cpuSubmitMs:2,avatarUpdateMs:3,gpuMs:null})));
  assert.equal(report.frames,20);assert.equal(report.frameMs,14.5);assert.equal(report.fps,1000/14.5);assert.equal(report.p95Ms,10);assert.equal(report.gpuMs,null);assert.equal(report.cpuSubmitMs,2);assert.equal(report.avatarUpdateMs,3);
  assert.equal(summarizeSamples([]),null);
  assert.equal(summarizeSamples([{frameMs:20,gpuMs:4},{frameMs:20,gpuMs:6}]).gpuMs,5);
});
