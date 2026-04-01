"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioActivityAnalyzer, type AudioMetrics } from "@/lib/audio/speaker-analyzer";
import type { ProjectDetail } from "@/lib/domain/cadris";
import { createShotPlanner } from "@/lib/shot-planner/planner";
import type { PlannerDecision, PlannerTimelineEvent } from "@/lib/shot-planner/types";
import { clamp, lerp } from "@/lib/utils";
import { VisualActivityAnalyzer } from "@/lib/vision/activity";
import { createVisionDetector } from "@/lib/vision/detector";
import { trackFaces } from "@/lib/vision/tracker";
import type { FaceTrack } from "@/lib/vision/types";
import { drawDirectorPreview, drawGuideFrame } from "@/features/live-director/lib/render";

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

const RAW_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4"
];

const DIRECTED_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4"
];

interface DirectedPreviewPayload {
  blob: Blob;
  mimeType: string;
}

export interface LiveDirectorRuntime {
  detectorKind: string;
  detectorState: "idle" | "booting" | "ready" | "tracking" | "reacquiring" | "fallback";
  detectorMessage: string;
  audioState: "idle" | "booting" | "ready" | "active" | "suspended" | "unavailable";
  audioMessage: string;
  directedPreviewSupported: boolean;
  directedPreviewState: "idle" | "supported" | "recording" | "unavailable";
}

export interface RecordedSessionPayload {
  blob: Blob;
  directedPreview: DirectedPreviewPayload | null;
  durationMs: number;
  metadata: {
    detectorKind: string;
    maxFacesDetected: number;
    averageAudioLevel: number;
    averageSceneMotion: number;
    sceneNotes: string[];
  };
  shotEvents: PlannerTimelineEvent[];
}

const DEFAULT_RUNTIME: LiveDirectorRuntime = {
  detectorKind: "fallback",
  detectorState: "idle",
  detectorMessage: "Detector has not started yet.",
  audioState: "idle",
  audioMessage: "Audio analyzer has not started yet.",
  directedPreviewSupported: false,
  directedPreviewState: "idle"
};

function chooseRecorderMimeType(candidates: string[]) {
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function decorateTracks(tracks: FaceTrack[], visualSample: ReturnType<VisualActivityAnalyzer["sample"]>): FaceTrack[] {
  return tracks.map((track) => {
    const metrics = visualSample.perTrack[track.id];
    if (!metrics) {
      return {
        ...track,
        activityScore: clamp(track.activityScore * 0.92, 0, 1),
        speechScore: clamp(track.speechScore * 0.88, 0, 1),
        presenceScore: clamp(track.presenceScore * 0.96, 0, 1)
      };
    }

    return {
      ...track,
      activityScore: clamp(lerp(track.activityScore, metrics.activityScore, track.visible ? 0.62 : 0.2), 0, 1),
      speechScore: clamp(lerp(track.speechScore, metrics.speechScore, track.visible ? 0.58 : 0.18), 0, 1),
      presenceScore: clamp(lerp(track.presenceScore, metrics.presenceScore, 0.42), 0, 1),
      centerBias: clamp(lerp(track.centerBias, metrics.centerBias, 0.4), 0, 1)
    };
  });
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
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const previewCaptureStreamRef = useRef<MediaStream | null>(null);
  const audioAnalyzerRef = useRef<AudioActivityAnalyzer | null>(null);
  const visualAnalyzerRef = useRef<VisualActivityAnalyzer | null>(null);
  const detectorKindRef = useRef("fallback");
  const detectorRef = useRef<Awaited<ReturnType<typeof createVisionDetector>> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const directedRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const directedChunksRef = useRef<Blob[]>([]);
  const loopRef = useRef<number | null>(null);
  const plannerRef = useRef(createShotPlanner());
  const tracksRef = useRef<FaceTrack[]>([]);
  const timelineRef = useRef<PlannerTimelineEvent[]>([]);
  const decisionRef = useRef<PlannerDecision>(DEFAULT_DECISION);
  const metricsRef = useRef({
    maxFacesDetected: 0,
    cumulativeAudioLevel: 0,
    cumulativeSceneMotion: 0,
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
  const [runtime, setRuntime] = useState<LiveDirectorRuntime>(DEFAULT_RUNTIME);

  const disposePreviewCaptureStream = useCallback(() => {
    previewCaptureStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewCaptureStreamRef.current = null;
    directedRecorderRef.current = null;
    directedChunksRef.current = [];
  }, []);

  const disposeRecordingStream = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const teardown = useCallback(async () => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }

    detectorRef.current?.dispose();
    detectorRef.current = null;
    visualAnalyzerRef.current?.dispose();
    visualAnalyzerRef.current = null;

    if (audioAnalyzerRef.current) {
      await audioAnalyzerRef.current.dispose();
      audioAnalyzerRef.current = null;
    }

    disposeRecordingStream();

    disposePreviewCaptureStream();

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    tracksRef.current = [];
    timelineRef.current = [];
    recordStartRef.current = null;
    isRecordingRef.current = false;
    busyRef.current = false;
  }, [disposePreviewCaptureStream, disposeRecordingStream]);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const startCamera = useCallback(async () => {
    try {
      setStatus("preparing");
      setError(null);
      setRuntime({
        ...DEFAULT_RUNTIME,
        detectorState: "booting",
        detectorMessage: "Booting face detection...",
        audioState: "booting",
        audioMessage: "Booting audio analyzer..."
      });

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
      await audioAnalyzerRef.current.resume();
      visualAnalyzerRef.current = new VisualActivityAnalyzer();
      plannerRef.current.reset();
      timelineRef.current = [];
      decisionRef.current = DEFAULT_DECISION;
      setDecision(DEFAULT_DECISION);
      metricsRef.current = {
        maxFacesDetected: 0,
        cumulativeAudioLevel: 0,
        cumulativeSceneMotion: 0,
        sampleCount: 0
      };
      recordStartRef.current = null;
      isRecordingRef.current = false;
      tracksRef.current = [];
      setFacesDetected(0);
      setRuntime({
        detectorKind: detectorKindRef.current,
        detectorState: "ready",
        detectorMessage: `${detectorKindRef.current} initialized and waiting for faces.`,
        audioState: audioAnalyzerRef.current.getState() === "running" ? "ready" : "suspended",
        audioMessage:
          audioAnalyzerRef.current.getState() === "running"
            ? "Audio analyzer is listening."
            : "Audio context is suspended. A fresh tap will resume it.",
        directedPreviewSupported: !!previewCanvasRef.current && typeof previewCanvasRef.current.captureStream === "function",
        directedPreviewState:
          previewCanvasRef.current && typeof previewCanvasRef.current.captureStream === "function"
            ? "supported"
            : "unavailable"
      });

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
          const trackedFaces = trackFaces(tracksRef.current, detections ?? [], timestampMs);
          const visualSample = visualAnalyzerRef.current?.sample(activeVideo, trackedFaces) ?? {
            sceneMotion: 0,
            perTrack: {}
          };

          tracksRef.current = decorateTracks(trackedFaces, visualSample);

          const nextAudioMetrics =
            audioAnalyzerRef.current?.sample(timestampMs) ?? {
              level: 0,
              voiceActivity: 0,
              timestampMs
            };
          const audioContextState = audioAnalyzerRef.current?.getState() ?? "suspended";
          const hasAudioSignal = nextAudioMetrics.voiceActivity > 0.05 || nextAudioMetrics.level > 0.025;
          const visibleFaces = tracksRef.current.filter((track) => track.visible).length;

          metricsRef.current.maxFacesDetected = Math.max(
            metricsRef.current.maxFacesDetected,
            visibleFaces
          );
          metricsRef.current.cumulativeAudioLevel += nextAudioMetrics.level;
          metricsRef.current.cumulativeSceneMotion += visualSample.sceneMotion;
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
            audio: nextAudioMetrics,
            sceneMotion: visualSample.sceneMotion
          });

          if (plannerStep.timelineEvent && isRecordingRef.current && recordStartRef.current !== null) {
            timelineRef.current.push({
              ...plannerStep.timelineEvent,
              timestampMs: Math.max(0, Math.round(plannerStep.timelineEvent.timestampMs - recordStartRef.current))
            });
          }

          decisionRef.current = plannerStep.decision;
          setDecision(plannerStep.decision);
          setAudioMetrics(nextAudioMetrics);
          setFacesDetected(visibleFaces);
          setRuntime((current) => ({
            ...current,
            detectorKind: detectorKindRef.current,
            detectorState:
              visibleFaces > 0
                ? "tracking"
                : detectorKindRef.current === "fallback"
                  ? "fallback"
                  : "reacquiring",
            detectorMessage:
              visibleFaces > 0
                ? `${detectorKindRef.current} tracking ${visibleFaces} face${visibleFaces === 1 ? "" : "s"}.`
                : detectorKindRef.current === "fallback"
                  ? "No supported live face detector is available in this browser."
                  : `${detectorKindRef.current} is running but currently reacquiring faces.`,
            audioState:
              audioContextState !== "running"
                ? "suspended"
                : hasAudioSignal
                  ? "active"
                  : "ready",
            audioMessage:
              audioContextState !== "running"
                ? "Audio context is suspended."
                : hasAudioSignal
                  ? "Live audio activity detected."
                  : "Audio analyzer is listening but the current signal is quiet.",
            directedPreviewState:
              directedRecorderRef.current?.state === "recording"
                ? "recording"
                : current.directedPreviewSupported
                  ? "supported"
                  : "unavailable"
          }));

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
      setRuntime({
        ...DEFAULT_RUNTIME,
        detectorState: "fallback",
        detectorMessage: "Unable to start live detection.",
        audioState: "unavailable",
        audioMessage: cameraError instanceof Error ? cameraError.message : "Audio analyzer could not start."
      });
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

    await audioAnalyzerRef.current?.resume();

    const recordingStream = new MediaStream();
    const recordingVideoTrack = streamRef.current.getVideoTracks()[0]?.clone() ?? null;
    const recordingAudioTrack =
      audioAnalyzerRef.current?.createRecordingTrack() ??
      streamRef.current.getAudioTracks()[0]?.clone() ??
      null;

    if (!recordingAudioTrack) {
      setRuntime((current) => ({
        ...current,
        audioState: "unavailable",
        audioMessage: "Microphone track could not be prepared for recording."
      }));
      throw new Error("Microphone track could not be prepared for recording. Re-enable camera and microphone access.");
    }

    if (recordingVideoTrack) {
      recordingStream.addTrack(recordingVideoTrack);
    }

    if (recordingAudioTrack) {
      recordingStream.addTrack(recordingAudioTrack);
    }

    const rawMimeType = chooseRecorderMimeType(RAW_MIME_CANDIDATES);
    recordingStreamRef.current = recordingStream;
    mediaRecorderRef.current = new MediaRecorder(recordingStream, rawMimeType ? { mimeType: rawMimeType } : undefined);
    chunksRef.current = [];

    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas && typeof previewCanvas.captureStream === "function") {
      const canvasStream = previewCanvas.captureStream(30);
      const directedStream = new MediaStream();
      const previewVideoTrack = canvasStream.getVideoTracks()[0];

      if (previewVideoTrack) {
        directedStream.addTrack(previewVideoTrack);
      }

      const directedAudioTrack =
        audioAnalyzerRef.current?.createRecordingTrack() ??
        streamRef.current.getAudioTracks()[0]?.clone() ??
        null;

      if (directedAudioTrack) {
        directedStream.addTrack(directedAudioTrack);
      }

      if (directedStream.getVideoTracks().length) {
        previewCaptureStreamRef.current = directedStream;
        const directedMimeType = chooseRecorderMimeType(DIRECTED_MIME_CANDIDATES);
        directedRecorderRef.current = new MediaRecorder(directedStream, directedMimeType ? { mimeType: directedMimeType } : undefined);
        directedChunksRef.current = [];
        directedRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            directedChunksRef.current.push(event.data);
          }
        };
      }
    }

    setRuntime((current) => ({
      ...current,
      audioState: audioAnalyzerRef.current?.getState() === "running" ? "ready" : "suspended",
      audioMessage:
        audioAnalyzerRef.current?.getState() === "running"
          ? recordingAudioTrack
            ? "Audio analyzer is running and the recording track is armed."
            : "Audio analyzer is running, but the recording track could not be prepared."
          : "Audio context is suspended. Browser interaction is still required.",
      directedPreviewSupported: !!previewCanvas && typeof previewCanvas.captureStream === "function",
      directedPreviewState:
        !!previewCanvas && typeof previewCanvas.captureStream === "function" ? "recording" : "unavailable"
    }));

    const initialDecision = decisionRef.current;
    timelineRef.current = [
      {
        timestampMs: 0,
        shotType: initialDecision.shotType,
        targetTrackId: initialDecision.targetTrackId,
        cropBox: initialDecision.cropBox,
        confidence: initialDecision.confidence,
        notes: initialDecision.notes ?? "recording started"
      }
    ];
    recordStartRef.current = performance.now();
    isRecordingRef.current = true;

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.start(250);
    directedRecorderRef.current?.start(500);
    setStatus("recording");
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
      return Promise.resolve(null);
    }

    const recorder = mediaRecorderRef.current;
    const directedRecorder = directedRecorderRef.current?.state === "recording" ? directedRecorderRef.current : null;
    const stoppedAt = performance.now();

    if (recordStartRef.current !== null) {
      const finalTimestampMs = Math.max(0, Math.round(stoppedAt - recordStartRef.current));
      const lastEvent = timelineRef.current[timelineRef.current.length - 1];

      if (!lastEvent || Math.abs(lastEvent.timestampMs - finalTimestampMs) > 900) {
        timelineRef.current.push({
          timestampMs: finalTimestampMs,
          shotType: decisionRef.current.shotType,
          targetTrackId: decisionRef.current.targetTrackId,
          cropBox: decisionRef.current.cropBox,
          confidence: decisionRef.current.confidence,
          notes: decisionRef.current.notes
        });
      }
    }

    isRecordingRef.current = false;
    setStatus("stopping");

    return new Promise<RecordedSessionPayload | null>((resolve) => {
      stopResolverRef.current = resolve;

      let pendingStops = directedRecorder ? 2 : 1;
      let rawBlob: Blob | null = null;
      let directedPreview: DirectedPreviewPayload | null = null;

      const finalize = () => {
        pendingStops -= 1;
        if (pendingStops > 0 || !rawBlob) {
          return;
        }

        const durationMs = Math.max(0, stoppedAt - (recordStartRef.current ?? stoppedAt));
        const averageAudioLevel =
          metricsRef.current.sampleCount > 0 ? metricsRef.current.cumulativeAudioLevel / metricsRef.current.sampleCount : 0;
        const averageSceneMotion =
          metricsRef.current.sampleCount > 0 ? metricsRef.current.cumulativeSceneMotion / metricsRef.current.sampleCount : 0;

        setStatus("ready");
        recordStartRef.current = null;
        disposeRecordingStream();
        disposePreviewCaptureStream();
        setRuntime((current) => ({
          ...current,
          directedPreviewState: current.directedPreviewSupported ? "supported" : "unavailable"
        }));

        stopResolverRef.current?.({
          blob: rawBlob,
          directedPreview,
          durationMs,
          metadata: {
            detectorKind: detectorKindRef.current,
            maxFacesDetected: metricsRef.current.maxFacesDetected,
            averageAudioLevel,
            averageSceneMotion,
            sceneNotes: [
              `mode:${project.mode}`,
              `style:${project.style}`,
              `detector:${detectorKindRef.current}`,
              `preview:${directedPreview ? "captured" : "unavailable"}`
            ]
          },
          shotEvents: timelineRef.current
        });
        stopResolverRef.current = null;
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        rawBlob = new Blob(chunksRef.current, { type: mimeType });
        finalize();
      };

      if (directedRecorder) {
        directedRecorder.onstop = () => {
          const mimeType = directedRecorder.mimeType || "video/webm";
          directedPreview =
            directedChunksRef.current.length > 0
              ? {
                  blob: new Blob(directedChunksRef.current, { type: mimeType }),
                  mimeType
                }
              : null;
          finalize();
        };
      }

      try {
        recorder.requestData();
      } catch {}

      if (directedRecorder) {
        try {
          directedRecorder.requestData();
        } catch {}
      }

      recorder.stop();
      directedRecorder?.stop();
    });
  }, [disposePreviewCaptureStream, disposeRecordingStream, project.mode, project.style]);

  return {
    videoRef,
    guideCanvasRef,
    previewCanvasRef,
    status,
    error,
    decision,
    audioMetrics,
    facesDetected,
    runtime,
    startCamera,
    startRecording,
    stopRecording,
    teardown
  };
}
