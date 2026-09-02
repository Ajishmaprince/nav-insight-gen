import type { ScoredRoute } from "@/lib/traffic";

const LEVEL_CLASS: Record<string, string> = {
  Low: "bg-low/15 text-low border-low/40",
  Medium: "bg-medium/15 text-medium border-medium/40",
  High: "bg-high/15 text-high border-high/40",
};

const BAR_CLASS: Record<string, string> = {
  Low: "bg-low",
  Medium: "bg-medium",
  High: "bg-high",
};

export function RouteCard({
  route,
  recommended,
}: {
  route: ScoredRoute;
  recommended: boolean;
}) {
  return (
    <article
      className={`rounded-xl border bg-card p-4 transition-shadow ${
        recommended ? "border-primary/60 shadow-glow" : "border-border"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium leading-tight">{route.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {route.via} · {route.distance_km.toFixed(1)} km · ~{route.etaMinutes} min
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${LEVEL_CLASS[route.level]}`}
        >
          {route.level}
        </span>
      </header>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-700 ${BAR_CLASS[route.level]}`}
            style={{ width: `${route.score}%` }}
          />
        </div>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {route.score}
        </span>
      </div>

      {recommended && (
        <p className="mt-3 text-xs font-medium tracking-wide text-primary uppercase">
          Recommended
        </p>
      )}
    </article>
  );
}

export function CongestionChart({ routes }: { routes: ScoredRoute[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium">Congestion score by route</h3>
      <div className="mt-6 flex items-end gap-6">
        {routes.map((r) => (
          <div key={r.id} className="flex flex-1 flex-col items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{r.score}</span>
            <div className="flex h-32 w-full items-end">
              <div
                className={`w-full rounded-t-md ${BAR_CLASS[r.level]} transition-all duration-700`}
                style={{ height: `${Math.max(6, r.score)}%` }}
              />
            </div>
            <span className="line-clamp-2 h-8 text-center text-[11px] leading-tight text-muted-foreground">
              {r.name}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <Legend cls="bg-low" label="Low (under 40)" />
        <Legend cls="bg-medium" label="Medium (40–69)" />
        <Legend cls="bg-high" label="High (70+)" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${cls}`} />
      <span>{label}</span>
    </span>
  );
}
