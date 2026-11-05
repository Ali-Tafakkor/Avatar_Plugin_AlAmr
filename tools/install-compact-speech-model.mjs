import { readFile, writeFile, readdir, mkdir, unlink, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, '.local/speech-models/wav2arkit-int8');
const target = join(root, 'avatar-lab/assets-source/speech/wav2arkit');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(await readFile(join(source, 'provenance.json'), 'utf8'));
const bytes = await readFile(join(source, 'wav2arkit_cpu.onnx'));
if (sha(bytes) !== receipt.sha256 || bytes.length !== receipt.bytes || receipt.checker !== 'pass') throw new Error('compact_model_integrity_failed');
await mkdir(target, { recursive: true });
// Only replace this installer-owned model data, retaining the verified FP32
// originals in .local/speech-models/wav2arkit and all original avatar sources.
for (const file of await readdir(target)) if (/^wav2arkit_cpu\.onnx(?:\.data)?(?:\.part\d+)?$/.test(file)) await unlink(join(target, file));
const parts = [];
for (let offset = 0, index = 1; offset < bytes.length; offset += 48 * 1024 * 1024, index++) {
  const part = bytes.subarray(offset, Math.min(bytes.length, offset + 48 * 1024 * 1024));
  const file = 'wav2arkit_cpu.onnx.part' + index;
  await writeFile(join(target, file), part); parts.push({ file, bytes: part.length, sha256: sha(part) });
}
const configuration = { modelFile: 'wav2arkit_cpu.onnx', dataFile: null, modelParts: parts, quantized: true, modelSha256: receipt.sha256 };
const profilePath = join(root, 'آواتار/src/speech/model-profile.json');
const profile = JSON.parse(await readFile(profilePath, 'utf8'));
profile.speech.sourceGraphSha256 ??= profile.speech.graphSha256;
profile.speech.graphSha256 = receipt.sha256;
profile.speech.graphBytes = receipt.bytes;
profile.speech.modelFile = 'wav2arkit_cpu.onnx';
profile.speech.dataFile = null;
profile.speech.quantized = true;
profile.speech.quantization = receipt.quantization;
profile.speech.modelParts = parts;
await writeFile(profilePath, JSON.stringify(profile, null, 2) + '\n');
await writeFile(join(target, 'model.json'), JSON.stringify(configuration, null, 2) + '\n');
await writeFile(join(target, 'provenance.json'), JSON.stringify(receipt, null, 2) + '\n');
for (const file of ['README.md', 'config.json']) await copyFile(join(root, '.local/speech-models/wav2arkit', file), join(target, file));
console.log(JSON.stringify({ code: 'COMPACT_SPEECH_MODEL_INSTALLED', bytes: bytes.length, sha256: receipt.sha256, parts }));
