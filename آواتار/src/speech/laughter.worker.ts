import * as ort from 'onnxruntime-web/wasm';

// Dedicated worker: inference never occupies the host's render thread.
// The host bundles this file and serves all runtime/model files locally.
type Input =
  | { type: 'init'; modelUrl: string; wasmBaseUrl: string }
  | { type: 'infer'; audio: Float32Array; at: number };
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Input>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
let session: ort.InferenceSession | null = null;
let busy = false;

async function initialize(message: Extract<Input, { type: 'init' }>) {
  if (session) return;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = message.wasmBaseUrl;
  session = await ort.InferenceSession.create(message.modelUrl, { executionProviders: ['wasm'] });
  // Validate the model signature before admitting real audio.
  const scores = await infer(new Float32Array(15600));
  if (scores.length !== 521) throw new Error('yamnet_output_class_count_mismatch');
  scope.postMessage({ type: 'ready', classes: scores.length });
}

async function infer(audio: Float32Array): Promise<Float32Array> {
  if (!session) throw new Error('yamnet_not_ready');
  const input = new ort.Tensor('float32', audio, [audio.length]);
  let outputs: Record<string, ort.Tensor> | undefined;
  try {
    outputs = await session.run({ [session.inputNames[0]]: input });
    const scoreTensor = Object.values(outputs).find(t => t.dims.length >= 2 && t.dims[t.dims.length - 1] === 521);
    if (!scoreTensor || scoreTensor.type !== 'float32') throw new Error('yamnet_scores_missing');
    const data = scoreTensor.data as Float32Array;
    const rows = data.length / 521;
    if (!Number.isInteger(rows) || rows < 1) throw new Error('yamnet_scores_invalid');
    const mean = new Float32Array(521);
    for (let row = 0; row < rows; row++) for (let i = 0; i < 521; i++) mean[i] += data[row * 521 + i] / rows;
    return mean;
  } finally {
    input.dispose();
    if (outputs) for (const tensor of Object.values(outputs)) tensor.dispose();
  }
}

scope.onmessage = event => {
  const message = event.data;
  if (message.type === 'init') {
    void initialize(message).catch(error => scope.postMessage({ type: 'error', message: String(error instanceof Error ? error.message : error) }));
    return;
  }
  if (busy) return;
  busy = true;
  const started = performance.now();
  void infer(message.audio).then(scores => {
    scope.postMessage({ type: 'result', scores, at: message.at, inferenceMs: performance.now() - started }, [scores.buffer]);
  }).catch(error => {
    scope.postMessage({ type: 'error', message: String(error instanceof Error ? error.message : error) });
  }).finally(() => { busy = false; });
};
