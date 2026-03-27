import { Badge } from "@/components/ui/badge";
import { ProjectLibrary } from "@/features/projects/components/project-library";
import { serverApiFetch } from "@/lib/api/server";
import type { ProjectDetail } from "@/lib/domain/cadris";

export default async function ProjectsPage() {
  let projects: ProjectDetail[] = [];
  let loadError: string | null = null;

  try {
    projects = await serverApiFetch<ProjectDetail[]>("/api/projects");
  } catch {
    loadError = "The project library is temporarily unavailable. Check the backend and database connection, then refresh.";
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="space-y-3 pt-4">
        <Badge>Project Library</Badge>
        <h1 className="text-3xl font-semibold">Saved sessions and generated shot timelines.</h1>
        <p className="text-sm text-slate-400">
          Review how the live director behaved, reopen sessions, and move into export preview when you are ready.
        </p>
      </div>
      {loadError ? <div className="surface-muted rounded-[24px] p-4 text-sm text-amber-100">{loadError}</div> : null}
      <ProjectLibrary projects={projects} />
    </div>
  );
}
