"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CropBox, ShotEventSummary, ShotType } from "@/lib/domain/cadris";
import { clamp, formatClock } from "@/lib/utils";

interface DirectedSegment {
  id: string;
  shotType: ShotType;
  targetTrackId: string | null;
  startsAtMs: number;
  endsAtMs: number;
  notes: string | null;
  cropBox: CropBox;
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function buildSegments(shotEvents: ShotEventSummary[], durationMs: number): DirectedSegment[] {
  const filteredEvents = [...shotEvents]
    .filter((event) => Number.isFinite(event.timestampMs) && event.timestampMs >= 0 && event.timestampMs <= durationMs + 250)
    .sort((left, right) => left.timestampMs - right.timestampMs);

  const normalizedEvents =
    filteredEvents.length > 0 && filteredEvents[0].timestampMs === 0
      ? filteredEvents
      : [
          {
            id: "directed-default",
            projectId: "",
            timestampMs: 0,
            shotType: "wide" as const,
            targetTrackId: null,
            cropX: 0,
            cropY: 0,
            cropWidth: 1,
            cropHeight: 1,
            confidence: 0.2,
            notes: "fallback wide playback",
            createdAt: new Date(0).toISOString()
          },
          ...filteredEvents
        ];

  return normalizedEvents.map((event, index) => {
    const nextEvent = normalizedEvents[index + 1];

    return {
      id: event.id,
      shotType: event.shotType,
      targetTrackId: event.targetTrackId,
      startsAtMs: clamp(event.timestampMs, 0, durationMs),
      endsAtMs: clamp(nextEvent?.timestampMs ?? durationMs, 0, durationMs),
      notes: event.notes,
      cropBox: {
        x: clamp(event.cropX, 0, 1),
        y: clamp(event.cropY, 0, 1),
        width: clamp(event.cropWidth, 0.1, 1),
        height: clamp(event.cropHeight, 0.1, 1)
      }
    };
  });
}

function findActiveSegment(segments: DirectedSegment[], timestampMs: number) {
  let activeSegment = segments[0] ?? null;

  for (const segment of segments) {
    if (timestampMs >= segment.startsAtMs) {
      activeSegment = segment;
    } else {
      break;
    }
  }

  return activeSegment;
}

export function DirectedSessionPlayer({
  recordingUrl,
  durationMs,
  shotEvents
}: {
  recordingUrl: string;
  durationMs: number;
  shotEvents: ShotEventSummary[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [resolvedDurationMs, setResolvedDurationMs] = useState(durationMs);
  const segments = useMemo(() => buildSegments(shotEvents, Math.max(durationMs, 1)), [durationMs, shotEvents]);

  const activeSegment = useMemo(
    () => findActiveSegment(segments, currentTimeMs) ?? segments[0] ?? null,
    [currentTimeMs, segments]
  );

  function stopAnimationLoop() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function drawFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const outputWidth = 1080;
    const outputHeight = 607;
    resizeCanvas(canvas, outputWidth, outputHeight);

    const currentSegment = findActiveSegment(segments, video.currentTime * 1000) ?? segments[0];
    const cropBox = currentSegment?.cropBox ?? {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    };
    const sourceX = cropBox.x * video.videoWidth;
    const sourceY = cropBox.y * video.videoHeight;
    const sourceWidth = cropBox.width * video.videoWidth;
    const sourceHeight = cropBox.height * video.videoHeight;

    context.clearRect(0, 0, outputWidth, outputHeight);
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

    context.fillStyle = "rgba(5, 8, 22, 0.72)";
    context.fillRect(18, 18, 260, 74);
    context.fillStyle = "#eef2ff";
    context.font = "600 20px Space Grotesk, sans-serif";
    context.fillText(`${currentSegment?.shotType?.toUpperCase() ?? "WIDE"} PLAYBACK`, 30, 46);
    context.font = "400 15px Space Grotesk, sans-serif";
    context.fillStyle = "#b8c2d9";
    context.fillText(currentSegment?.notes ?? "directed preview", 30, 68);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setResolvedDurationMs(Math.round(video.duration * 1000));
      }
      drawFrame();
    };

    const handlePlay = () => {
      setIsPlaying(true);

      const tick = () => {
        if (!videoRef.current) {
          return;
        }

        setCurrentTimeMs(videoRef.current.currentTime * 1000);
        drawFrame();

        if (!videoRef.current.paused && !videoRef.current.ended) {
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      };

      stopAnimationLoop();
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    const handlePause = () => {
      setIsPlaying(false);
      stopAnimationLoop();
      setCurrentTimeMs(video.currentTime * 1000);
      drawFrame();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      stopAnimationLoop();
      setCurrentTimeMs(resolvedDurationMs);
      drawFrame();
    };

    const handleSeeked = () => {
      setCurrentTimeMs(video.currentTime * 1000);
      drawFrame();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("seeked", handleSeeked);

    return () => {
      stopAnimationLoop();
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [resolvedDurationMs, segments]);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
      return;
    }

    video.pause();
  }

  function handleScrub(nextValue: number) {
    const video = videoRef.current;
    if (!video) return;

    const nextTimeSeconds = nextValue / 1000;
    video.currentTime = nextTimeSeconds;
    setCurrentTimeMs(nextValue);
    drawFrame();
  }

  return (
    <div className="space-y-4">
      <div className="camera-frame aspect-video">
        <video
          ref={videoRef}
          src={recordingUrl}
          crossOrigin="anonymous"
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
        />
        <canvas ref={canvasRef} className="h-full w-full object-cover" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-slate-950/74 px-3 py-2 text-xs tracking-[0.24em] text-cyan-100 uppercase">
          <WandSparkles className="h-3.5 w-3.5" />
          Directed Preview
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void togglePlayback()}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? "Pause" : "Play directed"}
        </Button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(resolvedDurationMs, 1)}
            value={Math.min(currentTimeMs, resolvedDurationMs)}
            onChange={(event) => handleScrub(Number(event.target.value))}
            className="w-full accent-cyan-300"
          />
        </div>
        <div className="text-sm text-slate-400">
          {formatClock(currentTimeMs)} / {formatClock(resolvedDurationMs)}
        </div>
      </div>

      {activeSegment ? (
        <div className="surface-muted flex items-center justify-between gap-3 rounded-3xl p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge>{activeSegment.shotType}</Badge>
              <span className="text-sm text-slate-300">
                {activeSegment.targetTrackId ? `track ${activeSegment.targetTrackId}` : "scene frame"}
              </span>
            </div>
            <div className="text-xs text-slate-500">{activeSegment.notes ?? "directed crop playback"}</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{formatClock(activeSegment.startsAtMs)} - {formatClock(activeSegment.endsAtMs)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
