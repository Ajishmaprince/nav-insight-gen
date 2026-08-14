import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import heroImage from "@/assets/hero-highway.jpg";
import cityImage from "@/assets/city-morning.jpg";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
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
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !session) void navigate({ to: "/auth", replace: true });
  }, [authLoading, session, navigate]);

  const [saved, setSaved] = useState<"ok" | "error" | null>(null);
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
    setSaved(null);

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

    // Signed-in users get every forecast saved to their dashboard.
    if (user) {
      const chosen = scored.reduce((a, b) => (a.score <= b.score ? a : b));
      const { error } = await supabase.from("forecasts").insert({
        user_id: user.id,
        origin: form.origin,
        destination: form.destination,
        depart_time: form.time,
        travel_date: form.date,
        weather: form.weather,
        holiday: form.holiday,
        recommended_route: chosen.name,
        score: chosen.score,
        level: chosen.level,
        eta_minutes: chosen.etaMinutes,
      });
      setSaved(error ? "error" : "ok");
    }
  }

  return (
    <div id="top">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="border-b border-border/70">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase">
                  Traffic intelligence platform
                </span>
                <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Know the traffic
                  <br />
                  before you leave.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  TraffIQ scores every alternate route for your trip using a congestion model
                  trained offline and executed entirely in your browser — then explains the
                  smartest choice in one short paragraph.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    href="#forecast"
                    className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90"
                  >
                    Forecast my route
                  </a>
                  <a
                    href="#how-it-works"
                    className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    See how it works
                  </a>
                </div>
              </div>

              <figure className="panel overflow-hidden p-0">
                <img
                  src={heroImage}
                  alt="Aerial view of a multi-level city highway interchange in daylight"
                  width={1600}
                  height={1200}
                  className="h-72 w-full object-cover sm:h-96"
                />
                <figcaption className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                  Modelled on hourly volume patterns from real interstate traffic records.
                </figcaption>
              </figure>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { k: "3", v: "Alternate routes scored per trip" },
                { k: "0 ms", v: "Server round-trips for scoring" },
                { k: "24 × 7", v: "Hour and weekday factors modelled" },
                { k: "5", v: "Weather conditions accounted for" },
              ].map((s) => (
                <div key={s.v} className="panel p-5">
                  <dt className="font-mono text-2xl leading-none text-primary">{s.k}</dt>
                  <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>


        {/* Forecast */}
        <section id="forecast" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <SectionHeading
            eyebrow="Route forecast"
            title="Plan a trip and compare every option"
            description="Set your departure details on the left. Scores range from 0 to 100, where lower means freer-flowing traffic."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
            <form onSubmit={onSubmit} className="panel h-fit p-6" noValidate>
              <h3 className="text-base font-medium">Trip details</h3>

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
                <p className="mt-4 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Model {data.meta.version} · {data.meta.model}
                  <br />
                  Source: {data.meta.source}
                </p>
              )}
            </form>

            <div className="space-y-6">
              {!routes && (
                <div className="panel flex min-h-72 flex-col items-center justify-center p-10 text-center">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5 text-primary"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M3 17h4l3-10 4 14 3-8h4" />
                    </svg>
                  </span>
                  <p className="mt-4 max-w-sm text-sm text-muted-foreground">
                    Choose an origin, destination and departure time to score up to three
                    alternate routes side by side.
                  </p>
                </div>
              )}

              {routes && submitted && (
                <>
                  <div className="panel p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
                      <h3 className="text-lg font-medium">
                        {submitted.origin} → {submitted.destination}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {submitted.date} at {submitted.time} · {submitted.weather}
                        {submitted.holiday ? " · holiday" : ""}
                      </p>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {routes.map((r) => (
                        <RouteCard
                          key={r.id}
                          route={r}
                          recommended={r.name === recommendedName}
                        />
                      ))}
                    </div>

                    <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                      {user ? (
                        saved === "error" ? (
                          "Could not save this forecast to your dashboard."
                        ) : (
                          <>
                            Saved to your{" "}
                            <Link to="/dashboard" className="font-semibold text-primary hover:underline">
                              dashboard
                            </Link>
                            .
                          </>
                        )
                      ) : (
                        <>
                          <Link to="/auth" className="font-semibold text-primary hover:underline">
                            Sign in
                          </Link>{" "}
                          to save forecasts to your dashboard.
                        </>
                      )}
                    </p>
                  </div>



                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="panel p-6">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium">AI recommendation</h3>
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
                </>
              )}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-border/70 bg-surface/30">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <SectionHeading
              eyebrow="How it works"
              title="An offline-trained model, delivered instantly"
              description="Three steps, no backend inference and no waiting on a live traffic feed."
            />
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "Trained offline",
                  d: "A Random Forest is fitted on historical volume, weather and calendar data, then reduced to compact factor weights.",
                },
                {
                  n: "02",
                  t: "Scored in-browser",
                  d: "Those weights ship as static JSON, so each route is scored and classified Low, Medium or High on your device.",
                },
                {
                  n: "03",
                  t: "Explained by AI",
                  d: "The scored routes are summarised into a single clear recommendation, with a deterministic fallback if AI is unavailable.",
                },
              ].map((s) => (
                <li key={s.n} className="panel p-6">
                  <span className="font-mono text-xs text-primary">{s.n}</span>
                  <h3 className="mt-3 text-base font-medium">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10 grid gap-6 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-2">
              <img
                src={cityImage}
                alt="Commuters and buses on a bright city street during the morning peak"
                width={1200}
                height={900}
                loading="lazy"
                className="h-64 w-full object-cover md:h-full"
              />
              <div className="p-6 sm:p-8">
                <h3 className="text-lg font-semibold tracking-tight">Built for the peak hour</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Congestion is rarely about distance. TraffIQ weighs the hour of departure, the
                  weekday, holidays and current weather, so a longer bypass often wins over the
                  obvious direct road.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  {[
                    "Hourly and weekday demand curves",
                    "Weather multipliers for rain, fog and snow",
                    "Holiday adjustment for lighter commutes",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </section>

        {/* Accuracy */}
        <section id="accuracy" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <SectionHeading
            eyebrow="Accuracy & drift"
            title="Tell us what you actually experienced"
            description="Every report you log is compared against the prediction to track hit rate, bias and drift over time — stored only in this browser."
          />
          <div className="mt-10">
            <FeedbackPanel
              route={routes?.find((r) => r.name === recommendedName) ?? best}
              origin={submitted?.origin ?? form.origin}
              destination={submitted?.destination ?? form.destination}
              time={submitted?.time ?? form.time}
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
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
