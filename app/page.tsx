import Link from "next/link";
import { ArrowRight, Camera, Film, Radar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const highlights = [
  {
    title: "Live speaker framing",
    description: "Cadris listens for scene energy, tracks faces, and favors the right shot while you record.",
    icon: Radar
  },
  {
    title: "Wide first capture",
    description: "The original recording stays intact underneath every crop so future exports can improve without reshooting.",
    icon: Camera
  },
  {
    title: "Timeline-ready metadata",
    description: "Each planned shot is stored as structured events for review, export, and future AI upgrades.",
    icon: Film
  }
];

export default function HomePage() {
  return (
    <div className="space-y-6 pb-28">
      <section className="grid-highlight surface-panel relative overflow-hidden rounded-[36px] px-5 py-8 sm:px-8 sm:py-10">
        <div className="relative z-10 max-w-3xl space-y-5">
          <Badge>Real-time AI camera direction from one phone</Badge>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-tight sm:text-5xl">
              One phone. One wide shot. A live AI director quietly doing the framing work.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
              Cadris is built for interviews, podcasts, classrooms, and conversations where you need the shot to feel intentional without hiring a camera operator.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/record/new">
                Start recording flow
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/projects">Open library</Link>
            </Button>
          </div>
          <div className="grid gap-3 pt-4 sm:grid-cols-3">
            <Card className="rounded-[28px] bg-white/4">
              <CardContent className="p-5">
                <div className="text-xs tracking-[0.22em] text-slate-500 uppercase">MVP focus</div>
                <div className="mt-2 text-lg font-semibold">Live directing first</div>
              </CardContent>
            </Card>
            <Card className="rounded-[28px] bg-white/4">
              <CardContent className="p-5">
                <div className="text-xs tracking-[0.22em] text-slate-500 uppercase">Primary setup</div>
                <div className="mt-2 text-lg font-semibold">2-4 person conversations</div>
              </CardContent>
            </Card>
            <Card className="rounded-[28px] bg-white/4">
              <CardContent className="p-5">
                <div className="text-xs tracking-[0.22em] text-slate-500 uppercase">Storage strategy</div>
                <div className="mt-2 text-lg font-semibold">Original video + shot metadata</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardContent className="space-y-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="surface-panel rounded-[36px] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">What this prototype already optimizes for</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Stable speaker selection, wide-shot resets on overlap, mobile-first controls, and a modular direction pipeline ready for stronger face and speaker models later.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
