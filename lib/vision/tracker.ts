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

function estimateStability(distance: number, size: number) {
  return clamp(1 - distance / Math.max(size, 1), 0, 1);
}

export function trackFaces(previousTracks: FaceTrack[], detections: DetectedFace[], timestampMs: number): FaceTrack[] {
  const nextTracks: FaceTrack[] = [];
  const remainingTracks = [...previousTracks];

  for (const detection of detections) {
    const detectionCenter = getCenter(detection.box);

    let matchedTrackIndex = -1;
    let matchedDistance = Number.POSITIVE_INFINITY;

    remainingTracks.forEach((track, index) => {
      const distance = getDistance(getCenter(track.box), detectionCenter);
      const sizeDelta = Math.abs(getBoxSize(track.box) - getBoxSize(detection.box)) / Math.max(getBoxSize(track.box), getBoxSize(detection.box));
      const matchScore = distance / Math.max(getBoxSize(track.box), getBoxSize(detection.box), 1) + sizeDelta * 0.7;

      if (matchScore < matchedDistance) {
        matchedDistance = matchScore;
        matchedTrackIndex = index;
      }
    });

    if (matchedTrackIndex >= 0 && matchedDistance < 1.8) {
      const matchedTrack = remainingTracks.splice(matchedTrackIndex, 1)[0];
      const previousCenter = getCenter(matchedTrack.box);
      const smoothedBox = {
        x: lerp(matchedTrack.box.x, detection.box.x, 0.58),
        y: lerp(matchedTrack.box.y, detection.box.y, 0.58),
        width: lerp(matchedTrack.box.width, detection.box.width, 0.52),
        height: lerp(matchedTrack.box.height, detection.box.height, 0.52)
      };
      const smoothedCenter = getCenter(smoothedBox);
      const distance = getDistance(previousCenter, detectionCenter);
      const boxSize = getBoxSize(matchedTrack.box);

      nextTracks.push({
        ...matchedTrack,
        box: smoothedBox,
        confidence: clamp(matchedTrack.confidence * 0.45 + detection.confidence * 0.55, 0, 1),
        lastSeenAt: timestampMs,
        motionScore: clamp(distance / Math.max(boxSize, 1), 0, 1),
        stability: estimateStability(distance, boxSize),
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
        velocity: { x: 0, y: 0 },
        stability: 0.45,
        visible: true
      });
    }
  }

  for (const track of remainingTracks) {
    if (timestampMs - track.lastSeenAt < 1_500) {
      nextTracks.push({
        ...track,
        visible: false,
        motionScore: 0,
        stability: clamp(track.stability - 0.05, 0, 1)
      });
    }
  }

  return nextTracks
    .filter((track) => timestampMs - track.lastSeenAt < 1_500)
    .sort((left, right) => right.confidence - left.confidence);
}
