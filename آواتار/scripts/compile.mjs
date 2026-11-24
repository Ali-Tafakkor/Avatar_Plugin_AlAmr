import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { writeBuildAsset } from './write-build-asset.mjs';

const diagnosticHost = {
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getCanonicalFileName: name => name,
  getNewLine: () => ts.sys.newLine,
};
const report = diagnostics => console.error(ts.formatDiagnostics(diagnostics, diagnosticHost));
const config = ts.getParsedCommandLineOfConfigFile(
  fileURLToPath(new URL('../tsconfig.json', import.meta.url)), {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: reportOne },
);
function reportOne(diagnostic) { report([diagnostic]); }
if (!config) process.exit(1);
const program = ts.createProgram({
  rootNames: config.fileNames, options: config.options, projectReferences: config.projectReferences,
});
const outputs = new Map();
// Emit to memory with the real outDir so source-map paths match tsc's output.
const emit = program.emit(undefined, (path, text, bom) => {
  outputs.set(path, Buffer.from((bom ? '\uFEFF' : '') + text, 'utf8'));
});
const diagnostics = ts.sortAndDeduplicateDiagnostics([
  ...config.errors, ...ts.getPreEmitDiagnostics(program), ...emit.diagnostics,
]);
if (diagnostics.length) report(diagnostics);
if (emit.emitSkipped || diagnostics.some(d => d.category === ts.DiagnosticCategory.Error)) process.exit(1);

for (const [path, bytes] of outputs) {
  await mkdir(dirname(path), { recursive: true });
  await writeBuildAsset(pathToFileURL(path), bytes);
}
