# Local microphone face integration for 0.1.3

Import `createMicrophoneSpeechController` and `LaughterDetector` from the
package's `/speech` entry. The host mounts `AvatarHybrid` in its existing
Player Rig and supplies its handle. Audio stays in the local browser.

```ts
const speech = createMicrophoneSpeechController({
  modelBaseUrl, wasmBaseUrl, workerUrl, captureWorkletUrl,
  modelFile: 'wav2arkit_cpu.onnx', dataFile: null,
  modelParts, // exact {file,bytes} list from the pinned local model.json
  onFrame: frame => avatar.current?.setSpeechFrame(frame.weights, { speaking: frame.speaking }),
  onStatus: showSpeechState,
  onAudioChunk: (samples, rate, at) => laughter.pushAudio(samples, rate, at),
});
const laughter = new LaughterDetector({
  modelUrl: yamnetModelUrl, wasmBaseUrl, workerUrl: laughterWorkerUrl,
  onScore: result => avatar.current?.setLaughter(result.score, { at: result.at }),
});
// Run on a user's Start action. prepare() can optionally warm the model earlier.
await speech.start({ deviceId });
void laughter.start().catch(() => avatar.current?.setLaughter(0));
// Stop action, document hide, unmount, or host close:
speech.stop(); laughter.stop(); avatar.current?.clearSpeech();
// Unmount:
speech.dispose(); laughter.dispose();
```

The host should catch permission/model errors and show a retryable state. Optional
laughter failure must not disable speech. The test host demonstrates this behavior
in `avatar-lab/src/SpeechPanel.tsx`.

`setSpeechOptions({gain, enabled, laughterEnabled, staleAfterMs})` adjusts the
voice layer. `clearSpeech()` restores the selected emotion/manual baseline.
`setSpeechFrame` owns lower-face articulation only; eyes and gaze remain under
existing expression control. Timestamp `at` uses `performance.now()` and denotes
freshness, not an audio recording. Late frames are bounded and never replayed
indefinitely. Capture-to-display age is a diagnostic estimate, not measured
acoustic end-to-end lip synchronization.

The selected local model uses standard ONNX Runtime dynamic int8 quantization
for MatMul/Gemm weights. Three ordinary data parts reconstruct that exact compact
ONNX graph; source, conversion, comparison results and part hashes are beside
`model.json`. The untouched float32 source remains available for comparison.
Microphone PCM is downmixed/resampled
to 16kHz. Capture advances every 200ms, while inference uses 600ms of rolling
audio: 200ms past context, the new 200ms articulation interval, and 200ms real
lookahead. Only the six interior frames are emitted. Replaying all six frames
from isolated 200ms clips created a repeated decoder-edge closing motion even
for a constant vowel; the full model has the same boundary artifact as int8.
No jaw oscillator or volume-only fallback is used. The first silent hop supplies
lookahead for the last syllable; sustained silence still clears the face.
Each delivered frame carries its own acoustic source time, and overlapping or
stale frames are discarded. This adds lookahead latency; measured diagnostics
are reported separately from acoustic synchronization and owner acceptance.
Shape gains are calibrated
for this mesh, independently of the upstream Gaussian presets.

The consuming Environment supplies the pinned model files and exact ONNX Runtime
Web 1.29.0 WASM/glue. Large models exceed the managed Plugin's 25MiB artifact
limit, so the Plugin carries its code, workers and public `speech-model-profile`
manifest. The test host installs model assets under its own `assets-source/speech`.
The 14MB WASM runtime also exceeds the Plugin's per-module ceiling and is
outside the Plugin package. The host copies it from the pinned dependency to
its local `speech/onnx/` assets. No binary is
renamed or disguised. Workers are bundled by the Plugin's build and copied by
the host, with explicit worker URLs; no CDN or dynamic bare package import is
needed at runtime.

YAMNet detects audible events such as laughter, not a person's internal emotion
or a silent smile. Automatic laughter is experimental and can miss or confuse
events. The six existing manual emotion controls remain available during speech.
See the root delivery report for the actual device/browser evidence and limits.
