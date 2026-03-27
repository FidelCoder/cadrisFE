"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ExportPreview, type ExportSegment } from "@/features/export/components/export-preview";
import { clientApiFetch } from "@/lib/api/client";

export default function ExportPage() {
  const params = useParams<{ projectId: string }>();
  const [segments, setSegments] = useState<ExportSegment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  async function generatePreview() {
    try {
      setIsGenerating(true);
      const payload = await clientApiFetch<{ segments: ExportSegment[] }>(`/api/projects/${params.projectId}/export`, {
        method: "POST"
      });

      setSegments(payload.segments);
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
          This MVP keeps export generation intentionally light. The timeline is ready for stronger rendering later without changing the storage model.
        </p>
      </div>
      <ExportPreview segments={segments} onGeneratePreview={generatePreview} isGenerating={isGenerating} />
    </div>
  );
}
