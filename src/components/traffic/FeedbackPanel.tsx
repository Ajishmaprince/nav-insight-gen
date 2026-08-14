import { useEffect, useMemo, useState } from "react";
import {
  clearFeedback,
  computeDrift,
  readFeedback,
  saveFeedback,
  type FeedbackEntry,
  type Level,
  type ScoredRoute,
} from "@/lib/traffic";

const LEVELS: Level[] = ["Low", "Medium", "High"];

export function FeedbackPanel({
  route,
  origin,
  destination,
  time,
}: {
  route: ScoredRoute | null;
  origin: string;
  destination: string;
  time: string;
}) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const drift = useMemo(() => computeDrift(entries), [entries]);

  // Read after hydration so server and client markup match.
  useEffect(() => {
    setEntries(readFeedback());
  }, []);


  function log(actual: Level) {
    if (!route) return;
    const entry: FeedbackEntry = {
      id: crypto.randomUUID(),
      at: Date.now(),
      origin,
      destination,
      time,
      route: route.name,
      predictedScore: route.score,
      predictedLevel: route.level,
      actualLevel: actual,
      matched: actual === route.level,
    };
    setEntries(saveFeedback(entry));
    setSaved(true);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium">Was the prediction right?</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {route
          ? `We predicted ${route.level} congestion on ${route.name}. What did you actually see?`
          : "Run a prediction first, then log what you actually experienced."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {LEVELS.map((lvl) => (
          <button
            key={lvl}
            type="button"
            disabled={!route}
            onClick={() => log(lvl)}
            className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-40"
          >
            Actually {lvl}
          </button>
        ))}
      </div>
      {saved && <p className="mt-3 text-xs text-primary">Feedback saved locally. Thanks!</p>}

      {drift && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Samples" value={String(drift.samples)} />
            <Stat label="Hit rate" value={`${drift.accuracy}%`} />
            <Stat label="Recent avg" value={String(drift.recentAvg)} />
            <Stat label="All-time avg" value={String(drift.historicalAvg)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Model is <span className="text-foreground">{drift.bias}</span> (mean error{" "}
            {drift.meanError}).{" "}
            {drift.drifting
              ? "Recent predictions diverge from the historical average — drift likely."
              : "No significant drift detected."}
          </p>
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              setEntries([]);
              setSaved(false);
            }}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Clear feedback log
          </button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg leading-none">{value}</p>
    </div>
  );
}
