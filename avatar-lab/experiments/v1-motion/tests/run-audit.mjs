import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createActorInstance } from '../../../../آواتار/src/web-v2/actor.mjs';
import { retargetV1Clips } from '../retarget.mjs';
import { loadMotionFixtures } from './model-fixtures.mjs';
import { auditRetargetSamples, compactAudit } from './audit-sampling.mjs';

const { legacy, web } = await loadMotionFixtures();
const target = createActorInstance(web.gltf);
const retargeted = retargetV1Clips(target, legacy.gltf);
try {
  const report = await auditRetargetSamples({ retargeted, target, legacyGltf: legacy.gltf });
  const retargetBytes = await fs.readFile(new URL('../retarget.mjs', import.meta.url));
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  report.evidence = {
    generatedAt: new Date().toISOString(),
    command: 'node experiments/v1-motion/tests/run-audit.mjs',
    sourceSha256: sha256(legacy.bytes), targetSha256: sha256(web.bytes), retargetSha256: sha256(retargetBytes),
    rootScale: retargeted.rootScale,
    scope: 'Renderer-free skeleton and timing comparison; images omitted in memory. No visual or runtime acceptance claim.',
  };
  const file = new URL('../evidence/retarget-raw-audit.json', import.meta.url);
  await fs.mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await fs.writeFile(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(compactAudit(report), null, 2));
} finally {
  retargeted.dispose(); target.dispose();
}
