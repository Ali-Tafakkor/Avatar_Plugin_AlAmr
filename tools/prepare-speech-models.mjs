import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, '.local/speech-models/wav2arkit');
const target = join(root, 'avatar-lab/assets-source/speech/wav2arkit');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = {
  'wav2arkit_cpu.onnx': 'cdecbfad3915dd20b2f0718942d0b8894b2ee11edcc5a9a9da45d29a46af2ed9',
  'wav2arkit_cpu.onnx.data': 'c0f0364673c6e50be126b193e2b56809c16ac6bee4805aea9b8251ce53429bf8',
};
await mkdir(target, { recursive: true });
const original = {};
for (const name of Object.keys(expected)) {
  const bytes = await readFile(join(source, name));
  if (sha(bytes) !== expected[name]) throw new Error('speech_source_hash_mismatch:' + name);
  original[name] = { bytes: bytes.length, sha256: expected[name] };
  if (name.endsWith('.onnx')) await writeFile(join(target, name), bytes);
  else {
    const parts = [];
    for (let offset = 0, index = 1; offset < bytes.length; offset += 48 * 1024 * 1024, index++) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 48 * 1024 * 1024));
      const file = name + '.part' + index;
      await writeFile(join(target, file), chunk); parts.push({ file, bytes: chunk.length, sha256: sha(chunk) });
    }
    await writeFile(join(target, 'model.json'), JSON.stringify({ modelFile: 'wav2arkit_cpu.onnx',
      dataFile: name, dataParts: parts, tensorDataSha256: expected[name],
      representation: 'Original float32 tensors; byte-exact partition, no quantization.' }, null, 2) + '\n');
  }
}
for (const name of ['README.md', 'config.json']) await copyFile(join(source, name), join(target, name));
const provenance = { model: 'myned-ai/wav2arkit_cpu', revision: '48b7d27a147d4dfcce4c8225b11209ce4cd76e05',
  modelCardLicense: 'Apache-2.0', original, partitionBytes: 48 * 1024 * 1024, quantized: false,
  sourceUrl: 'https://huggingface.co/myned-ai/wav2arkit_cpu/tree/48b7d27a147d4dfcce4c8225b11209ce4cd76e05' };
await writeFile(join(target, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
const yamnetTarget = join(root, 'avatar-lab/assets-source/speech/yamnet');
await mkdir(yamnetTarget, { recursive: true });
for (const file of ['yamnet.onnx', 'yamnet_class_map.csv', 'README.md']) {
  await copyFile(join(root, '.local/speech-models/yamnet', file), join(yamnetTarget, file));
}
const yamnetBytes = await readFile(join(yamnetTarget, 'yamnet.onnx'));
if (sha(yamnetBytes) !== '1510041dce24a2e9e84ec546807ac408ae496da6d1ed41bc3ccba649623f8e19') throw new Error('yamnet_source_hash_mismatch');
await copyFile(join(root, 'آواتار/assets-source/speech/yamnet/provenance.json'), join(yamnetTarget, 'provenance.json'));
console.log(JSON.stringify({ code: 'SPEECH_MODELS_VERIFIED_AND_PARTITIONED', ...provenance }));
