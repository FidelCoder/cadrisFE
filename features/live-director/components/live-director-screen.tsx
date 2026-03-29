"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Mic, Save, Sparkles, Square, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clientApiFetch } from "@/lib/api/client";
import { useCadrisStore } from "@/stores/use-cadris-store";
import { formatPercent } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/domain/cadris";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { useLiveDirector } from "@/features/live-director/hooks/use-live-director";

function fileExtensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogv";
  return "webm";
}

export function LiveDirectorScreen({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const { showFaceBoxes } = useCadrisStore();
  const {
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
    stopRecording
  } =
    useLiveDirector({
      project,
      showFaceBoxes
    });

  const summaryStats = useMemo(
    () => [
      {
        label: "Shot",
        value: decision.shotType
      },
      {
        label: "Faces",
        value: `${facesDetected}`
      },
      {
        label: "Voice activity",
        value: formatPercent(audioMetrics.voiceActivity)
      },
      {
        label: "Confidence",
        value: formatPercent(decision.confidence)
      }
    ],
    [audioMetrics.voiceActivity, decision.confidence, decision.shotType, facesDetected]
  );

  async function saveRecording() {
    try {
      const payload = await stopRecording();
      if (!payload) {
        toast.message("Recording is not active.");
        return;
      }

      setIsUploading(true);
      const extension = fileExtensionForMimeType(payload.blob.type);
      const formData = new FormData();
      formData.append("video", new File([payload.blob], `${project.title || "cadris-session"}.${extension}`, { type: payload.blob.type }));
      if (payload.directedPreview) {
        const directedExtension = fileExtensionForMimeType(payload.directedPreview.mimeType);
        formData.append(
          "directedVideo",
          new File([payload.directedPreview.blob], `${project.title || "cadris-session"}-directed.${directedExtension}`, {
            type: payload.directedPreview.mimeType
          })
        );
      }
      formData.append("durationMs", String(Math.round(payload.durationMs)));
      formData.append("metadataJson", JSON.stringify(payload.metadata));
      formData.append("shotEventsJson", JSON.stringify(payload.shotEvents));

      await clientApiFetch(`/api/projects/${project.id}/recordings`, {
        method: "POST",
        body: formData
      });

      toast.success("Recording saved. Opening review.");
      router.push(`/projects/${project.id}`);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save recording.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="h-full overflow-hidden bg-[#03050f]">
      <section className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.9rem)] md:hidden">
          <div>
            <div className="text-sm tracking-[0.24em] text-cyan-200 uppercase">Cadris Live</div>
            <div className="text-lg font-semibold">{project.title}</div>
          </div>
          <div className="surface-muted rounded-2xl px-3 py-2 text-right text-[11px] text-slate-400">
            <div>{project.mode}</div>
            <div>{project.style}</div>
          </div>
        </div>

        <div className="grid h-full min-h-0 gap-3 px-3 pb-[max(env(safe-area-inset-bottom),0.9rem)] md:grid-cols-[1.15fr_0.85fr] md:gap-5 md:p-5">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="hidden items-start justify-between gap-4 md:flex">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Badge>Cadris Live Director</Badge>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <h1 className="text-2xl font-semibold">{project.title}</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Keep every person inside the raw frame. Cadris will compose solo scenes, shared conversation frames, and environmental beats while preserving the untouched source recording.
                </p>
              </div>
              <div className="surface-muted rounded-3xl px-3 py-2 text-right text-xs text-slate-400">
                <div>{project.mode}</div>
                <div>{project.style}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:hidden">
              <div className="surface-muted rounded-2xl px-3 py-2 text-[11px] text-slate-300">
                <div className="text-slate-500 uppercase">Vision</div>
                <div className="mt-1 font-medium text-white">{runtime.detectorState}</div>
                <div className="mt-1 text-slate-500">{runtime.detectorKind}</div>
              </div>
              <div className="surface-muted rounded-2xl px-3 py-2 text-[11px] text-slate-300">
                <div className="text-slate-500 uppercase">Audio</div>
                <div className="mt-1 font-medium text-white">{runtime.audioState}</div>
                <div className="mt-1 text-slate-500">{formatPercent(audioMetrics.level)}</div>
              </div>
              <div className="surface-muted rounded-2xl px-3 py-2 text-[11px] text-slate-300">
                <div className="text-slate-500 uppercase">Faces</div>
                <div className="mt-1 font-medium text-white">{facesDetected}</div>
                <div className="mt-1 text-slate-500">{decision.shotType}</div>
              </div>
            </div>

            <div className="camera-frame relative min-h-0 flex-1">
              <video
                ref={videoRef}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                muted
                playsInline
                autoPlay
              />
              <canvas ref={guideCanvasRef} className="h-full w-full object-cover" />
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <Badge className="border-cyan-300/20 bg-slate-950/80 text-cyan-100">{runtime.detectorKind}</Badge>
                <Badge
                  className={
                    runtime.detectorState === "tracking"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : runtime.detectorState === "reacquiring"
                        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
                        : "border-white/10 bg-slate-950/80 text-slate-200"
                  }
                >
                  Vision {runtime.detectorState}
                </Badge>
                <Badge
                  className={
                    runtime.audioState === "active"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : runtime.audioState === "suspended" || runtime.audioState === "unavailable"
                        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
                        : "border-white/10 bg-slate-950/80 text-slate-200"
                  }
                >
                  Audio {runtime.audioState}
                </Badge>
              </div>
              {status === "idle" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/72 px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-300/12 text-cyan-200">
                    <Camera className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Enable camera and mic</div>
                    <div className="mt-2 text-sm text-slate-400">
                      Cadris needs live video and audio access to plan shots in real time.
                    </div>
                  </div>
                  <Button onClick={() => void startCamera()}>Enable camera</Button>
                </div>
              ) : null}
              {status === "preparing" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/72 text-sm text-slate-200">
                  Preparing camera pipeline...
                </div>
              ) : null}
              {status === "stopping" ? (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-slate-950/72 px-4 py-3 text-sm text-cyan-100">
                  Recording stopped. Finalizing capture...
                </div>
              ) : null}
              {status === "error" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/72 px-8 text-center text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden md:overflow-y-auto md:pr-1">
            <div className="camera-frame aspect-[16/8] min-h-[7.5rem] md:aspect-video">
              <canvas ref={previewCanvasRef} className="h-full w-full object-cover" />
              <div className="absolute left-4 top-4 rounded-full bg-slate-950/74 px-3 py-2 text-xs tracking-[0.24em] text-cyan-100 uppercase">
                Director Output
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {summaryStats.map((item) => (
                <Card key={item.label} className="rounded-[24px]">
                  <CardContent className="space-y-1 p-4">
                    <div className="text-xs tracking-[0.24em] text-slate-500 uppercase">{item.label}</div>
                    <div className="text-lg font-semibold capitalize">{item.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="rounded-[28px]">
              <CardHeader className="pb-3">
                <CardTitle>Shot planner</CardTitle>
                <CardDescription>
                  Live heuristics for solo scenes, two-shots, speaker emphasis, and environmental composition. The runtime status below now shows whether vision and audio are actually active.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <Sparkles className="h-5 w-5 text-cyan-200" />
                  <div className="text-sm text-slate-200">{decision.notes ?? "Waiting for stable speaker data."}</div>
                </div>
                <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-1">
                  <div className="surface-muted rounded-3xl p-4">
                    <div className="mb-1 text-xs tracking-[0.22em] text-slate-500 uppercase">Vision runtime</div>
                    <div className="text-sm font-medium text-white">{runtime.detectorMessage}</div>
                  </div>
                  <div className="surface-muted rounded-3xl p-4">
                    <div className="mb-1 text-xs tracking-[0.22em] text-slate-500 uppercase">Audio runtime</div>
                    <div className="text-sm font-medium text-white">{runtime.audioMessage}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <div className="surface-muted rounded-3xl p-4">
                    <div className="mb-1 flex items-center gap-2 text-slate-400">
                      <Mic className="h-4 w-4" />
                      Audio level
                    </div>
                    <div className="text-lg font-semibold">{formatPercent(audioMetrics.level)}</div>
                  </div>
                  <div className="surface-muted rounded-3xl p-4">
                    <div className="mb-1 flex items-center gap-2 text-slate-400">
                      <Waves className="h-4 w-4" />
                      Scene energy
                    </div>
                    <div className="text-lg font-semibold">{formatPercent(decision.sceneEnergy)}</div>
                  </div>
                </div>
                <div className="surface-muted rounded-3xl p-4 text-sm text-slate-300">
                  The raw view shows subject guides for every visible face plus a composition grid. The pipeline badges above should flip into active states when detection and audio are genuinely running.
                </div>
              </CardContent>
            </Card>

            <div className="mt-auto grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void startRecording()}
                disabled={status !== "ready"}
              >
                <Square className="h-4 w-4" />
                Start recording
              </Button>
              <Button
                className="w-full"
                onClick={() => void saveRecording()}
                disabled={status !== "recording" || isUploading}
              >
                <Save className="h-4 w-4" />
                {status === "stopping" ? "Stopping..." : isUploading ? "Saving..." : "Stop recording"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
