import { clamp } from "@/lib/utils";
import type { DetectedFace } from "@/lib/vision/types";

interface BrowserFaceDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
}

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => BrowserFaceDetector;
  }
}

export interface VisionDetector {
  kind: "native-face-detector" | "blazeface" | "motion-fallback" | "fallback";
  detect: (video: HTMLVideoElement, timestampMs: number) => Promise<DetectedFace[]>;
  dispose: () => void;
}

interface BlazeFacePrediction {
  topLeft: [number, number] | Float32Array;
  bottomRight: [number, number] | Float32Array;
  probability?: number | number[] | Float32Array;
}

function normalizeDetectionBox(
  video: HTMLVideoElement,
  left: number,
  top: number,
  right: number,
  bottom: number,
  paddingRatio = 0.08
) {
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const paddingX = width * paddingRatio;
  const paddingY = height * paddingRatio;

  return {
    x: clamp(left - paddingX, 0, video.videoWidth),
    y: clamp(top - paddingY, 0, video.videoHeight),
    width: clamp(width + paddingX * 2, video.videoWidth * 0.04, video.videoWidth),
    height: clamp(height + paddingY * 2, video.videoHeight * 0.06, video.videoHeight)
  };
}

function isPlausibleFaceBox(video: HTMLVideoElement, box: DetectedFace["box"]) {
  const aspectRatio = box.width / Math.max(box.height, 1);
  const relativeArea = (box.width * box.height) / Math.max(video.videoWidth * video.videoHeight, 1);

  return (
    box.width >= video.videoWidth * 0.035 &&
    box.height >= video.videoHeight * 0.05 &&
    aspectRatio > 0.45 &&
    aspectRatio < 1.8 &&
    relativeArea < 0.4
  );
}

function getOverlapRatio(
  left: Pick<DetectedFace["box"], "x" | "y" | "width" | "height">,
  right: Pick<DetectedFace["box"], "x" | "y" | "width" | "height">
) {
  const intersectionLeft = Math.max(left.x, right.x);
  const intersectionTop = Math.max(left.y, right.y);
  const intersectionRight = Math.min(left.x + left.width, right.x + right.width);
  const intersectionBottom = Math.min(left.y + left.height, right.y + right.height);

  if (intersectionRight <= intersectionLeft || intersectionBottom <= intersectionTop) {
    return 0;
  }

  const intersectionArea = (intersectionRight - intersectionLeft) * (intersectionBottom - intersectionTop);
  const smallerArea = Math.max(1, Math.min(left.width * left.height, right.width * right.height));
  return intersectionArea / smallerArea;
}

class NativeFaceDetectionAdapter implements VisionDetector {
  kind = "native-face-detector" as const;

  constructor(private detector: BrowserFaceDetector) {}

  async detect(video: HTMLVideoElement, timestampMs: number) {
    const detections = await this.detector.detect(video);

    return detections
      .map((detection, index) => ({
        detectionId: `${timestampMs}-${index}`,
        confidence: 0.8,
        box: normalizeDetectionBox(
          video,
          detection.boundingBox.x,
          detection.boundingBox.y,
          detection.boundingBox.x + detection.boundingBox.width,
          detection.boundingBox.y + detection.boundingBox.height,
          0.04
        )
      }))
      .filter((detection) => isPlausibleFaceBox(video, detection.box));
  }

  dispose() {}
}

class BlazeFaceDetectionAdapter implements VisionDetector {
  kind = "blazeface" as const;

  constructor(
    private estimateFaces: (video: HTMLVideoElement) => Promise<BlazeFacePrediction[]>
  ) {}

  async detect(video: HTMLVideoElement, timestampMs: number) {
    const predictions = await this.estimateFaces(video);

    const detections = predictions
      .map((prediction, index) => {
        const topLeftX = Number(prediction.topLeft[0]);
        const topLeftY = Number(prediction.topLeft[1]);
        const bottomRightX = Number(prediction.bottomRight[0]);
        const bottomRightY = Number(prediction.bottomRight[1]);
        const probability = Array.isArray(prediction.probability)
          ? Number(prediction.probability[0] ?? 0.78)
          : prediction.probability instanceof Float32Array
            ? Number(prediction.probability[0] ?? 0.78)
            : Number(prediction.probability ?? 0.78);

        return {
          detectionId: `${timestampMs}-blazeface-${index}`,
          confidence: clamp(probability || 0.74, 0.32, 1),
          box: normalizeDetectionBox(video, topLeftX, topLeftY, bottomRightX, bottomRightY)
        };
      })
      .filter((detection) => isPlausibleFaceBox(video, detection.box))
      .sort((left, right) => right.confidence - left.confidence);

    const deduped: DetectedFace[] = [];
    for (const detection of detections) {
      if (deduped.some((existing) => getOverlapRatio(existing.box, detection.box) > 0.74)) {
        continue;
      }

      deduped.push(detection);
      if (deduped.length >= 4) {
        break;
      }
    }

    return deduped.map((detection, index) => ({
      ...detection,
      detectionId: `${timestampMs}-blazeface-${index}`
    }));
  }

  dispose() {}
}

class MotionDetectionAdapter implements VisionDetector {
  kind = "motion-fallback" as const;
  private canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  private context = this.canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
  private previousLuma: Uint8Array | null = null;
  private lastBox: DetectedFace["box"] | null = null;
  private lastBoxAt = 0;
  private frameCount = 0;

  private resize(video: HTMLVideoElement) {
    if (!this.canvas) {
      return { width: 0, height: 0 };
    }

    const sampleWidth = Math.min(180, Math.max(96, Math.round(video.videoWidth / 8)));
    const sampleHeight = Math.max(54, Math.round(sampleWidth * (video.videoHeight / Math.max(video.videoWidth, 1))));

    if (this.canvas.width !== sampleWidth || this.canvas.height !== sampleHeight) {
      this.canvas.width = sampleWidth;
      this.canvas.height = sampleHeight;
    }

    return {
      width: sampleWidth,
      height: sampleHeight
    };
  }

  async detect(video: HTMLVideoElement, timestampMs: number) {
    if (!this.context || !this.canvas || !video.videoWidth || !video.videoHeight) {
      return [];
    }

    const { width, height } = this.resize(video);
    if (!width || !height) {
      return [];
    }

    this.frameCount += 1;
    this.context.drawImage(video, 0, 0, width, height);
    const image = this.context.getImageData(0, 0, width, height);
    const currentLuma = new Uint8Array(width * height);

    let changedPixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let index = 0; index < currentLuma.length; index += 1) {
      const pixelOffset = index * 4;
      const luminance =
        (image.data[pixelOffset] * 54 + image.data[pixelOffset + 1] * 183 + image.data[pixelOffset + 2] * 19) >> 8;
      currentLuma[index] = luminance;

      if (!this.previousLuma) {
        continue;
      }

      const difference = Math.abs(luminance - this.previousLuma[index]);
      if (difference < 14) {
        continue;
      }

      changedPixels += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    this.previousLuma = currentLuma;

    if (changedPixels === 0 || maxX < minX || maxY < minY) {
      if (this.lastBox && timestampMs - this.lastBoxAt < 4_000) {
        return [
          {
            detectionId: `${timestampMs}-motion-hold`,
            confidence: 0.38,
            box: this.lastBox
          }
        ];
      }

      if (this.frameCount > 12) {
        return [
          {
            detectionId: `${timestampMs}-center-fallback`,
            confidence: 0.22,
            box: {
              x: video.videoWidth * 0.32,
              y: video.videoHeight * 0.16,
              width: video.videoWidth * 0.36,
              height: video.videoHeight * 0.58
            }
          }
        ];
      }

      return [];
    }

    const changedRatio = changedPixels / currentLuma.length;
    if (changedRatio < 0.003 || changedRatio > 0.38) {
      if (this.lastBox && timestampMs - this.lastBoxAt < 1_200) {
        return [
          {
            detectionId: `${timestampMs}-motion-persist`,
            confidence: 0.34,
            box: this.lastBox
          }
        ];
      }

      return [];
    }

    const scaleX = video.videoWidth / width;
    const scaleY = video.videoHeight / height;
    const paddingX = Math.max((maxX - minX) * 0.35, width * 0.04);
    const paddingY = Math.max((maxY - minY) * 0.4, height * 0.05);

    const box = {
      x: clamp((minX - paddingX) * scaleX, 0, video.videoWidth),
      y: clamp((minY - paddingY) * scaleY, 0, video.videoHeight),
      width: clamp((maxX - minX + paddingX * 2) * scaleX, video.videoWidth * 0.16, video.videoWidth * 0.92),
      height: clamp((maxY - minY + paddingY * 2) * scaleY, video.videoHeight * 0.22, video.videoHeight * 0.92)
    };

    this.lastBox = box;
    this.lastBoxAt = timestampMs;

    return [
      {
        detectionId: `${timestampMs}-motion`,
        confidence: clamp(0.36 + changedRatio * 7, 0.36, 0.74),
        box
      }
    ];
  }

  dispose() {
    this.previousLuma = null;
    this.lastBox = null;
    this.frameCount = 0;
  }
}

class FallbackDetectionAdapter implements VisionDetector {
  kind = "fallback" as const;

  async detect() {
    return [];
  }

  dispose() {}
}

export async function createVisionDetector(): Promise<VisionDetector> {
  if (typeof window !== "undefined" && window.FaceDetector) {
    try {
      return new NativeFaceDetectionAdapter(
        new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 4
        })
      );
    } catch (error) {
      console.warn("Falling back from native FaceDetector.", error);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const [{ setBackend, ready }, , , blazeface] = await Promise.all([
        import("@tensorflow/tfjs-core"),
        import("@tensorflow/tfjs-backend-webgl"),
        import("@tensorflow/tfjs-backend-cpu"),
        import("@tensorflow-models/blazeface")
      ]);

      try {
        await setBackend("webgl");
      } catch {
        await setBackend("cpu");
      }

      await ready();

      const model = await blazeface.load({
        maxFaces: 4,
        scoreThreshold: 0.32,
        iouThreshold: 0.2
      });

      return new BlazeFaceDetectionAdapter((video) => model.estimateFaces(video, false) as Promise<BlazeFacePrediction[]>);
    } catch (error) {
      console.warn("Falling back from BlazeFace detector.", error);
    }
  }

  if (typeof document !== "undefined") {
    return new MotionDetectionAdapter();
  }

  return new FallbackDetectionAdapter();
}
