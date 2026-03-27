import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Film, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiReviewPanel } from "@/features/projects/components/ai-review-panel";
import { DirectedSessionPlayer } from "@/features/projects/components/directed-session-player";
import { ReviewTimeline } from "@/features/projects/components/review-timeline";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { formatClock, formatRelative } from "@/lib/utils";
import { serverApiFetch } from "@/lib/api/server";
import { withApiBaseUrl } from "@/lib/api/base-url";
import type { ProjectDetail } from "@/lib/domain/cadris";

export default async function ProjectReviewPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let project: ProjectDetail | null = null;

  try {
    project = await serverApiFetch<ProjectDetail>(`/api/projects/${projectId}`);
  } catch {
    project = null;
  }

  if (!project) {
    notFound();
  }

  const latestRecording = project.recordings[0];

  return (
    <div className="space-y-5 pb-28">
      <section className="surface-panel rounded-[32px] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge>Review</Badge>
              <ProjectStatusBadge status={project.status} />
            </div>
            <h1 className="text-3xl font-semibold">{project.title}</h1>
            <p className="text-sm text-slate-400">
              Saved {project.mode} session using the {project.style} directing profile. Original footage remains untouched and all shot choices stay editable in metadata.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-80">
            <Card className="rounded-[24px]">
              <CardContent className="p-4">
                <div className="text-xs tracking-[0.24em] text-slate-500 uppercase">Duration</div>
                <div className="mt-1 text-lg font-semibold">{latestRecording ? formatClock(latestRecording.durationMs) : "00:00"}</div>
              </CardContent>
            </Card>
            <Card className="rounded-[24px]">
              <CardContent className="p-4">
                <div className="text-xs tracking-[0.24em] text-slate-500 uppercase">Updated</div>
                <div className="mt-1 text-sm font-medium">{formatRelative(project.updatedAt)}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Directed playback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestRecording ? (
              <div className="space-y-4">
                <DirectedSessionPlayer
                  recordingUrl={withApiBaseUrl(latestRecording.originalVideoUrl)}
                  durationMs={latestRecording.durationMs}
                  shotEvents={project.shotEvents}
                />
                <div className="surface-muted rounded-3xl p-4">
                  <div className="mb-3 text-sm font-medium text-slate-200">Original raw capture</div>
                  <video
                    src={withApiBaseUrl(latestRecording.originalVideoUrl)}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full rounded-[24px] object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="surface-muted rounded-3xl p-4 text-sm text-slate-400">
                No recording has been saved yet for this project.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="secondary">
                <Link href={`/record/${project.id}` as Route}>
                  <PlayCircle className="h-4 w-4" />
                  Reopen live director
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/projects/${project.id}/export` as Route}>
                  <Film className="h-4 w-4" />
                  Export preview
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <ReviewTimeline project={project} />
          <AiReviewPanel projectId={project.id} />
        </div>
      </section>
    </div>
  );
}
