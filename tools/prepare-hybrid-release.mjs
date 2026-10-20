import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'releases/avatar-hybrid-0.1.2');
const preparation = join(root, 'docs/releases/hybrid-0.1.2/preparation');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const exists = async path => { try { await fs.lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const inside = relative(root, output);
if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('release_path_outside_workspace');
if (await exists(output)) throw new Error('release_already_exists_use_a_new_reviewed_destination');
if ((await fs.lstat(dirname(output))).isSymbolicLink()) throw new Error('release_parent_symlink_refused');

// Read all required gates before creating the new delivery directory. The
// publish doctor may report an unrelated account/project-link failure; its
// actual local Plugin artifact check must nevertheless pass.
const manifest = await readJson(join(root, 'آواتار/al-amr.plugin.json'));
const packageJson = await readJson(join(root, 'آواتار/package.json'));
if (manifest.version !== '0.1.2' || packageJson.version !== manifest.version) throw new Error('unexpected_release_version');
const requiredReceipts = ['plugin-tests.json', 'host-tests.json', 'plugin-validate.json',
  'plugin-project-doctor.json', 'plugin-publish-doctor.json', 'host-validate.json', 'preservation.json'];
const receipts = Object.fromEntries(await Promise.all(requiredReceipts.map(async name => [name, await readJson(join(preparation, name))])));
for (const name of ['plugin-tests.json', 'host-tests.json']) {
  const receipt = receipts[name];
  if (receipt.exitCode !== 0 || Number(receipt.failed) !== 0 || !(Number(receipt.passed) > 0)) throw new Error('release_tests_have_not_passed:' + name);
}
for (const name of ['plugin-validate.json', 'plugin-project-doctor.json', 'host-validate.json']) {
  if (receipts[name].ok !== true || receipts[name].exitCode !== 0) throw new Error('release_local_check_has_not_passed:' + name);
}
const doctor = receipts['plugin-publish-doctor.json'];
const artifact = doctor.data?.checks?.find(check => check.id === 'ALAMR_DOCTOR_PLUGIN_ARTIFACT');
if (artifact?.ok !== true) throw new Error('release_artifact_has_not_passed');
const rigDocs = 'avatar-lab/.al-amr/docs/plugins/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig@1.0.0';
if ((await readJson(join(root, rigDocs, 'manifest.json'))).version !== '1.0.0') throw new Error('unexpected_player_rig_documentation');

const blocked = new Set(['node_modules', '.git', '.claude', '__pycache__', '.npmrc', 'validation-host']);
async function copy(from, to) {
  const info = await fs.lstat(from), name = from.split(/[\\/]/).at(-1);
  if (blocked.has(name) || name === '.env' || (name.startsWith('.env.') && name !== '.env.example')
    || /\.(?:log|tmp|tsbuildinfo|pem|key)$/i.test(name)) return;
  if (info.isSymbolicLink()) throw new Error('release_symlink_refused:' + relative(root, from));
  if (info.isDirectory()) {
    await fs.mkdir(to, { recursive: true });
    for (const child of (await fs.readdir(from)).sort()) await copy(join(from, child), join(to, child));
  } else {
    await fs.mkdir(dirname(to), { recursive: true });
    await fs.copyFile(from, to, constants.COPYFILE_EXCL);
  }
}
await fs.mkdir(output);
const plugin = ['src', 'scripts', 'dist', 'assets-source', '.agents', 'AGENTS.md', 'CLAUDE.md',
  '.gitignore', 'al-amr.plugin.json', 'alamr.d.ts', 'package.json', 'package-lock.json',
  'tsconfig.json', 'plugin-icon.png', 'README.md', 'integration.md', 'CHANGELOG.md',
  'LICENSE', 'CODE-LICENSE.txt', 'THIRD_PARTY_NOTICES.md'];
for (const name of plugin) await copy(join(root, 'آواتار', name), join(output, 'آواتار', name));
// Repository equivalence requires the preserved experimental baseline. The
// portable kit includes only tests whose imports remain inside this kit.
const excludedPluginTests = new Set(['hybrid-equivalence.test.mjs']);
for (const name of (await fs.readdir(join(root, 'آواتار/tests'))).sort()) {
  if (!excludedPluginTests.has(name)) await copy(join(root, 'آواتار/tests', name), join(output, 'آواتار/tests', name));
}
const host = ['.agents', 'AGENTS.md', 'CLAUDE.md', 'al-amr.environment.json', 'alamr.d.ts',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vite.production.config.ts', 'index.html', 'README.md'];
for (const name of host) await copy(join(root, 'avatar-lab', name), join(output, 'avatar-lab', name));
for (const name of (await fs.readdir(join(root, 'avatar-lab/src'))).sort()) {
  if (/^(?:HybridTest|MotionTest)/.test(name) || name === 'motion-test.css') continue;
  await copy(join(root, 'avatar-lab/src', name), join(output, 'avatar-lab/src', name));
}
for (const name of ['prepare-avatar-hybrid.mjs', 'prepare-avatar-v2.mjs'])
  await copy(join(root, 'avatar-lab/scripts', name), join(output, 'avatar-lab/scripts', name));
for (const name of (await fs.readdir(join(root, 'avatar-lab/tests'))).sort())
  if (name.endsWith('.test.mjs')) await copy(join(root, 'avatar-lab/tests', name), join(output, 'avatar-lab/tests', name));
await copy(join(root, 'avatar-lab/public/environment-cover.png'), join(output, 'avatar-lab/public/environment-cover.png'));
await copy(join(root, 'avatar-lab/.al-amr/docs'), join(output, 'avatar-lab/.al-amr/docs'));
await copy(join(root, 'docs/releases/hybrid-0.1.2/DELIVERY_FA.md'), join(output, 'README_FA.md'));
await copy(join(root, 'AVATAR_HYBRID_PHASE2_FA.md'), join(output, 'acceptance/AVATAR_HYBRID_PHASE2_FA.md'));
for (const name of requiredReceipts) await copy(join(preparation, name), join(output, 'verification', name));
// A portable-copy receipt is produced AFTER this tool creates the kit. It is
// optional on first creation; no self-referential precondition is imposed.
const portable = join(preparation, 'portable-copy.json');
if (await exists(portable)) await copy(portable, join(output, 'verification/portable-copy.json'));

await fs.writeFile(join(output, 'verification/acceptance-summary.json'), JSON.stringify({
  schemaVersion: 1, acceptedOn: '2026-10-19', ownerAcceptance: 'خروجی رو دارم میبینم، خیلی خوب شده، برای مرحله فعلی کافیه',
  sourceReport: 'acceptance/AVATAR_HYBRID_PHASE2_FA.md',
  acceptedPreviewBuildDigest: 'sha256:229905b27ff8e6835e8fc829f9156f774e03ae272121d4a78e57c6829fc08951',
  scope: 'V1 body/outfit and eight clips, V2 procedural jump, sculpted native V2 face and dynamic neck',
  nativeMorphNames: 66, currentControllerChannels: 37,
  evidenceBoundary: 'Historical owner acceptance; preparation does not repeat or establish a new visual acceptance.',
}, null, 2) + '\n');
await fs.writeFile(join(output, 'release-metadata.json'), JSON.stringify({
  format: 2, preparedAt: new Date().toISOString(), product: 'accepted hybrid avatar', technicalVersion: manifest.version,
  pluginId: manifest.pluginId, publisher: manifest.publisher, slug: manifest.slug,
  pluginDirectory: 'آواتار', sampleEnvironment: 'avatar-lab',
  readiness: { localArtifactValidated: true, pluginRepositoryTests: Number(receipts['plugin-tests.json'].passed),
    hostRepositoryTests: Number(receipts['host-tests.json'].passed), pluginManifestValid: true, hostManifestValid: true,
    publishDoctorOverallOk: doctor.ok === true, portableCopyReceiptIncluded: await exists(portable) },
  assetPermissions: { applicationAndAdapterCode: 'MIT only', avatarSDKSource: 'upstream non-commercial example',
    independentCommercialOrPublicRedistributionPermission: 'not established by this preparation',
    v1Assets: 'owner-provided source; no additional asset license asserted', notices: 'آواتار/THIRD_PARTY_NOTICES.md' },
  omitted: ['node_modules', 'account/session state', 'junctions', 'experimental build trees and UI',
    'generated host assets/output', 'raw machine-specific acceptance receipts', 'repository-only hybrid equivalence test'],
  operations: { registryUpload: 'not performed by this tool', registryPublication: 'not asserted',
    remoteVersionAvailability: 'not asserted', gitOrRemotePublication: 'not performed by this tool' },
  authority: 'Local transferable preparation; not an uploaded or immutable Registry candidate.',
}, null, 2) + '\n');
await fs.writeFile(join(output, '.gitignore'), ['**/node_modules/', '**/.al-amr/*', '!**/.al-amr/docs/',
  '**/.env', '**/.env.*', '!**/.env.example', '**/.npmrc', '*.log', '*.tmp', '*.tsbuildinfo',
  '/avatar-lab/dist/', '/avatar-lab/.public-production/', '/avatar-lab/public/avatar-v2/', '/avatar-lab/public/avatar-hybrid/', ''].join('\n'));
await fs.writeFile(join(output, '.gitattributes'), '* -text\n*.glb binary\n*.bin binary\n*.png binary\n*.jpg binary\n');
const files = [];
async function inspect(directory) {
  for (const name of (await fs.readdir(directory)).sort()) {
    const path = join(directory, name), info = await fs.lstat(path);
    if (info.isSymbolicLink()) throw new Error('release_inventory_symlink_refused');
    if (info.isDirectory()) await inspect(path);
    else { const bytes = await fs.readFile(path); files.push({ path: relative(output, path).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) }); }
  }
}
await inspect(output);
await fs.writeFile(join(output, 'release-inventory.json'), JSON.stringify({ format: 1,
  scope: 'All prepared delivery files except this inventory; later portable-install artifacts are outside this snapshot', files }, null, 2) + '\n');
for (const file of files) {
  const bytes = await fs.readFile(join(output, file.path));
  if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error('release_readback_mismatch:' + file.path);
}
console.log(JSON.stringify({ code: 'HYBRID_RELEASE_PREPARED', path: output, version: manifest.version,
  files: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  localArtifactValidated: true, registryAction: 'none', gitAction: 'none' }));
