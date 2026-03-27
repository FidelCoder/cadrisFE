import { notFound } from "next/navigation";
import { LiveDirectorScreen } from "@/features/live-director/components/live-director-screen";
import { serverApiFetch } from "@/lib/api/server";
import type { ProjectDetail } from "@/lib/domain/cadris";

export default async function RecordProjectPage({
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

  return <LiveDirectorScreen project={project} />;
}
