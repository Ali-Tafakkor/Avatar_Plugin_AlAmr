import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';

const busyWindowsFile = new Set(['EACCES', 'EBUSY', 'EPERM', 'UNKNOWN']);

export async function copyBuildAsset(source, destination) {
  return writeBuildAsset(destination, await readFile(source));
}

/** Keep a verified generated file usable by a concurrent Desktop preview. */
export async function writeBuildAsset(destination, bytes) {
  for (let attempt = 0; ; attempt++) {
    let temporary;
    try {
      const current = await readFile(destination).catch(error => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (current?.equals(bytes)) return false;
      // Publish a complete replacement only after the entire file is written.
      temporary = new URL(destination.href + '.' + randomUUID() + '.tmp');
      await writeFile(temporary, bytes, { flag: 'wx' });
      await rename(temporary, destination);
      return true;
    } catch (error) {
      if (process.platform !== 'win32' || !busyWindowsFile.has(error.code) || attempt >= 4) throw error;
      // Scanners and preview readers can hold a file briefly on Windows.
      await wait(80 * 2 ** attempt);
    } finally {
      if (temporary) await rm(temporary, { force: true });
    }
  }
}
