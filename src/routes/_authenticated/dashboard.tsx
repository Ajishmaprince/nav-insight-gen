import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your commute dashboard — TraffIQ" },
      {
        name: "description",
        content:
          "Review your saved TraffIQ route forecasts, average congestion scores and the routes you travel most often.",
      },
      { property: "og:title", content: "Your commute dashboard — TraffIQ" },
      {
        property: "og:description",
        content: "Saved congestion forecasts, average scores and your most-travelled routes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Forecast = {
  id: string;
  origin: string;
  destination: string;
  depart_time: string;
  travel_date: string;
  weather: string;
  holiday: boolean;
  recommended_route: string;
  score: number;
  level: string;
  eta_minutes: number;
  created_at: string;
};

const LEVEL_CLASS: Record<string, string> = {
  Low: "border-low/40 bg-low/10 text-low",
  Medium: "border-medium/40 bg-medium/10 text-medium",
  High: "border-high/40 bg-high/10 text-high",
};

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["forecasts", user?.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("forecasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (rows ?? []) as Forecast[];
    },
    enabled: Boolean(user),
  });

  const rows = data ?? [];
  const avgScore = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + Number(r.score), 0) / rows.length)
    : 0;
  const avgEta = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.eta_minutes, 0) / rows.length)
    : 0;
  const topRoute =
    Object.entries(
      rows.reduce<Record<string, number>>((acc, r) => {
        const key = `${r.origin} → ${r.destination}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  async function remove(id: string) {
    await supabase.from("forecasts").delete().eq("id", id);
    void refetch();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="text-base font-semibold tracking-tight">
            Traff<span className="text-primary">IQ</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
            <Link
              to="/"
              className="rounded-lg border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:border-primary/50"
            >
              New forecast
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/auth" });
              }}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your commute overview</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Every forecast you run while signed in is saved here so you can compare congestion over
          time.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: String(rows.length), v: "Forecasts saved" },
            { k: rows.length ? `${avgScore}/100` : "—", v: "Average congestion score" },
            { k: rows.length ? `${avgEta} min` : "—", v: "Average predicted ETA" },
            { k: topRoute, v: "Most forecast trip" },
          ].map((s) => (
            <div key={s.v} className="panel p-5">
              <dt className="font-mono text-xl leading-tight text-primary">{s.k}</dt>
              <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.v}</dd>
            </div>
          ))}
        </dl>

        <section className="panel mt-8 p-6">
          <h2 className="text-lg font-medium">Saved forecasts</h2>

          {isLoading && (
            <p className="mt-4 animate-pulse text-sm text-muted-foreground">Loading…</p>
          )}

          {!isLoading && rows.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              No forecasts yet.{" "}
              <Link to="/" className="font-semibold text-primary hover:underline">
                Run your first forecast
              </Link>{" "}
              and it will appear here.
            </p>
          )}

          {rows.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-4 font-medium">Trip</th>
                    <th className="py-2 pr-4 font-medium">Departure</th>
                    <th className="py-2 pr-4 font-medium">Route</th>
                    <th className="py-2 pr-4 font-medium">Score</th>
                    <th className="py-2 pr-4 font-medium">ETA</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {r.origin} → {r.destination}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {r.travel_date} · {r.depart_time}
                        <span className="block text-xs">
                          {r.weather}
                          {r.holiday ? " · holiday" : ""}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{r.recommended_route}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            LEVEL_CLASS[r.level] ?? "border-border text-muted-foreground"
                          }`}
                        >
                          {Number(r.score)} · {r.level}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{r.eta_minutes} min</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void remove(r.id)}
                          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
