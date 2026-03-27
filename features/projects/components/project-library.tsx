import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Camera, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import type { ProjectDetail } from "@/lib/domain/cadris";
import { formatClock, formatRelative } from "@/lib/utils";

export function ProjectLibrary({ projects }: { projects: ProjectDetail[] }) {
  if (!projects.length) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-300/10 text-cyan-200">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No recordings yet</h2>
            <p className="mt-2 text-sm text-slate-400">Create a new setup and record a conversation to start building your director timeline.</p>
          </div>
          <Button asChild>
            <Link href="/record/new">New recording</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const latestRecording = project.recordings[0];

        return (
          <Link key={project.id} href={`/projects/${project.id}` as Route}>
            <Card className="h-full transition hover:-translate-y-1 hover:border-cyan-300/20">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{project.title}</CardTitle>
                    <div className="mt-2 text-sm text-slate-400">
                      {project.mode} • {project.style}
                    </div>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="surface-muted rounded-3xl p-4">
                    <div className="text-xs tracking-[0.24em] text-slate-500 uppercase">Shots</div>
                    <div className="mt-1 text-lg font-semibold">{project.shotEvents.length}</div>
                  </div>
                  <div className="surface-muted rounded-3xl p-4">
                    <div className="text-xs tracking-[0.24em] text-slate-500 uppercase">Duration</div>
                    <div className="mt-1 text-lg font-semibold">{latestRecording ? formatClock(latestRecording.durationMs) : "00:00"}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    {formatRelative(project.updatedAt)}
                  </div>
                  <ArrowRight className="h-4 w-4 text-cyan-200" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
