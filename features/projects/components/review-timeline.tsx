import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectDetail } from "@/lib/domain/cadris";
import { formatClock, formatPercent } from "@/lib/utils";

export function ReviewTimeline({ project }: { project: ProjectDetail }) {
  if (!project.shotEvents.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-400">
          Shot timeline will appear after the first saved recording.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Directed timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {project.shotEvents.map((event) => (
          <div key={event.id} className="surface-muted flex items-center justify-between gap-3 rounded-3xl p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge>{event.shotType}</Badge>
                <span className="text-sm text-slate-300">{event.targetTrackId ? `track ${event.targetTrackId}` : "group frame"}</span>
              </div>
              <div className="text-xs text-slate-500">{event.notes ?? "stabilized crop update"}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{formatClock(event.timestampMs)}</div>
              <div className="text-xs text-slate-500">{formatPercent(event.confidence)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
