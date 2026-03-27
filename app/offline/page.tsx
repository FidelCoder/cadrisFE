import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center pb-28">
      <div className="surface-panel max-w-md rounded-[32px] p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-300/10 text-cyan-200">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Offline shell ready</h1>
        <p className="mt-3 text-sm text-slate-400">
          Cadris can still load its shell offline, but live recording and project sync need camera access and a healthy network path for saved sessions.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
