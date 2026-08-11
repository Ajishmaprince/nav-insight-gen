import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { CongestionChart, RouteCard } from "@/components/traffic/RouteCard";
import { FeedbackPanel } from "@/components/traffic/FeedbackPanel";
import { getRouteAdvice, type RouteAdvice } from "@/lib/advice.functions";
import {
  loadTrafficData,
  predict,
  validateQuery,
  type Query,
  type ScoredRoute,
  type TrafficData,
  type Weather,
} from "@/lib/traffic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TraffIQ — AI Route Congestion Forecaster" },
      {
        name: "description",
        content:
          "Predict congestion on alternate routes with an ML model running in your browser, then get an AI-written recommendation for the fastest way to go.",
      },
      { property: "og:title", content: "TraffIQ — AI Route Congestion Forecaster" },
      {
        property: "og:description",
        content:
          "Client-side congestion prediction plus AI route advice, colour-coded per route with ETA and drift tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const WEATHERS: Weather[] = ["clear", "clouds", "rain", "fog", "snow"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Index() {
  const adviceFn = useServerFn(getRouteAdvice);
  const [data, setData] = useState<TrafficData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Query>({
    origin: "Downtown",
    destination: "Airport",
    time: "08:30",
    date: todayISO(),
    weather: "clear",
    holiday: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Query, string>>>({});
  const [routes, setRoutes] = useState<ScoredRoute[] | null>(null);
  const [advice, setAdvice] = useState<RouteAdvice | null>(null);
  const [thinking, setThinking] = useState(false);
  const [submitted, setSubmitted] = useState<Query | null>(null);

  useEffect(() => {
    loadTrafficData()
      .then(setData)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const destinations = useMemo(() => data?.locations ?? [], [data]);
  const best = routes?.[0] ?? null;
  const recommendedName = advice?.recommendedRoute ?? best?.name ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateQuery(form, data);
    setErrors(found);
    if (Object.keys(found).length || !data) return;

    const scored = predict(data, form);
    setRoutes(scored);
    setSubmitted(form);
    setAdvice(null);
    setThinking(true);

    // Module 2: LLM recommendation with plain-JS fallback.
    try {
      const result = await adviceFn({
        data: {
          origin: form.origin,
          destination: form.destination,
          time: form.time,
          weather: form.weather,
          holiday: form.holiday,
          routes: scored.map((r) => ({
            name: r.name,
            via: r.via,
            score: r.score,
            level: r.level,
            distance_km: r.distance_km,
            etaMinutes: r.etaMinutes,
          })),
        },
      });
      setAdvice(result);
    } catch {
      const fallback = scored.reduce((a, b) => (a.score <= b.score ? a : b));
      setAdvice({
        summary: `Offline mode: ${fallback.name} has the lowest predicted congestion (${fallback.score}/100).`,
        recommendedRoute: fallback.name,
        reasoning: `AI explanation unavailable, so the route was chosen by comparing congestion scores directly. ETA about ${fallback.etaMinutes} minutes over ${fallback.distance_km.toFixed(1)} km.`,
        source: "fallback",
      });
    } finally {
      setThinking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <header className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase">
          Traffic intelligence
        </span>
        <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
          TraffIQ — predict congestion, pick the smarter route.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          A congestion model trained offline runs entirely in your browser from{" "}
          <code className="font-mono text-primary">traffic_data.json</code>. Alternate routes
          are scored, colour-coded, and explained in plain language by AI.
        </p>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={onSubmit} className="panel h-fit p-6" noValidate>
          <h2 className="text-lg font-medium">Plan a trip</h2>

          <div className="mt-5 space-y-4">
            <Field label="Origin" error={errors.origin}>
              <select
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
                className="field"
              >
                {destinations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Destination" error={errors.destination}>
              <select
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="field"
              >
                {destinations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Travel date" error={errors.date}>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="field"
                />
              </Field>
              <Field label="Departure" error={errors.time}>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="field"
                />
              </Field>
            </div>

            <Field label="Weather">
              <select
                value={form.weather}
                onChange={(e) => setForm({ ...form, weather: e.target.value as Weather })}
                className="field"
              >
                {WEATHERS.map((w) => (
                  <option key={w} value={w}>
                    {w[0]?.toUpperCase() + w.slice(1)}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.holiday}
                onChange={(e) => setForm({ ...form, holiday: e.target.checked })}
                className="size-4 accent-[var(--primary)]"
              />
              Public holiday
            </label>
          </div>

          <button
            type="submit"
            disabled={!data}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {data ? "Predict congestion" : "Loading model…"}
          </button>

          {loadError && <p className="mt-3 text-xs text-destructive">{loadError}</p>}
          {data && (
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Model {data.meta.version} · {data.meta.model}
              <br />
              Source: {data.meta.source}
            </p>
          )}
        </form>

        <section className="space-y-6">
          {!routes && (
            <div className="panel flex min-h-64 flex-col items-center justify-center p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Pick an origin, destination and departure time to score up to three alternate
                routes.
              </p>
            </div>
          )}

          {routes && submitted && (
            <>
              <div className="panel p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-medium">
                    {submitted.origin} → {submitted.destination}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {submitted.date} at {submitted.time} · {submitted.weather}
                    {submitted.holiday ? " · holiday" : ""}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {routes.map((r) => (
                    <RouteCard key={r.id} route={r} recommended={r.name === recommendedName} />
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="panel p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-medium">AI recommendation</h2>
                    {advice && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {advice.source === "ai" ? "Lovable AI" : "Local fallback"}
                      </span>
                    )}
                  </div>

                  {thinking && (
                    <p className="mt-4 animate-pulse text-sm text-muted-foreground">
                      Analysing routes…
                    </p>
                  )}

                  {advice && (
                    <div className="mt-4 space-y-4">
                      <p className="text-base leading-relaxed">{advice.summary}</p>
                      <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                        <p className="text-[11px] tracking-wide text-primary uppercase">
                          Take this route
                        </p>
                        <p className="mt-1 font-medium">{advice.recommendedRoute}</p>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {advice.reasoning}
                      </p>
                    </div>
                  )}
                </div>

                <CongestionChart routes={routes} />
              </div>

              <FeedbackPanel
                route={
                  routes.find((r) => r.name === recommendedName) ?? best
                }
                origin={submitted.origin}
                destination={submitted.destination}
                time={submitted.time}
              />
            </>
          )}
        </section>
      </div>

      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        Predictions are precomputed from an offline Random Forest model. Feedback is stored in
        your browser only.
      </footer>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
