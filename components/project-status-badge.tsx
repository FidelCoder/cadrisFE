import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/domain/cadris";

const LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  recording: "Recording",
  processing: "Processing",
  ready: "Ready",
  exported: "Exported"
};

const STYLES: Record<ProjectStatus, string> = {
  draft: "text-slate-300",
  recording: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  processing: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  ready: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  exported: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={STYLES[status]}>{LABELS[status]}</Badge>;
}
