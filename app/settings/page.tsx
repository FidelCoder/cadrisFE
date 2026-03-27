"use client";

import { useCadrisStore } from "@/stores/use-cadris-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { showFaceBoxes, setShowFaceBoxes, cinematicSmoothing, setCinematicSmoothing } = useCadrisStore();

  return (
    <div className="space-y-5 pb-28">
      <div className="space-y-3 pt-4">
        <Badge>Settings</Badge>
        <h1 className="text-3xl font-semibold">Tune the operator feel for this device.</h1>
        <p className="text-sm text-slate-400">These controls stay intentionally light for v1: preview overlays and motion smoothing without adding operator friction.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            className="surface-muted flex w-full items-center justify-between rounded-3xl p-4 text-left"
            onClick={() => setShowFaceBoxes(!showFaceBoxes)}
          >
            <div>
              <div className="font-medium">Show face boxes in guide view</div>
              <div className="mt-1 text-sm text-slate-400">Helpful during testing to verify who the tracker currently favors.</div>
            </div>
            <div className="text-sm text-cyan-200">{showFaceBoxes ? "On" : "Off"}</div>
          </button>

          <div className="surface-muted rounded-3xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">Cinematic smoothing</div>
                <div className="mt-1 text-sm text-slate-400">Higher values reduce twitchiness in the live crop path.</div>
              </div>
              <div className="text-sm text-cyan-200">{Math.round(cinematicSmoothing * 100)}%</div>
            </div>
            <input
              className="mt-4 w-full accent-cyan-300"
              type="range"
              min="0.4"
              max="0.95"
              step="0.01"
              value={cinematicSmoothing}
              onChange={(event) => setCinematicSmoothing(Number(event.target.value))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
