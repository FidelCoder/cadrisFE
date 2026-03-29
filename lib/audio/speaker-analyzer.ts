import { clamp } from "@/lib/utils";

export interface AudioMetrics {
  level: number;
  voiceActivity: number;
  timestampMs: number;
}

type AudioContextConstructor = typeof AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: AudioContextConstructor;
  }
}

export class AudioActivityAnalyzer {
  private readonly context: AudioContext;
  private readonly analyser: AnalyserNode;
  private readonly samples: Uint8Array<ArrayBuffer>;
  private readonly source: MediaStreamAudioSourceNode;
  private noiseFloor = 0.02;

  private constructor(context: AudioContext, analyser: AnalyserNode, source: MediaStreamAudioSourceNode) {
    this.context = context;
    this.analyser = analyser;
    this.source = source;
    this.samples = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
  }

  static async create(stream: MediaStream) {
    const AudioContextClass =
      typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : undefined;

    if (!AudioContextClass) {
      throw new Error("Web Audio is not available in this browser.");
    }

    const context = new AudioContextClass();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;

    source.connect(analyser);

    const analyzer = new AudioActivityAnalyzer(context, analyser, source);
    await analyzer.resume();
    return analyzer;
  }

  getState() {
    return this.context.state;
  }

  async resume() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  sample(timestampMs: number): AudioMetrics {
    this.analyser.getByteTimeDomainData(this.samples);

    let rms = 0;
    for (const sample of this.samples) {
      const normalized = (sample - 128) / 128;
      rms += normalized * normalized;
    }

    const level = Math.sqrt(rms / this.samples.length);
    this.noiseFloor = this.noiseFloor * 0.995 + level * 0.005;

    return {
      level: clamp(level * 2.6, 0, 1),
      voiceActivity: clamp((level - this.noiseFloor) * 10, 0, 1),
      timestampMs
    };
  }

  async dispose() {
    this.source.disconnect();
    this.analyser.disconnect();
    await this.context.close();
  }
}
