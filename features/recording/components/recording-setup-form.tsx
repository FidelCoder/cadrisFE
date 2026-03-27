"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientApiFetch } from "@/lib/api/client";
import { useCadrisStore } from "@/stores/use-cadris-store";
import type { FramingStyle, RecordingMode } from "@/lib/domain/cadris";
import { cn } from "@/lib/utils";

interface SetupValues {
  title: string;
  mode: RecordingMode;
  style: FramingStyle;
}

const MODES: Array<{ value: RecordingMode; label: string; description: string }> = [
  {
    value: "podcast",
    label: "Podcast",
    description: "Balanced coverage for roundtables and seated conversations."
  },
  {
    value: "interview",
    label: "Interview",
    description: "Slightly more assertive speaker isolation for host and guest framing."
  }
];

const STYLES: Array<{ value: FramingStyle; label: string; description: string }> = [
  {
    value: "calm",
    label: "Calm",
    description: "Longer holds, cleaner transitions, and wide-shot restraint."
  },
  {
    value: "dynamic",
    label: "Dynamic",
    description: "Faster speaker emphasis with tighter crop confidence thresholds."
  }
];

export function RecordingSetupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { defaultMode, defaultStyle, setDefaults } = useCadrisStore();
  const form = useForm<SetupValues>({
    defaultValues: {
      title: "",
      mode: defaultMode,
      style: defaultStyle
    }
  });

  const selectedMode = form.watch("mode");
  const selectedStyle = form.watch("style");

  function onSubmit(values: SetupValues) {
    startTransition(async () => {
      try {
        const payload = await clientApiFetch<{ project: { id: string } }>("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(values)
        });
        setDefaults(values.mode, values.style);
        toast.success("Project created. Camera setup is ready.");
        router.push(`/record/${payload.project.id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>New Recording</CardTitle>
            <CardDescription>Start wide, keep everyone visible, and let Cadris handle the live reframing.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-3">
            <Label htmlFor="title">Project title</Label>
            <Input
              id="title"
              placeholder="Weekly roundtable"
              {...form.register("title")}
            />
          </div>

          <div className="space-y-3">
            <Label>Mode</Label>
            <div className="grid gap-3">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => form.setValue("mode", mode.value)}
                  className={cn(
                    "surface-muted rounded-3xl p-4 text-left transition",
                    selectedMode === mode.value && "border-cyan-300/30 bg-cyan-300/8"
                  )}
                >
                  <div className="text-base font-semibold">{mode.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Framing style</Label>
            <div className="grid gap-3">
              {STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => form.setValue("style", style.value)}
                  className={cn(
                    "surface-muted rounded-3xl p-4 text-left transition",
                    selectedStyle === style.value && "border-cyan-300/30 bg-cyan-300/8"
                  )}
                >
                  <div className="text-base font-semibold">{style.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{style.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/8 p-4 text-sm text-slate-200">
            Setup tip: place the phone on a stable tripod, keep all speakers visible in a generous wide frame, and avoid backlighting the group.
          </div>

          <Button className="w-full" size="lg" type="submit" disabled={isPending}>
            {isPending ? "Creating project..." : "Open camera setup"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
