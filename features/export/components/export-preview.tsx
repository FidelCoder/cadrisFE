import { Film, WandSparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatClock, formatPercent } from "@/lib/utils";
import { withApiBaseUrl } from "@/lib/api/base-url";

export interface ExportSegment {
  id: string;
  shotType: string;
  targetTrackId: string | null;
  startsAtMs: number;
  endsAtMs: number;
  confidence: number;
  notes: string | null;
}

export interface ExportRecording {
  originalVideoUrl: string;
  directedPreviewVideoUrl: string | null;
  durationMs: number;
}

export function ExportPreview({
  recording,
  segments,
  onGeneratePreview,
  isGenerating
}: {
  recording: ExportRecording | null;
  segments: ExportSegment[];
  onGeneratePreview?: () => void;
  isGenerating?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Export foundation</CardTitle>
              <CardDescription>Segments are derived from the live shot timeline so rendering can be upgraded later without losing the original recording.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="secondary" className="w-full" onClick={onGeneratePreview} disabled={isGenerating}>
            <WandSparkles className="h-4 w-4" />
            {isGenerating ? "Preparing..." : "Generate export preview"}
          </Button>
          {recording ? (
            <div className="surface-muted space-y-4 rounded-3xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    {recording.directedPreviewVideoUrl ? "Rendered directed clip" : "Source clip ready"}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {recording.directedPreviewVideoUrl
                      ? "This is the lightweight live-directed preview captured during recording."
                      : "No rendered directed clip was available, so the original source remains the fallback."}
                  </div>
                </div>
                <Badge>{formatClock(recording.durationMs)}</Badge>
              </div>
              <video
                src={withApiBaseUrl(recording.directedPreviewVideoUrl ?? recording.originalVideoUrl)}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full rounded-[24px] object-cover"
              />
              <Button asChild className="w-full">
                <a href={withApiBaseUrl(recording.directedPreviewVideoUrl ?? recording.originalVideoUrl)} download>
                  <Film className="h-4 w-4" />
                  {recording.directedPreviewVideoUrl ? "Download directed clip" : "Download source clip"}
                </a>
              </Button>
            </div>
          ) : null}
          <div className="space-y-3">
            {segments.length ? (
              segments.map((segment) => (
                <div key={segment.id} className="surface-muted flex items-center justify-between gap-4 rounded-3xl p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge>{segment.shotType}</Badge>
                      <div className="text-sm text-slate-300">{segment.targetTrackId ? `track ${segment.targetTrackId}` : "wide group"}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{segment.notes ?? "smoothed director transition"}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{formatClock(segment.startsAtMs)} - {formatClock(segment.endsAtMs)}</div>
                    <div className="text-slate-500">{formatPercent(segment.confidence)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="surface-muted rounded-3xl p-4 text-sm text-slate-400">
                No export segments yet. Save a recording first.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
