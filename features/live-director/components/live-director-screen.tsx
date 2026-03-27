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
  const { videoRef, guideCanvasRef, previewCanvasRef, status, error, decision, audioMetrics, facesDetected, startCamera, startRecording, stopRecording } =
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
    <div className="space-y-4 pb-28">
      <section className="surface-panel overflow-hidden rounded-[32px]">
        <div className="grid gap-5 p-4 md:grid-cols-[1.15fr_0.85fr] md:p-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
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

            <div className="camera-frame aspect-[9/16] min-h-[22rem]">
              <video ref={videoRef} className="hidden" muted playsInline autoPlay />
              <canvas ref={guideCanvasRef} className="h-full w-full object-cover" />
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

          <div className="space-y-4">
            <div className="camera-frame aspect-video">
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
                <CardDescription>Live heuristics for solo scenes, two-shots, speaker emphasis, and environmental composition using audio energy and track stability.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <Sparkles className="h-5 w-5 text-cyan-200" />
                  <div className="text-sm text-slate-200">{decision.notes ?? "Waiting for stable speaker data."}</div>
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
                  The raw view now shows subject guides for every visible face plus a composition grid, while the director preview commits to one cinematic crop at a time.
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
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
