# 12 — Optional speech and audible laughter

Use when the user wants microphone-driven facial motion or audible laughter. Deliver manual facial controls without requiring audio. Reuse the host's audio path when available. Keep mic activation explicit, preserve the host's permission contract and retain controls to stop capture. Resolve licensable model/WASM, worker/worklet entry points and supported browser requirements. Treat permissions, assets, latency and language coverage as deployment constraints.

## Runtime composition

- Capture mono PCM through an appropriate audio worklet or host source. Feed bounded rolling windows asynchronously to an inference worker, resampling to the actual model's rate. Timestamp frames, drop stale/out-of-order frames and bound pending work. Keep raw audio local when implementing this local mode. Stop streams/workers on disposal and stop or suspend capture when the host hides the view.
- Drive canonical jaw/lip channels through the same face compositor already used for emotion, blink and gaze. Map to real deformers per mesh and calibrate gains per character. Blend speech in on valid fresh frames and ease back to the base expression during pauses, ends or a stale stream. Keep eye/upper-face motion live. Do not let independent writers reset the other channels.
- Audible laughter detection can drive a graded laughter overlay with attack/release and gating. Use actual sound evidence. Manual laugh stays independently usable. Report timing and false positives from speech/music/background sound.
- For Al-Amr Desktop, declare the native microphone capability in the consuming product and verify that the declaration reaches the production bundle. For other hosts use the host/browser permission mechanism. Test denied permission, missing files, silence, sustained speech, stop/restart and device changes where supported. Use the intended language and real microphone for final acceptance, in addition to controlled input tests.

In the original checkout, `آواتار/SPEECH_INTEGRATION.md`, `آواتار/src/speech/compositor.mjs` and `avatar-lab/src/SpeechPanel.tsx` describe a worker/WASM implementation. The portable package supplies this integration guide and facial preset data. Obtain the intended backend and assets separately when speech is requested.
