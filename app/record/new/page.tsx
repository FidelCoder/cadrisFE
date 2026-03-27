import { RecordingSetupForm } from "@/features/recording/components/recording-setup-form";
import { Badge } from "@/components/ui/badge";

export default function NewRecordingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      <div className="space-y-3 pt-4">
        <Badge>Recording Setup</Badge>
        <h1 className="text-3xl font-semibold">Choose the directing profile for this session.</h1>
        <p className="text-sm text-slate-400">
          The MVP starts wide, keeps transitions stable, and records the original video plus every planned framing event for review later.
        </p>
      </div>
      <RecordingSetupForm />
    </div>
  );
}
