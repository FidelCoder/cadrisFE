import { clamp, lerp } from "@/lib/utils";
import type { DetectedFace, FaceTrack } from "@/lib/vision/types";

function getCenter(box: FaceTrack["box"] | DetectedFace["box"]) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

function getDistance(a: ReturnType<typeof getCenter>, b: ReturnType<typeof getCenter>) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getBoxSize(box: FaceTrack["box"] | DetectedFace["box"]) {
  return Math.max(box.width, box.height, 1);
}

function getOverlapRatio(left: FaceTrack["box"] | DetectedFace["box"], right: FaceTrack["box"] | DetectedFace["box"]) {
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

function estimateStability(distance: number, size: number, overlapRatio: number) {
  return clamp(1 - distance / Math.max(size, 1) + overlapRatio * 0.28, 0, 1);
}

export function trackFaces(previousTracks: FaceTrack[], detections: DetectedFace[], timestampMs: number): FaceTrack[] {
  const nextTracks: FaceTrack[] = [];
  const remainingTracks = [...previousTracks].sort((left, right) => right.confidence - left.confidence);
  const orderedDetections = [...detections].sort((left, right) => right.confidence - left.confidence);

  for (const detection of orderedDetections) {
    const detectionCenter = getCenter(detection.box);

    let matchedTrackIndex = -1;
    let matchedScore = Number.POSITIVE_INFINITY;

    remainingTracks.forEach((track, index) => {
      const trackCenter = getCenter(track.box);
      const distance = getDistance(trackCenter, detectionCenter);
      const overlapRatio = getOverlapRatio(track.box, detection.box);
      const sizeDelta =
        Math.abs(getBoxSize(track.box) - getBoxSize(detection.box)) /
        Math.max(getBoxSize(track.box), getBoxSize(detection.box));
      const recencyPenalty = clamp((timestampMs - track.lastSeenAt) / 1_500, 0, 1) * 0.18;
      const matchScore =
        distance / Math.max(getBoxSize(track.box), getBoxSize(detection.box), 1) * 0.52 +
        sizeDelta * 0.2 +
        (1 - overlapRatio) * 0.28 +
        recencyPenalty;

      if (matchScore < matchedScore) {
        matchedScore = matchScore;
        matchedTrackIndex = index;
      }
    });

    if (matchedTrackIndex >= 0 && matchedScore < 1.18) {
      const matchedTrack = remainingTracks.splice(matchedTrackIndex, 1)[0];
      const previousCenter = getCenter(matchedTrack.box);
      const overlapRatio = getOverlapRatio(matchedTrack.box, detection.box);
      const smoothedBox = {
        x: lerp(matchedTrack.box.x, detection.box.x, 0.46),
        y: lerp(matchedTrack.box.y, detection.box.y, 0.46),
        width: lerp(matchedTrack.box.width, detection.box.width, 0.38),
        height: lerp(matchedTrack.box.height, detection.box.height, 0.38)
      };
      const smoothedCenter = getCenter(smoothedBox);
      const distance = getDistance(previousCenter, detectionCenter);
      const boxSize = getBoxSize(matchedTrack.box);

      nextTracks.push({
        ...matchedTrack,
        box: smoothedBox,
        confidence: clamp(matchedTrack.confidence * 0.5 + detection.confidence * 0.5 + overlapRatio * 0.08, 0, 1),
        lastSeenAt: timestampMs,
        motionScore: clamp(distance / Math.max(boxSize, 1), 0, 1),
        stability: estimateStability(distance, boxSize, overlapRatio),
        velocity: {
          x: smoothedCenter.x - previousCenter.x,
          y: smoothedCenter.y - previousCenter.y
        },
        visible: true
      });
    } else {
      nextTracks.push({
        id: `track-${Math.random().toString(36).slice(2, 9)}`,
        box: detection.box,
        confidence: detection.confidence,
        lastSeenAt: timestampMs,
        firstSeenAt: timestampMs,
        motionScore: 0,
        activityScore: 0,
        speechScore: 0,
        presenceScore: 0,
        centerBias: 0.5,
        velocity: { x: 0, y: 0 },
        stability: 0.52,
        visible: true
      });
    }
  }

  for (const track of remainingTracks) {
    if (timestampMs - track.lastSeenAt < 1_800) {
      nextTracks.push({
        ...track,
        visible: false,
        motionScore: 0,
        activityScore: clamp(track.activityScore * 0.9, 0, 1),
        speechScore: clamp(track.speechScore * 0.86, 0, 1),
        presenceScore: clamp(track.presenceScore * 0.95, 0, 1),
        stability: clamp(track.stability - 0.04, 0, 1)
      });
    }
  }

  return nextTracks
    .filter((track) => timestampMs - track.lastSeenAt < 1_800)
    .sort((left, right) => right.confidence - left.confidence);
}
