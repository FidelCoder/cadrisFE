"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ExportPreview, type ExportRecording, type ExportSegment } from "@/features/export/components/export-preview";
import { clientApiFetch } from "@/lib/api/client";

export default function ExportPage() {
  const params = useParams<{ projectId: string }>();
  const [segments, setSegments] = useState<ExportSegment[]>([]);
  const [recording, setRecording] = useState<ExportRecording | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function generatePreview() {
    try {
      setIsGenerating(true);
      const payload = await clientApiFetch<{ recording: ExportRecording | null; segments: ExportSegment[] }>(`/api/projects/${params.projectId}/export`, {
        method: "POST"
      });

      setSegments(payload.segments);
      setRecording(payload.recording);
      toast.success("Export preview generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate preview.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="space-y-3 pt-4">
        <Badge>Export</Badge>
        <h1 className="text-3xl font-semibold">Prepare a lightweight export preview.</h1>
        <p className="text-sm text-slate-400">
          This MVP keeps export generation lightweight, but now surfaces the saved live-directed preview clip when one is available so you can test real reframed output immediately.
        </p>
      </div>
      <ExportPreview recording={recording} segments={segments} onGeneratePreview={generatePreview} isGenerating={isGenerating} />
    </div>
  );
}
