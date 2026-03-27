import Link from "next/link";

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-lg font-semibold text-cyan-100">
        C
      </div>
      <div>
        <div className="text-sm font-semibold tracking-[0.28em] text-cyan-100 uppercase">Cadris</div>
        <div className="text-xs text-slate-400">Real-time AI camera direction from one phone</div>
      </div>
    </Link>
  );
}
