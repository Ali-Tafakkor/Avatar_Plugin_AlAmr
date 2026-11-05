/** One owned, inaudible PCM tap; the host connects its zero-gain output. */
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;

class AvatarSpeechCapture extends AudioWorkletProcessor {
  private samples = new Float32Array(Math.max(128, Math.round(sampleRate * 0.2)));
  private cursor = 0;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = inputs[0];
    for (const channel of outputs[0] ?? []) channel.fill(0);
    if (!channels?.length) return true;
    const frames = channels[0].length;
    for (let i = 0; i < frames; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i] ?? 0;
      this.samples[this.cursor++] = value / channels.length;
      if (this.cursor === this.samples.length) {
        this.port.postMessage({ samples: this.samples, sampleRate }, [this.samples.buffer]);
        this.samples = new Float32Array(Math.max(128, Math.round(sampleRate * 0.2))); this.cursor = 0;
      }
    }
    return true;
  }
}
registerProcessor('avatar-speech-capture', AvatarSpeechCapture);
export {};
