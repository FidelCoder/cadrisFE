import type {
  CropBox,
  DirectorFrameDimensions,
  FramingStyle,
  RecordingMode,
  ShotType
} from "@/lib/domain/cadris";
import type { AudioMetrics } from "@/lib/audio/speaker-analyzer";
import type { FaceTrack } from "@/lib/vision/types";

export interface PlannerInput {
  frame: DirectorFrameDimensions;
  timestampMs: number;
  mode: RecordingMode;
  style: FramingStyle;
  tracks: FaceTrack[];
  audio: AudioMetrics;
}

export interface PlannerDecision {
  shotType: ShotType;
  targetTrackId: string | null;
  cropBox: CropBox;
  confidence: number;
  transition: "hold" | "ease" | "cut";
  overlapScore: number;
  sceneEnergy: number;
  notes: string | null;
}

export interface PlannerTimelineEvent {
  timestampMs: number;
  shotType: ShotType;
  targetTrackId: string | null;
  cropBox: CropBox;
  confidence: number;
  notes: string | null;
}

export interface ShotPlanner {
  next(input: PlannerInput): {
    decision: PlannerDecision;
    timelineEvent: PlannerTimelineEvent | null;
  };
  reset(): void;
}
