import { clamp } from "@/lib/utils";
import type { FaceTrack } from "@/lib/vision/types";

export interface TrackActivityMetrics {
  activityScore: number;
  speechScore: number;
  presenceScore: number;
  centerBias: number;
}

export interface VisualActivitySample {
  sceneMotion: number;
  perTrack: Record<string, TrackActivityMetrics>;
}

export class VisualActivityAnalyzer {
  private readonly canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  private readonly context = this.canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
  private previousLuma: Uint8Array | null = null;

  private resize(video: HTMLVideoElement) {
    if (!this.canvas) {
      return { width: 0, height: 0 };
    }

    const width = Math.min(240, Math.max(144, Math.round(video.videoWidth / 7)));
    const height = Math.max(80, Math.round(width * (video.videoHeight / Math.max(video.videoWidth, 1))));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    return { width, height };
  }

  sample(video: HTMLVideoElement, tracks: FaceTrack[]): VisualActivitySample {
    if (!this.canvas || !this.context || !video.videoWidth || !video.videoHeight) {
      return {
        sceneMotion: 0,
        perTrack: {}
      };
    }

    const { width, height } = this.resize(video);
    if (!width || !height) {
      return {
        sceneMotion: 0,
        perTrack: {}
      };
    }

    this.context.drawImage(video, 0, 0, width, height);
    const frame = this.context.getImageData(0, 0, width, height);
    const currentLuma = new Uint8Array(width * height);

    let motionAccumulator = 0;
    let changedPixels = 0;

    for (let index = 0; index < currentLuma.length; index += 1) {
      const pixelOffset = index * 4;
      const luminance =
        (frame.data[pixelOffset] * 54 + frame.data[pixelOffset + 1] * 183 + frame.data[pixelOffset + 2] * 19) >> 8;
      currentLuma[index] = luminance;

      if (!this.previousLuma) {
        continue;
      }

      const difference = Math.abs(luminance - this.previousLuma[index]);
      motionAccumulator += difference;
      if (difference > 14) {
        changedPixels += 1;
      }
    }

    const previousLuma = this.previousLuma;
    this.previousLuma = currentLuma;

    if (!previousLuma) {
      return {
        sceneMotion: 0,
        perTrack: {}
      };
    }

    const perTrack: Record<string, TrackActivityMetrics> = {};
    const diagonal = Math.hypot(video.videoWidth, video.videoHeight);

    for (const track of tracks) {
      const left = clamp(Math.floor((track.box.x / video.videoWidth) * width), 0, width - 1);
      const top = clamp(Math.floor((track.box.y / video.videoHeight) * height), 0, height - 1);
      const boxWidth = clamp(Math.ceil((track.box.width / video.videoWidth) * width), 8, width - left);
      const boxHeight = clamp(Math.ceil((track.box.height / video.videoHeight) * height), 8, height - top);

      let faceMotion = 0;
      let faceSamples = 0;
      let mouthMotion = 0;
      let mouthSamples = 0;

      const mouthLeft = left + Math.floor(boxWidth * 0.22);
      const mouthRight = left + Math.floor(boxWidth * 0.78);
      const mouthTop = top + Math.floor(boxHeight * 0.48);
      const mouthBottom = top + Math.floor(boxHeight * 0.84);

      for (let y = top; y < top + boxHeight; y += 1) {
        for (let x = left; x < left + boxWidth; x += 1) {
          const pixelIndex = y * width + x;
          const difference = Math.abs(currentLuma[pixelIndex] - previousLuma[pixelIndex]);
          faceMotion += difference;
          faceSamples += 1;

          if (x >= mouthLeft && x <= mouthRight && y >= mouthTop && y <= mouthBottom) {
            mouthMotion += difference;
            mouthSamples += 1;
          }
        }
      }

      const faceMotionScore = clamp((faceMotion / Math.max(faceSamples, 1)) / 26, 0, 1);
      const mouthMotionScore = clamp((mouthMotion / Math.max(mouthSamples, 1)) / 22, 0, 1);
      const presenceScore = clamp((track.box.width * track.box.height) / (video.videoWidth * video.videoHeight) * 10.5, 0, 1);

      const centerX = track.box.x + track.box.width / 2;
      const centerY = track.box.y + track.box.height / 2;
      const distanceFromCenter = Math.hypot(centerX - video.videoWidth / 2, centerY - video.videoHeight / 2);
      const centerBias = clamp(1 - distanceFromCenter / Math.max(diagonal * 0.45, 1), 0, 1);

      perTrack[track.id] = {
        activityScore: faceMotionScore,
        speechScore: clamp(mouthMotionScore * 0.68 + faceMotionScore * 0.2 + track.motionScore * 0.12, 0, 1),
        presenceScore,
        centerBias
      };
    }

    return {
      sceneMotion: clamp(motionAccumulator / Math.max(currentLuma.length, 1) / 32 + changedPixels / currentLuma.length, 0, 1),
      perTrack
    };
  }

  dispose() {
    this.previousLuma = null;
  }
}
