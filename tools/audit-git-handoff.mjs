import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Inspect proposed repository contents without printing potential secret values.
const root = fileURLToPath(new URL('../', import.meta.url));
const reportPath = 'docs/releases/v2.0/git-handoff/git-audit.json';
const runGit = args => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Git read failed: ' + args[0]); return result.stdout;
};
const names = [...new Set(runGit(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort();
const forbidden = [], secrets = [], oversized = [], sizes = [], symlinks = [], brokenLinks = [];
const patterns = [
  ['github_token', /\b(?:gh[pousr]_[A-Za-z0-9]{32,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['private_key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['aws_access_key', /\bAKIA[A-Z0-9]{16}\b/],
];
let totalBytes = 0, removedTrackedFiles = 0;
for (const name of names) {
  if (name === reportPath) continue;
  let info; try { info = await fs.lstat(join(root, name)); } catch (error) { if (error.code === 'ENOENT') { removedTrackedFiles++; continue; } throw error; }
  if (info.isSymbolicLink()) { symlinks.push(name); continue; } if (!info.isFile()) continue;
  if (/(^|\/)(node_modules|\.git|\.claude|\.uv-cache|\.uv-tools)(\/|$)/.test(name)
    || /(^|\/)\.env(?:\.|$)/.test(name) && !name.endsWith('.env.example')
    || /(^|\/)\.npmrc$|\.(pem|key)$/i.test(name)
    || /(^|\/)\.al-amr\/(?!docs\/)/.test(name)) forbidden.push(name);
  if (info.size > 100 * 1024 * 1024) oversized.push({ path: name, bytes: info.size });
  totalBytes += info.size; sizes.push({ path: name, bytes: info.size });
  if (info.size > 6 * 1024 * 1024 || /\.(png|jpe?g|webp|glb|bin|zip|pdf|woff2?)$/i.test(name)) continue;
  const bytes = await fs.readFile(join(root, name)); if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  for (const [kind, pattern] of patterns) if (pattern.test(content)) secrets.push({ path: name, kind });
}
const activeDocs = ['AGENTS.md', 'NEXT_AGENT_START_HERE.md', 'PROJECT_HANDOFF.md', 'PROJECT_HISTORY_FA.md', 'README.md',
  'DOCUMENTATION_INDEX_FA.md', 'VERSIONING_FA.md', 'AVATAR_COMPARISON_TEST_FA.md', 'AVATAR_V2_RELEASE_PREPARATION_FA.md',
  'avatar-lab/README.md', 'docs/releases/v2.0/DELIVERY_FA.md', 'releases/avatar-web-v2-0.1.1/README_FA.md',
  'releases/avatar-web-v2-0.1.1/avatar-lab/README.md', 'releases/avatar-web-v2-0.1.1/AVATAR_COMPARISON_TEST_FA.md'];
for (const name of activeDocs) {
  const body = await fs.readFile(join(root, name), 'utf8');
  for (const match of body.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const path = resolve(dirname(join(root, name)), decodeURIComponent(target));
    if (!await fs.access(path).then(() => true, () => false)) brokenLinks.push({ document: name, target });
  }
}
const protectedCheck = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', 'source', 'AlAmr-Avatar03-Environment', 'AlAmr-Avatar03-Environment_2'], { cwd: root, windowsHide: true });
const baseline = await fs.readFile(join(root, 'source/Avatar_03/Avatar_03_Complete_Animations_Updated.glb'));
const baselineHash = createHash('sha256').update(baseline).digest('hex');
const report = { clientDate: '2026-10-19', scope: 'Static packaging/documentation/Git-content checks; no runtime test executed',
  candidateFiles: sizes.length, removedTrackedFiles, totalBytes, largestFiles: sizes.sort((a, b) => b.bytes - a.bytes).slice(0, 8),
  forbiddenPaths: forbidden, secretPatternFindings: secrets, oversized, symlinks, activeDocumentsChecked: activeDocs.length, brokenLinks,
  protectedSourceAndDeliveredEnvironmentDiffExitCode: protectedCheck.status, baselineAvatarSha256: baselineHash,
  baselineAvatarHashMatches: baselineHash === 'bf16883394c2f968faa294e8debe02dc38ff8ba4aaf98d32319e025d8185540d' };
await fs.mkdir(dirname(join(root, reportPath)), { recursive: true });
await fs.writeFile(join(root, reportPath), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (forbidden.length || secrets.length || oversized.length || symlinks.length || brokenLinks.length || protectedCheck.status !== 0 || !report.baselineAvatarHashMatches) process.exitCode = 1;
