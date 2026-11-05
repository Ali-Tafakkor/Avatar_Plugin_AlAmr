/** Pure PCM helpers shared by live capture and deterministic tests. */
export function rms(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) if (Number.isFinite(sample)) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/** Windowed-sinc low-pass resampling. Browser capture normally already runs
 * at 16kHz; this fallback avoids aliasing when the device/context refuses it. */
export function resampleMono(samples, sourceRate, targetRate = 16000) {
  if (!(sourceRate > 0) || !(targetRate > 0)) throw new RangeError('invalid_sample_rate');
  if (sourceRate === targetRate) return samples.slice();
  const length = Math.max(0, Math.round(samples.length * targetRate / sourceRate));
  const result = new Float32Array(length);
  const cutoff = Math.min(1, targetRate / sourceRate) * 0.94;
  const radius = Math.ceil(12 / cutoff);
  for (let i = 0; i < length; i++) {
    const center = i * sourceRate / targetRate;
    let value = 0, norm = 0;
    const start = Math.max(0, Math.ceil(center - radius));
    const end = Math.min(samples.length - 1, Math.floor(center + radius));
    for (let j = start; j <= end; j++) {
      const distance = j - center, x = Math.PI * distance * cutoff;
      const sinc = Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x;
      const window = 0.5 * (1 + Math.cos(Math.PI * distance / radius));
      const weight = sinc * window;
      value += (Number.isFinite(samples[j]) ? samples[j] : 0) * weight;
      norm += weight;
    }
    result[i] = norm ? value / norm : 0;
  }
  return result;
}

export function appendRecent(previous, current, maximumSamples) {
  const limit = Math.max(0, Math.floor(maximumSamples));
  if (current.length >= limit) return current.slice(current.length - limit);
  const tail = previous.subarray(Math.max(0, previous.length - (limit - current.length)));
  const result = new Float32Array(tail.length + current.length);
  result.set(tail); result.set(current, tail.length);
  return result;
}

/** Keep the decoder away from the artificial beginning of a live window. */
export function padAudioContext(samples, minimumSamples) {
  if (samples.length >= minimumSamples) return samples.slice();
  const padded = new Float32Array(minimumSamples);
  padded.set(samples, minimumSamples - samples.length);
  return padded;
}

/** Emit only the new interior hop. Decoder edge frames are predictions made
 * without future context and visibly close the mouth at every chunk boundary.
 * Frame timestamps refer to the end of each corresponding acoustic interval.
 */
export function selectSpeechInterval(data, frameCount, sampleCount, tailFrames, lookaheadFrames = 0, fps = 30, rate = 16000) {
  const usable = Math.min(frameCount, Math.ceil(sampleCount / rate * fps));
  const end = Math.max(0, usable - Math.max(0, Math.round(lookaheadFrames)));
  const first = Math.max(0, end - Math.max(1, Math.round(tailFrames)));
  return {
    frames: Array.from({ length: end - first }, (_, index) => data.slice((first + index) * 52, (first + index + 1) * 52)),
    frameStartOffsetMs: ((first + 1) / fps - sampleCount / rate) * 1000,
    frameIntervalMs: 1000 / fps,
  };
}
