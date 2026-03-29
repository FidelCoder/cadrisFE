import type { CropBox } from "@/lib/domain/cadris";
import type { PlannerDecision, PlannerInput, PlannerTimelineEvent, ShotPlanner } from "@/lib/shot-planner/types";
import { clamp, lerp } from "@/lib/utils";
import type { FaceTrack } from "@/lib/vision/types";

const OUTPUT_ASPECT_RATIO = 16 / 9;
const DEFAULT_WIDE_BOX: CropBox = {
  x: 0,
  y: 0,
  width: 1,
  height: 1
};

const SOLO_VARIANTS = ["establish", "speaker-medium", "speaker-close", "environment-left", "environment-right"] as const;
const SCENE_VARIANTS = ["wide", "push", "left", "right"] as const;
const DUO_VARIANTS = ["balanced", "speaker", "tight-speaker"] as const;
const ENSEMBLE_VARIANTS = ["wide-ensemble", "speaker-ensemble", "conversation-cluster"] as const;

type SoloVariant = (typeof SOLO_VARIANTS)[number];
type SceneVariant = (typeof SCENE_VARIANTS)[number];
type DuoVariant = (typeof DUO_VARIANTS)[number];
type EnsembleVariant = (typeof ENSEMBLE_VARIANTS)[number];

function normalizeBox(box: CropBox, frame: PlannerInput["frame"]) {
  return {
    x: clamp(box.x / frame.width, 0, 1),
    y: clamp(box.y / frame.height, 0, 1),
    width: clamp(box.width / frame.width, 0.1, 1),
    height: clamp(box.height / frame.height, 0.1, 1)
  };
}

function clampCrop(box: CropBox): CropBox {
  const width = clamp(box.width, 0.14, 1);
  const height = clamp(box.height, 0.14, 1);

  return {
    x: clamp(box.x, 0, 1 - width),
    y: clamp(box.y, 0, 1 - height),
    width,
    height
  };
}

function fitCropToPreview(box: CropBox, frame: PlannerInput["frame"]) {
  const frameAspectRatio = frame.width / Math.max(frame.height, 1);
  const normalizedAspectRatio = OUTPUT_ASPECT_RATIO / frameAspectRatio;

  let width = box.width;
  let height = box.height;

  if (width / Math.max(height, 0.0001) > normalizedAspectRatio) {
    height = width / normalizedAspectRatio;
  } else {
    width = height * normalizedAspectRatio;
  }

  if (width > 1) {
    width = 1;
    height = width / normalizedAspectRatio;
  }

  if (height > 1) {
    height = 1;
    width = height * normalizedAspectRatio;
  }

  return clampCrop({
    x: box.x,
    y: box.y,
    width,
    height
  });
}

function smoothBox(previous: CropBox | null, next: CropBox) {
  if (!previous) {
    return next;
  }

  return {
    x: lerp(previous.x, next.x, 0.2),
    y: lerp(previous.y, next.y, 0.2),
    width: lerp(previous.width, next.width, 0.18),
    height: lerp(previous.height, next.height, 0.18)
  };
}

function unionVisibleTracks(tracks: FaceTrack[]) {
  const visibleTracks = tracks.filter((track) => track.visible);
  if (!visibleTracks.length) {
    return null;
  }

  const left = Math.min(...visibleTracks.map((track) => track.box.x));
  const top = Math.min(...visibleTracks.map((track) => track.box.y));
  const right = Math.max(...visibleTracks.map((track) => track.box.x + track.box.width));
  const bottom = Math.max(...visibleTracks.map((track) => track.box.y + track.box.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function composeCrop(
  focusBox: CropBox,
  frame: PlannerInput["frame"],
  options: {
    scale: number;
    anchorX: number;
    anchorY: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  }
) {
  const normalizedFocus = normalizeBox(focusBox, frame);
  const focusCenterX = normalizedFocus.x + normalizedFocus.width / 2;
  const focusCenterY = normalizedFocus.y + normalizedFocus.height / 2;

  const fittedSize = fitCropToPreview(
    {
      x: 0,
      y: 0,
      width: clamp(normalizedFocus.width * options.scale, options.minWidth, options.maxWidth),
      height: clamp(normalizedFocus.height * options.scale, options.minHeight, options.maxHeight)
    },
    frame
  );

  return clampCrop({
    x: focusCenterX - fittedSize.width * options.anchorX,
    y: focusCenterY - fittedSize.height * options.anchorY,
    width: fittedSize.width,
    height: fittedSize.height
  });
}

function computeWideCrop(input: PlannerInput) {
  const combined = unionVisibleTracks(input.tracks);
  if (!combined) {
    return DEFAULT_WIDE_BOX;
  }

  return composeCrop(combined, input.frame, {
    scale: 2.7,
    anchorX: 0.5,
    anchorY: 0.48,
    minWidth: 0.72,
    maxWidth: 1,
    minHeight: 0.72,
    maxHeight: 1
  });
}

function computeMultiSpeakerCrop(track: FaceTrack, input: PlannerInput, shotType: PlannerDecision["shotType"]) {
  if (shotType === "close") {
    return composeCrop(track.box, input.frame, {
      scale: input.mode === "interview" ? 1.62 : 1.75,
      anchorX: track.velocity.x >= 0 ? 0.43 : 0.57,
      anchorY: 0.37,
      minWidth: 0.26,
      maxWidth: 0.58,
      minHeight: 0.26,
      maxHeight: 0.62
    });
  }

  return composeCrop(track.box, input.frame, {
    scale: input.mode === "podcast" ? 2.5 : 2.35,
    anchorX: track.velocity.x >= 0 ? 0.38 : 0.62,
    anchorY: 0.41,
    minWidth: 0.38,
    maxWidth: 0.82,
    minHeight: 0.38,
    maxHeight: 0.86
  });
}

function computeTwoPersonCrop(
  tracks: FaceTrack[],
  primaryTrack: FaceTrack,
  input: PlannerInput,
  variant: DuoVariant
) {
  const combined = unionVisibleTracks(tracks) ?? primaryTrack.box;
  const combinedNormalized = normalizeBox(combined, input.frame);
  const primaryNormalized = normalizeBox(primaryTrack.box, input.frame);
  const primaryCenterX = primaryNormalized.x + primaryNormalized.width / 2;
  const combinedLeft = combinedNormalized.x;
  const relativePrimaryX = clamp((primaryCenterX - combinedLeft) / Math.max(combinedNormalized.width, 0.001), 0.28, 0.72);

  if (variant === "tight-speaker") {
    const tightShotType =
      input.style === "dynamic" && primaryTrack.speechScore > 0.42 ? ("close" as const) : ("medium" as const);
    return {
      shotType: tightShotType,
      cropBox: computeMultiSpeakerCrop(primaryTrack, input, tightShotType),
      confidence: clamp(
        0.62 + primaryTrack.speechScore * 0.16 + primaryTrack.presenceScore * 0.08 + input.audio.voiceActivity * 0.12,
        0.56,
        0.9
      ),
      notes: "tight emphasis on the active speaker while the partner stays present"
    };
  }

  if (variant === "speaker") {
    return {
      shotType: "medium" as const,
      cropBox: computeMultiSpeakerCrop(primaryTrack, input, "medium"),
      confidence: clamp(
        0.6 + primaryTrack.speechScore * 0.12 + primaryTrack.stability * 0.08 + input.audio.voiceActivity * 0.08,
        0.52,
        0.86
      ),
      notes: "speaker-forward two-shot with enough room for the second subject"
    };
  }

  return {
    shotType: "medium" as const,
    cropBox: composeCrop(combined, input.frame, {
      scale: input.mode === "podcast" ? 1.92 : 1.84,
      anchorX: lerp(0.5, relativePrimaryX, 0.22),
      anchorY: 0.44,
      minWidth: 0.54,
      maxWidth: 0.96,
      minHeight: 0.52,
      maxHeight: 0.96
    }),
    confidence: clamp(0.56 + primaryTrack.presenceScore * 0.1 + primaryTrack.stability * 0.12, 0.5, 0.82),
    notes: "balanced two-shot that keeps both faces alive in the composition"
  };
}

function computeEnsembleCrop(
  tracks: FaceTrack[],
  primaryTrack: FaceTrack,
  input: PlannerInput,
  variant: EnsembleVariant
) {
  const combined = unionVisibleTracks(tracks) ?? primaryTrack.box;
  const combinedNormalized = normalizeBox(combined, input.frame);
  const primaryNormalized = normalizeBox(primaryTrack.box, input.frame);
  const primaryCenterX = primaryNormalized.x + primaryNormalized.width / 2;
  const relativePrimaryX = clamp(
    (primaryCenterX - combinedNormalized.x) / Math.max(combinedNormalized.width, 0.001),
    0.26,
    0.74
  );

  if (variant === "speaker-ensemble") {
    return {
      shotType: "medium" as const,
      cropBox: composeCrop(combined, input.frame, {
        scale: input.mode === "interview" ? 1.48 : 1.62,
        anchorX: lerp(0.5, relativePrimaryX, 0.28),
        anchorY: 0.42,
        minWidth: 0.5,
        maxWidth: 0.9,
        minHeight: 0.48,
        maxHeight: 0.9
      }),
      confidence: clamp(
        0.56 + primaryTrack.speechScore * 0.16 + primaryTrack.presenceScore * 0.08 + input.audio.voiceActivity * 0.08,
        0.5,
        0.86
      ),
      notes: "ensemble frame favoring the current speaker without losing the room"
    };
  }

  if (variant === "conversation-cluster") {
    return {
      shotType: "medium" as const,
      cropBox: composeCrop(combined, input.frame, {
        scale: 1.38,
        anchorX: lerp(0.5, relativePrimaryX, 0.16),
        anchorY: 0.43,
        minWidth: 0.56,
        maxWidth: 0.88,
        minHeight: 0.54,
        maxHeight: 0.88
      }),
      confidence: clamp(0.52 + primaryTrack.activityScore * 0.14 + input.sceneMotion * 0.12, 0.48, 0.8),
      notes: "clustered conversation frame for a tighter ensemble beat"
    };
  }

  return {
    shotType: "wide" as const,
    cropBox: composeCrop(combined, input.frame, {
      scale: 1.95,
      anchorX: lerp(0.5, relativePrimaryX, 0.12),
      anchorY: 0.46,
      minWidth: 0.68,
      maxWidth: 1,
      minHeight: 0.66,
      maxHeight: 1
    }),
    confidence: clamp(0.5 + primaryTrack.presenceScore * 0.12 + tracks.length * 0.03, 0.46, 0.78),
    notes: "wide ensemble coverage that keeps every participant inside the composition"
  };
}

function computeSoloCrop(track: FaceTrack, input: PlannerInput, variant: SoloVariant) {
  switch (variant) {
    case "establish":
      return {
        shotType: "wide" as const,
        cropBox: composeCrop(track.box, input.frame, {
          scale: 3.85,
          anchorX: 0.5,
          anchorY: 0.46,
          minWidth: 0.7,
          maxWidth: 1,
          minHeight: 0.7,
          maxHeight: 1
        }),
        confidence: clamp(0.48 + track.presenceScore * 0.1 + input.audio.voiceActivity * 0.12, 0.44, 0.76),
        notes: "wide establish around the solo subject"
      };
    case "speaker-close":
      return {
        shotType: track.speechScore > 0.42 || input.audio.voiceActivity > 0.42 ? ("close" as const) : ("medium" as const),
        cropBox: composeCrop(track.box, input.frame, {
          scale: track.speechScore > 0.42 || input.audio.voiceActivity > 0.42 ? 1.68 : 2.1,
          anchorX: track.velocity.x >= 0 ? 0.44 : 0.56,
          anchorY: 0.37,
          minWidth: 0.26,
          maxWidth: 0.58,
          minHeight: 0.26,
          maxHeight: 0.62
        }),
        confidence: clamp(
          0.6 + track.speechScore * 0.18 + input.audio.voiceActivity * 0.12 + track.stability * 0.08,
          0.56,
          0.92
        ),
        notes: "tight solo emphasis when the speaker feels strong"
      };
    case "environment-left":
      return {
        shotType: "medium" as const,
        cropBox: composeCrop(track.box, input.frame, {
          scale: 3,
          anchorX: 0.28,
          anchorY: 0.42,
          minWidth: 0.5,
          maxWidth: 0.92,
          minHeight: 0.5,
          maxHeight: 0.92
        }),
        confidence: clamp(0.54 + track.presenceScore * 0.08 + track.stability * 0.16, 0.48, 0.82),
        notes: "left-third composition to reveal more environment"
      };
    case "environment-right":
      return {
        shotType: "medium" as const,
        cropBox: composeCrop(track.box, input.frame, {
          scale: 3,
          anchorX: 0.72,
          anchorY: 0.42,
          minWidth: 0.5,
          maxWidth: 0.92,
          minHeight: 0.5,
          maxHeight: 0.92
        }),
        confidence: clamp(0.54 + track.presenceScore * 0.08 + track.stability * 0.16, 0.48, 0.82),
        notes: "right-third composition to keep the frame interesting"
      };
    case "speaker-medium":
    default:
      return {
        shotType: "medium" as const,
        cropBox: composeCrop(track.box, input.frame, {
          scale: 2.46,
          anchorX: track.velocity.x >= 0 ? 0.38 : 0.62,
          anchorY: 0.4,
          minWidth: 0.42,
          maxWidth: 0.84,
          minHeight: 0.42,
          maxHeight: 0.88
        }),
        confidence: clamp(
          0.56 + input.audio.voiceActivity * 0.1 + track.speechScore * 0.14 + track.presenceScore * 0.08,
          0.5,
          0.86
        ),
        notes: "medium solo framing with enough environmental breathing room"
      };
  }
}

function computeSceneFallbackCrop(input: PlannerInput, variant: SceneVariant) {
  const createSceneCrop = (width: number, anchorX: number, anchorY = 0.48) =>
    fitCropToPreview(
      clampCrop({
        x: 0.5 - width * anchorX,
        y: 0.5 - width * anchorY,
        width,
        height: width
      }),
      input.frame
    );

  switch (variant) {
    case "push":
      return {
        shotType: "medium" as const,
        cropBox: createSceneCrop(clamp(0.78 - input.sceneMotion * 0.1, 0.64, 0.8), 0.5),
        confidence: clamp(0.3 + input.sceneMotion * 0.12, 0.26, 0.46),
        notes: "soft push-in while scanning for a subject"
      };
    case "left":
      return {
        shotType: "medium" as const,
        cropBox: createSceneCrop(clamp(0.8 - input.sceneMotion * 0.1, 0.66, 0.84), 0.33),
        confidence: clamp(0.28 + input.sceneMotion * 0.14, 0.24, 0.42),
        notes: "left-weighted environmental frame"
      };
    case "right":
      return {
        shotType: "medium" as const,
        cropBox: createSceneCrop(clamp(0.8 - input.sceneMotion * 0.1, 0.66, 0.84), 0.67),
        confidence: clamp(0.28 + input.sceneMotion * 0.14, 0.24, 0.42),
        notes: "right-weighted environmental frame"
      };
    case "wide":
    default:
      return {
        shotType: "wide" as const,
        cropBox: DEFAULT_WIDE_BOX,
        confidence: 0.22,
        notes: "holding a wide scene while reacquiring the subject"
      };
  }
}

function choosePrimaryTrack(input: PlannerInput) {
  const ranked = input.tracks
    .filter((track) => track.visible)
    .map((track) => {
      const score = clamp(
        input.audio.voiceActivity * 0.26 +
          track.speechScore * 0.28 +
          track.activityScore * 0.12 +
          track.motionScore * 0.1 +
          track.stability * 0.08 +
          track.presenceScore * 0.1 +
          track.centerBias * 0.06,
        0,
        1
      );

      return {
        track,
        score
      };
    })
    .sort((left, right) => right.score - left.score);

  return {
    primary: ranked[0] ?? null,
    secondary: ranked[1] ?? null
  };
}

function boxDelta(left: CropBox, right: CropBox) {
  return Math.max(
    Math.abs(left.x - right.x),
    Math.abs(left.y - right.y),
    Math.abs(left.width - right.width),
    Math.abs(left.height - right.height)
  );
}

export function createShotPlanner(): ShotPlanner {
  let lastDecision: PlannerDecision | null = null;
  let lastSwitchAt = 0;
  let lastEventAt = 0;
  let lastSoloBeatAt = 0;
  let lastSceneBeatAt = 0;
  let lastDuoBeatAt = 0;
  let lastEnsembleBeatAt = 0;
  let soloVariantIndex = 0;
  let sceneVariantIndex = 0;
  let duoVariantIndex = 0;
  let ensembleVariantIndex = 0;

  return {
    next(input) {
      const visibleTracks = input.tracks.filter((track) => track.visible);
      const holdMs = input.style === "calm" ? 4_000 : 2_400;
      const interruptionThreshold = input.style === "calm" ? 0.88 : 0.8;
      const soloCadenceMs = input.style === "calm" ? 5_400 : 3_400;
      const sceneCadenceMs = input.style === "calm" ? 4_800 : 3_000;
      const duoCadenceMs = input.style === "calm" ? 5_200 : 3_200;
      const ensembleCadenceMs = input.style === "calm" ? 5_600 : 3_600;

      if (visibleTracks.length === 1 && input.timestampMs - lastSoloBeatAt > soloCadenceMs) {
        soloVariantIndex = (soloVariantIndex + 1) % SOLO_VARIANTS.length;
        lastSoloBeatAt = input.timestampMs;
      }

      if (visibleTracks.length === 2 && input.timestampMs - lastDuoBeatAt > duoCadenceMs) {
        duoVariantIndex = (duoVariantIndex + 1) % DUO_VARIANTS.length;
        lastDuoBeatAt = input.timestampMs;
      }

      if (!visibleTracks.length && input.timestampMs - lastSceneBeatAt > sceneCadenceMs) {
        sceneVariantIndex = (sceneVariantIndex + 1) % SCENE_VARIANTS.length;
        lastSceneBeatAt = input.timestampMs;
      }

      if (visibleTracks.length >= 3 && input.timestampMs - lastEnsembleBeatAt > ensembleCadenceMs) {
        ensembleVariantIndex = (ensembleVariantIndex + 1) % ENSEMBLE_VARIANTS.length;
        lastEnsembleBeatAt = input.timestampMs;
      }

      if (visibleTracks.length > 1) {
        lastSoloBeatAt = input.timestampMs;
      }
      if (visibleTracks.length !== 2) {
        lastDuoBeatAt = input.timestampMs;
      }
      if (visibleTracks.length < 3) {
        lastEnsembleBeatAt = input.timestampMs;
      }

      const { primary, secondary } = choosePrimaryTrack(input);
      const overlapScore = clamp(
        (secondary?.score ?? 0) * 0.58 + (visibleTracks.length > 2 ? 0.2 : 0) + input.sceneMotion * 0.12,
        0,
        1
      );
      const sceneEnergy = clamp(
        input.audio.voiceActivity * 0.34 +
          input.sceneMotion * 0.28 +
          (primary?.track.activityScore ?? 0) * 0.14 +
          (primary?.track.speechScore ?? 0) * 0.12 +
          visibleTracks.length * 0.05 +
          overlapScore * 0.1,
        0,
        1
      );

      let proposal:
        | {
            shotType: PlannerDecision["shotType"];
            targetTrackId: string | null;
            cropBox: CropBox;
            confidence: number;
            notes: string | null;
          }
        | null = null;

      if (!primary) {
        const sceneVariant = SCENE_VARIANTS[sceneVariantIndex % SCENE_VARIANTS.length];
        const sceneFallback = computeSceneFallbackCrop(input, sceneVariant);
        proposal = {
          shotType: sceneFallback.shotType,
          targetTrackId: null,
          cropBox: sceneFallback.cropBox,
          confidence: sceneFallback.confidence,
          notes: sceneFallback.notes
        };
      } else if (visibleTracks.length === 1) {
        const soloVariant = SOLO_VARIANTS[soloVariantIndex % SOLO_VARIANTS.length];
        const soloDecision = computeSoloCrop(primary.track, input, soloVariant);
        proposal = {
          shotType: soloDecision.shotType,
          targetTrackId: primary.track.id,
          cropBox: soloDecision.cropBox,
          confidence: soloDecision.confidence,
          notes: soloDecision.notes
        };
      } else if (visibleTracks.length === 2 && overlapScore < 0.66) {
        const duoVariant = DUO_VARIANTS[duoVariantIndex % DUO_VARIANTS.length];
        const duoDecision = computeTwoPersonCrop(visibleTracks, primary.track, input, duoVariant);
        proposal = {
          shotType: duoDecision.shotType,
          targetTrackId: primary.track.id,
          cropBox: duoDecision.cropBox,
          confidence: duoDecision.confidence,
          notes: duoDecision.notes
        };
      } else if (visibleTracks.length >= 3) {
        const ensembleVariant = ENSEMBLE_VARIANTS[ensembleVariantIndex % ENSEMBLE_VARIANTS.length];
        const ensembleDecision = computeEnsembleCrop(visibleTracks, primary.track, input, ensembleVariant);
        proposal = {
          shotType:
            overlapScore > 0.66 || sceneEnergy > 0.76
              ? "wide"
              : primary.score > 0.74 && primary.track.speechScore > 0.44
                ? ensembleDecision.shotType
                : "wide",
          targetTrackId: primary.track.id,
          cropBox:
            overlapScore > 0.66 || sceneEnergy > 0.76
              ? computeWideCrop(input)
              : ensembleDecision.cropBox,
          confidence: clamp(ensembleDecision.confidence + primary.track.speechScore * 0.08 - overlapScore * 0.06, 0.46, 0.9),
          notes:
            overlapScore > 0.66 || sceneEnergy > 0.76
              ? "wide ensemble coverage during overlap or rising scene energy"
              : ensembleDecision.notes
        };
      } else {
        const targetTrackId = primary.track.id;
        let shotType: PlannerDecision["shotType"] = "medium";
        let notes: string | null = "medium on active speaker";

        if (overlapScore > 0.55 || sceneEnergy > 0.72) {
          shotType = "wide";
          notes = "wide for overlap or elevated scene energy";
        } else if (
          primary.score > (input.mode === "interview" ? 0.74 : 0.8) &&
          primary.track.speechScore > 0.4 &&
          input.style === "dynamic"
        ) {
          shotType = "close";
          notes = "close on the most confident speaker";
        }

        proposal = {
          shotType,
          targetTrackId,
          cropBox:
            shotType === "wide"
              ? computeWideCrop(input)
              : computeMultiSpeakerCrop(primary.track, input, shotType),
          confidence: clamp(primary.score * 0.92 + visibleTracks.length * 0.03, 0.42, 0.92),
          notes
        };
      }

      let targetTrackId = proposal.targetTrackId;
      let shotType = proposal.shotType;
      let confidence = proposal.confidence;
      let notes = proposal.notes;
      let nextCrop = proposal.cropBox;

      const proposalWouldInterrupt =
        !!lastDecision &&
        (lastDecision.shotType !== shotType || lastDecision.targetTrackId !== targetTrackId);

      if (
        lastDecision &&
        proposalWouldInterrupt &&
        input.timestampMs - lastSwitchAt < holdMs &&
        confidence < interruptionThreshold &&
        lastDecision.targetTrackId
      ) {
        shotType = lastDecision.shotType;
        targetTrackId = lastDecision.targetTrackId;
        confidence = Math.max(confidence, lastDecision.confidence * 0.92);
        notes = "minimum shot hold";
        nextCrop = lastDecision.cropBox;
      }

      const cropBox = smoothBox(lastDecision?.cropBox ?? null, nextCrop);
      const transition =
        !lastDecision || lastDecision.shotType === shotType
          ? "hold"
          : confidence > 0.9 || sceneEnergy > 0.72
            ? "cut"
            : "ease";

      const decision: PlannerDecision = {
        shotType,
        targetTrackId,
        cropBox,
        confidence,
        transition,
        overlapScore,
        sceneEnergy,
        notes
      };

      const changedShot =
        !lastDecision ||
        lastDecision.shotType !== decision.shotType ||
        lastDecision.targetTrackId !== decision.targetTrackId ||
        boxDelta(lastDecision.cropBox, decision.cropBox) > 0.08;

      const shouldWriteEvent = changedShot && input.timestampMs - lastEventAt > 1_000;

      if (!lastDecision || lastDecision.shotType !== decision.shotType || lastDecision.targetTrackId !== decision.targetTrackId) {
        lastSwitchAt = input.timestampMs;
      }

      lastDecision = decision;

      let timelineEvent: PlannerTimelineEvent | null = null;
      if (shouldWriteEvent) {
        lastEventAt = input.timestampMs;
        timelineEvent = {
          timestampMs: input.timestampMs,
          shotType: decision.shotType,
          targetTrackId: decision.targetTrackId,
          cropBox: decision.cropBox,
          confidence: decision.confidence,
          notes: decision.notes
        };
      }

      return {
        decision,
        timelineEvent
      };
    },
    reset() {
      lastDecision = null;
      lastSwitchAt = 0;
      lastEventAt = 0;
      lastSoloBeatAt = 0;
      lastSceneBeatAt = 0;
      lastDuoBeatAt = 0;
      lastEnsembleBeatAt = 0;
      soloVariantIndex = 0;
      sceneVariantIndex = 0;
      duoVariantIndex = 0;
      ensembleVariantIndex = 0;
    }
  };
}
