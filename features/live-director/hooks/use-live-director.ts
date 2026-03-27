"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createShotPlanner } from "@/lib/shot-planner/planner";
import { AudioActivityAnalyzer, type AudioMetrics } from "@/lib/audio/speaker-analyzer";
import { createVisionDetector } from "@/lib/vision/detector";
import { trackFaces } from "@/lib/vision/tracker";
import { drawDirectorPreview, drawGuideFrame } from "@/features/live-director/lib/render";
import type { PlannerDecision, PlannerTimelineEvent } from "@/lib/shot-planner/types";
import type { ProjectDetail } from "@/lib/domain/cadris";
import type { FaceTrack } from "@/lib/vision/types";

const DEFAULT_DECISION: PlannerDecision = {
  shotType: "wide",
  targetTrackId: null,
  cropBox: {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  },
  confidence: 0.32,
  transition: "hold",
  overlapScore: 0,
  sceneEnergy: 0,
  notes: "awaiting signal"
};

export interface RecordedSessionPayload {
  blob: Blob;
  durationMs: number;
  metadata: {
    detectorKind: string;
    maxFacesDetected: number;
    averageAudioLevel: number;
    sceneNotes: string[];
  };
  shotEvents: PlannerTimelineEvent[];
}

export function useLiveDirector({
  project,
  showFaceBoxes
}: {
  project: Pick<ProjectDetail, "id" | "mode" | "style" | "title">;
  showFaceBoxes: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioAnalyzerRef = useRef<AudioActivityAnalyzer | null>(null);
  const detectorKindRef = useRef("fallback");
  const detectorRef = useRef<Awaited<ReturnType<typeof createVisionDetector>> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const loopRef = useRef<number | null>(null);
  const plannerRef = useRef(createShotPlanner());
  const tracksRef = useRef<FaceTrack[]>([]);
  const timelineRef = useRef<PlannerTimelineEvent[]>([]);
  const metricsRef = useRef({
    maxFacesDetected: 0,
    cumulativeAudioLevel: 0,
    sampleCount: 0
  });
  const recordStartRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const busyRef = useRef(false);
  const stopResolverRef = useRef<((payload: RecordedSessionPayload | null) => void) | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "ready" | "recording" | "stopping" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<PlannerDecision>(DEFAULT_DECISION);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics>({
    level: 0,
    voiceActivity: 0,
    timestampMs: 0
  });
  const [facesDetected, setFacesDetected] = useState(0);

  const teardown = useCallback(async () => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }

    detectorRef.current?.dispose();
    detectorRef.current = null;

    if (audioAnalyzerRef.current) {
      await audioAnalyzerRef.current.dispose();
      audioAnalyzerRef.current = null;
    }

    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    tracksRef.current = [];
    recordStartRef.current = null;
    isRecordingRef.current = false;
    busyRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const startCamera = useCallback(async () => {
    try {
      setStatus("preparing");
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera APIs are not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Camera view is not ready.");
      }

      video.srcObject = stream;
      await video.play();

      detectorRef.current = await createVisionDetector();
      detectorKindRef.current = detectorRef.current.kind;
      audioAnalyzerRef.current = await AudioActivityAnalyzer.create(stream);
      plannerRef.current.reset();
      timelineRef.current = [];
      metricsRef.current = {
        maxFacesDetected: 0,
        cumulativeAudioLevel: 0,
        sampleCount: 0
      };
      recordStartRef.current = null;
      isRecordingRef.current = false;

      const tick = async (timestampMs: number) => {
        loopRef.current = requestAnimationFrame(tick);
        if (busyRef.current || !videoRef.current || videoRef.current.readyState < 2) {
          return;
        }

        busyRef.current = true;
        try {
          const activeVideo = videoRef.current;
          if (!activeVideo) return;

          const detections = await detectorRef.current?.detect(activeVideo, timestampMs);
          tracksRef.current = trackFaces(tracksRef.current, detections ?? [], timestampMs);
          const nextAudioMetrics =
            audioAnalyzerRef.current?.sample(timestampMs) ?? {
              level: 0,
              voiceActivity: 0,
              timestampMs
            };

          metricsRef.current.maxFacesDetected = Math.max(
            metricsRef.current.maxFacesDetected,
            tracksRef.current.filter((track) => track.visible).length
          );
          metricsRef.current.cumulativeAudioLevel += nextAudioMetrics.level;
          metricsRef.current.sampleCount += 1;

          const plannerStep = plannerRef.current.next({
            frame: {
              width: activeVideo.videoWidth || 1920,
              height: activeVideo.videoHeight || 1080
            },
            timestampMs,
            mode: project.mode,
            style: project.style,
            tracks: tracksRef.current,
            audio: nextAudioMetrics
          });

          if (plannerStep.timelineEvent && isRecordingRef.current && recordStartRef.current !== null) {
            timelineRef.current.push({
              ...plannerStep.timelineEvent,
              timestampMs: Math.max(0, Math.round(plannerStep.timelineEvent.timestampMs - recordStartRef.current))
            });
          }

          setDecision(plannerStep.decision);
          setAudioMetrics(nextAudioMetrics);
          setFacesDetected(tracksRef.current.filter((track) => track.visible).length);

          if (guideCanvasRef.current) {
            drawGuideFrame(activeVideo, guideCanvasRef.current, tracksRef.current, plannerStep.decision, {
              showFaceBoxes
            });
          }

          if (previewCanvasRef.current) {
            drawDirectorPreview(activeVideo, previewCanvasRef.current, plannerStep.decision.cropBox);
          }
        } finally {
          busyRef.current = false;
        }
      };

      loopRef.current = requestAnimationFrame(tick);
      setStatus("ready");
    } catch (cameraError) {
      setStatus("error");
      setError(cameraError instanceof Error ? cameraError.message : "Unable to start camera.");
    }
  }, [project.mode, project.style, showFaceBoxes]);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) {
      throw new Error("Enable camera and microphone first.");
    }

    if (mediaRecorderRef.current?.state === "recording") {
      return;
    }

    const hasLiveAudioTrack = streamRef.current
      .getAudioTracks()
      .some((track) => track.readyState === "live" && track.enabled !== false);

    if (!hasLiveAudioTrack) {
      throw new Error("Microphone track is unavailable. Re-enable camera access and confirm microphone permission.");
    }

    const preferredMimeType = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ].find(
      (mimeType) => MediaRecorder.isTypeSupported(mimeType)
    );

    mediaRecorderRef.current = new MediaRecorder(streamRef.current, preferredMimeType ? { mimeType: preferredMimeType } : undefined);
    chunksRef.current = [];
    timelineRef.current = [
      {
        timestampMs: 0,
        shotType: "wide",
        targetTrackId: null,
        cropBox: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        confidence: 0.25,
        notes: "recording started"
      }
    ];
    recordStartRef.current = performance.now();
    isRecordingRef.current = true;

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.start(750);
    setStatus("recording");
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
      return Promise.resolve(null);
    }

    const recorder = mediaRecorderRef.current;
    isRecordingRef.current = false;
    setStatus("stopping");

    return new Promise<RecordedSessionPayload | null>((resolve) => {
      stopResolverRef.current = resolve;

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationMs = Math.max(0, performance.now() - (recordStartRef.current ?? performance.now()));
        const averageAudioLevel =
          metricsRef.current.sampleCount > 0 ? metricsRef.current.cumulativeAudioLevel / metricsRef.current.sampleCount : 0;

        setStatus("ready");
        recordStartRef.current = null;

        stopResolverRef.current?.({
          blob,
          durationMs,
          metadata: {
            detectorKind: detectorKindRef.current,
            maxFacesDetected: metricsRef.current.maxFacesDetected,
            averageAudioLevel,
            sceneNotes: [
              `mode:${project.mode}`,
              `style:${project.style}`,
              `detector:${detectorKindRef.current}`
            ]
          },
          shotEvents: timelineRef.current
        });
        stopResolverRef.current = null;
      };

      try {
        recorder.requestData();
      } catch {}

      recorder.stop();
    });
  }, [project.mode, project.style]);

  return {
    videoRef,
    guideCanvasRef,
    previewCanvasRef,
    status,
    error,
    decision,
    audioMetrics,
    facesDetected,
    startCamera,
    startRecording,
    stopRecording,
    teardown
  };
}
