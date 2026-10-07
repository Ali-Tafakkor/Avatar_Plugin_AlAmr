import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
if (!existsSync(join(output, 'index.html'))) {
  throw new Error('The prepared environment bundle is missing from dist.');
}

const manifest = JSON.parse(readFileSync(join(root, 'al-amr.environment.json'), 'utf8'));
const cover = resolve(output, manifest.portal.art.imageUrl);
const coverRelative = relative(output, cover);
if (!coverRelative || coverRelative.startsWith('..') || isAbsolute(coverRelative)) {
  throw new Error('The environment cover must be inside dist.');
}

// Desktop puts its managed cover in public and updates the manifest path.
// Copy that exact image without replacing the prepared application bundle.
const publicCover = join(root, 'public', coverRelative);
if (existsSync(publicCover)) {
  mkdirSync(dirname(cover), { recursive: true });
  copyFileSync(publicCover, cover);
}
if (!existsSync(cover)) throw new Error(`The environment cover is missing: ${coverRelative}`);

console.log(`Prepared environment bundle and cover: ${coverRelative}`);
