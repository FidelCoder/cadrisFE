import type { CropBox, DirectorFrameDimensions } from "@/lib/domain/cadris";

export interface Point2D {
  x: number;
  y: number;
}

export interface DetectedFace {
  detectionId: string;
  box: CropBox;
  confidence: number;
}

export interface FaceTrack {
  id: string;
  box: CropBox;
  confidence: number;
  lastSeenAt: number;
  firstSeenAt: number;
  motionScore: number;
  activityScore: number;
  speechScore: number;
  presenceScore: number;
  centerBias: number;
  velocity: Point2D;
  stability: number;
  visible: boolean;
}

export interface DetectionFrame {
  faces: DetectedFace[];
  frame: DirectorFrameDimensions;
  timestampMs: number;
}
