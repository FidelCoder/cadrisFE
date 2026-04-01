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

function average(samples: ArrayLike<number>, startIndex: number, endIndex: number) {
  let total = 0;
  let count = 0;

  for (let index = startIndex; index < endIndex; index += 1) {
    total += samples[index] ?? 0;
    count += 1;
  }

  return count ? total / count / 255 : 0;
}

export class AudioActivityAnalyzer {
  private readonly context: AudioContext;
  private readonly analyser: AnalyserNode;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly gainNode: GainNode;
  private readonly destination: MediaStreamAudioDestinationNode;
  private readonly timeDomainSamples: Uint8Array<ArrayBuffer>;
  private readonly frequencySamples: Uint8Array<ArrayBuffer>;
  private levelFloor = 0.012;
  private speechFloor = 0.014;
  private smoothedLevel = 0;
  private smoothedVoice = 0;

  private constructor(
    context: AudioContext,
    analyser: AnalyserNode,
    source: MediaStreamAudioSourceNode,
    gainNode: GainNode,
    destination: MediaStreamAudioDestinationNode
  ) {
    this.context = context;
    this.analyser = analyser;
    this.source = source;
    this.gainNode = gainNode;
    this.destination = destination;
    this.timeDomainSamples = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.frequencySamples = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
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
    analyser.fftSize = 2048;
    analyser.minDecibels = -92;
    analyser.maxDecibels = -8;
    analyser.smoothingTimeConstant = 0.8;

    const gainNode = context.createGain();
    gainNode.gain.value = 1;

    const destination = context.createMediaStreamDestination();

    source.connect(analyser);
    source.connect(gainNode);
    gainNode.connect(destination);

    const analyzer = new AudioActivityAnalyzer(context, analyser, source, gainNode, destination);
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

  createRecordingTrack() {
    const track = this.destination.stream.getAudioTracks()[0];
    return track ? track.clone() : null;
  }

  sample(timestampMs: number): AudioMetrics {
    this.analyser.getByteTimeDomainData(this.timeDomainSamples);
    this.analyser.getByteFrequencyData(this.frequencySamples);

    let rms = 0;
    for (const sample of this.timeDomainSamples) {
      const normalized = (sample - 128) / 128;
      rms += normalized * normalized;
    }

    const rawLevel = Math.sqrt(rms / this.timeDomainSamples.length);
    const nyquist = this.context.sampleRate / 2;
    const speechStartIndex = Math.max(0, Math.floor((160 / nyquist) * this.frequencySamples.length));
    const speechEndIndex = Math.min(this.frequencySamples.length, Math.ceil((1800 / nyquist) * this.frequencySamples.length));
    const speechBandEnergy = average(this.frequencySamples, speechStartIndex, speechEndIndex);

    this.levelFloor = this.levelFloor * 0.992 + rawLevel * 0.008;
    this.speechFloor = this.speechFloor * 0.988 + speechBandEnergy * 0.012;

    const normalizedLevel = clamp((rawLevel - this.levelFloor) * 14, 0, 1);
    const normalizedSpeech = clamp((speechBandEnergy - this.speechFloor) * 8, 0, 1);

    this.smoothedLevel = this.smoothedLevel * 0.62 + normalizedLevel * 0.38;
    this.smoothedVoice = this.smoothedVoice * 0.58 + (normalizedSpeech * 0.68 + normalizedLevel * 0.32) * 0.42;

    return {
      level: clamp(this.smoothedLevel, 0, 1),
      voiceActivity: clamp(this.smoothedVoice, 0, 1),
      timestampMs
    };
  }

  async dispose() {
    this.source.disconnect();
    this.analyser.disconnect();
    this.gainNode.disconnect();
    this.destination.disconnect();
    this.destination.stream.getTracks().forEach((track) => track.stop());
    await this.context.close();
  }
}
