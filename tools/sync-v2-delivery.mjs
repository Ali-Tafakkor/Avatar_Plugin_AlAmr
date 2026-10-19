import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Git handoff only: refresh the locally prepared delivery, never Registry bytes.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'releases/avatar-web-v2-0.1.1');
const backup = join(root, 'versions/avatar-lab-single-avatar-delivery-2026-10-17');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async path => fs.access(path).then(() => true, () => false);
const blocked = new Set(['node_modules', '.git', '.claude', '__pycache__']);
async function copy(from, to) {
  const name = from.split(/[\\/]/).at(-1), info = await fs.lstat(from);
  if (blocked.has(name) || name === '.env' || name.startsWith('.env.') || name.endsWith('.log')) return;
  if (info.isSymbolicLink()) throw new Error('Delivery symlink refused: ' + from);
  if (info.isDirectory()) {
    await fs.mkdir(to, { recursive: true });
    for (const entry of (await fs.readdir(from)).sort()) await copy(join(from, entry), join(to, entry));
  } else {
    await fs.mkdir(dirname(to), { recursive: true }); await fs.copyFile(from, to);
  }
}
const manifest = JSON.parse(await fs.readFile(join(root, 'آواتار/al-amr.plugin.json'), 'utf8'));
const oldMetadata = JSON.parse(await fs.readFile(join(output, 'release-metadata.json'), 'utf8'));
if (manifest.version !== '0.1.1' || oldMetadata.pluginId !== manifest.pluginId) throw new Error('Unexpected delivery identity/version');
if (!await exists(backup)) {
  await copy(join(output, 'avatar-lab'), join(backup, 'avatar-lab'));
  for (const name of ['release-inventory.json', 'release-metadata.json']) await copy(join(output, name), join(backup, name));
  await copy(join(output, 'README_FA.md'), join(backup, 'delivery-readme-before-comparison.md'));
  await fs.writeFile(join(backup, 'README_FA.md'), '# بایگانی میزبان تک‌آواتار پیش از مقایسه\n\nمنبع avatar-lab تحویل ۱۷ اکتبر، پیش از هماهنگی ۱۹ اکتبر، در زیرپوشهٔ avatar-lab حفظ شده است. این پوشه snapshot کامل Plugin نیست؛ metadata و inventory قبلی صرفاً سوابق تحویل آن تاریخ‌اند. برای بازگردانی، منبع میزبان را کنار Plugin سازگار قرار دهید و build کنید. محل جاری ادامه، avatar-lab ریشه است.\n');
}
const plugin = ['src', 'scripts', 'tests', 'dist', 'assets-source', '.agents', 'AGENTS.md', 'CLAUDE.md', '.gitignore',
  'al-amr.plugin.json', 'alamr.d.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'plugin-icon.png',
  'README.md', 'integration.md', 'CHANGELOG.md', 'LICENSE', 'CODE-LICENSE.txt', 'THIRD_PARTY_NOTICES.md'];
const host = ['src', 'scripts', 'tests', '.agents', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'al-amr.environment.json',
  'alamr.d.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html'];
for (const name of plugin) await copy(join(root, 'آواتار', name), join(output, 'آواتار', name));
for (const name of host) await copy(join(root, 'avatar-lab', name), join(output, 'avatar-lab', name));
await copy(join(root, 'avatar-lab/public/environment-cover.png'), join(output, 'avatar-lab/public/environment-cover.png'));
await copy(join(root, 'avatar-lab/.al-amr/docs'), join(output, 'avatar-lab/.al-amr/docs'));
const deliveryReadme = await fs.readFile(join(root, 'docs/releases/v2.0/DELIVERY_FA.md'), 'utf8');
await fs.writeFile(join(output, 'README_FA.md'), deliveryReadme.replaceAll('](../../../', ']('));
for (const name of ['Open-Avatar-Lab.cmd', 'AVATAR_COMPARISON_TEST_FA.md']) await copy(join(root, name), join(output, name));
const comparisonReadme = await fs.readFile(join(output, 'AVATAR_COMPARISON_TEST_FA.md'), 'utf8');
await fs.writeFile(join(output, 'AVATAR_COMPARISON_TEST_FA.md'), comparisonReadme.replaceAll('(AVATAR_V2_RELEASE_PREPARATION_FA.md)',
  '(https://github.com/Ali-Tafakkor/Avatar_Plugin_AlAmr/blob/avatar-v2/AVATAR_V2_RELEASE_PREPARATION_FA.md)'));
await copy(join(root, 'docs/tests/2026-10-17-avatar-comparison'), join(output, 'docs/tests/2026-10-17-avatar-comparison'));
const receipt = join(root, 'docs/releases/v2.0/git-handoff/git-publication-2026-10-19.json');
if (await exists(receipt)) await copy(receipt, join(output, 'verification/git-publication-2026-10-19.json'));
const preview = JSON.parse(await fs.readFile(join(root, 'docs/tests/2026-10-17-avatar-comparison/preview-verify.json'), 'utf8'));
const comparison = { recordedOn: '2026-10-19', evidenceDate: '2026-10-17',
  pluginTestsPreviouslyPassed: 23, hostTestsPreviouslyPassed: 8, ownerAccepted: true,
  newRuntimeTestsRunForGitHandoff: false, previewId: preview.data.previewId,
  buildDigest: preview.data.buildDigest, runtimeStateAtCapture: preview.data.state,
  hostMode: 'V1 and V2 comparison; host-owned legacy material correction',
  evidence: '../docs/tests/2026-10-17-avatar-comparison/preview-verify.json' };
await fs.writeFile(join(output, 'verification/comparison-acceptance.json'), JSON.stringify(comparison, null, 2) + '\n');
const readiness = { ...oldMetadata.readiness, hostTests: 8, lastRuntimeTestDate: '2026-10-17', ownerAccepted: true,
  newRuntimeTestsRunForGitHandoff: false, comparisonHostCopiedFromAcceptedSource: true,
  offlineCleanInstallAndBuildVerified: false,
  priorSingleAvatarCleanBuildEvidence: 'verification/portable-copy.json' };
delete readiness.gitCommitted; delete readiness.gitPushed;
const metadata = { ...oldMetadata, clientDate: '2026-10-19', readiness,
  git: { branch: 'avatar-v2', receipt: 'verification/git-publication-2026-10-19.json' },
  sampleEnvironmentMode: 'V1 and V2 comparison',
  previousSingleAvatarHost: '../../versions/avatar-lab-single-avatar-delivery-2026-10-17',
  authority: 'Local Git delivery refreshed from the accepted host; not an uploaded Registry candidate' };
await fs.writeFile(join(output, 'release-metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
const files = [];
async function inventory(directory) {
  for (const name of (await fs.readdir(directory)).sort()) {
    const path = join(directory, name), info = await fs.lstat(path);
    if (info.isSymbolicLink()) throw new Error('Unexpected delivery symlink: ' + path);
    if (info.isDirectory()) await inventory(path);
    else if (path !== join(output, 'release-inventory.json')) {
      const bytes = await fs.readFile(path);
      files.push({ path: relative(output, path).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) });
    }
  }
}
await inventory(output);
for (const file of files) {
  if (hash(await fs.readFile(join(output, file.path))) !== file.sha256) throw new Error('Delivery readback mismatch: ' + file.path);
  if (file.path.startsWith('آواتار/') || /^(avatar-lab\/(src|scripts|tests)\/)/.test(file.path)) {
    if (hash(await fs.readFile(join(root, file.path))) !== file.sha256) throw new Error('Source copy mismatch: ' + file.path);
  }
}
await fs.writeFile(join(output, 'release-inventory.json'), JSON.stringify({ format: 1, clientDate: '2026-10-19',
  scope: 'All delivery files except this inventory', files }, null, 2) + '\n');
await fs.mkdir(join(root, 'docs/releases/v2.0/git-handoff'), { recursive: true });
const report = { clientDate: '2026-10-19', output: relative(root, output).replaceAll('\\', '/'),
  backup: relative(root, backup).replaceAll('\\', '/'), files: files.length,
  allHashesReadBack: true, pluginAndHostSourceCopiesMatch: true, comparison,
  priorCleanBuildAppliesToPreviousSingleAvatarSnapshotOnly: true };
await fs.writeFile(join(root, 'docs/releases/v2.0/git-handoff/delivery-sync.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
