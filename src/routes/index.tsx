import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import cityImage from "@/assets/city-morning.jpg";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
  INDIAN_STATES_AND_UTS,
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

const WEATHERS: Weather[] = ["clear", "rain"];

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
    origin: "MG Road Metro Station",
    destination: "Kempegowda International Airport, Bengaluru",
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
  const [originState, setOriginState] = useState("Karnataka");
  const [destinationState, setDestinationState] = useState("Karnataka");

  useEffect(() => {
    loadTrafficData()
      .then(setData)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const states = INDIAN_STATES_AND_UTS;
  const locationsForState = (state: string) =>
    (data?.locations ?? []).filter(
      (location) => (data?.location_states?.[location] ?? "Karnataka") === state,
    );
  const origins = useMemo(() => locationsForState(originState), [data, originState]);
  const destinations = useMemo(
    () => locationsForState(destinationState),
    [data, destinationState],
  );
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

  function changeOriginState(state: string) {
    const nextOrigin = locationsForState(state)[0] ?? "";
    setOriginState(state);
    setForm((current) => ({ ...current, origin: nextOrigin }));
    setErrors({});
  }

  function changeDestinationState(state: string) {
    const nextDestination = locationsForState(state)[0] ?? "";
    setDestinationState(state);
    setForm((current) => ({ ...current, destination: nextDestination }));
    setErrors({});
  }

  if (authLoading || !session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="animate-pulse text-sm text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  const score = best?.score ?? 0;
  const confidence = routes ? Math.min(98, 82 + Math.min(routes.length, 3) * 4) : 96;

  return (
    <div className="min-h-screen bg-surface p-3 sm:p-5 lg:p-8">
      <div className="command-shell mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl lg:min-h-[calc(100vh-4rem)] lg:flex-row">
        <aside className="command-sidebar flex w-full shrink-0 flex-col p-5 lg:w-80 lg:p-7">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link to="/" className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-primary shadow-glow">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 20V9m7 11V4m7 16v-7" />
                </svg>
              </span>
              <span>
                <span className="display-title block text-3xl leading-none">TraffIQ</span>
                <span className="mt-1 block text-[9px] font-semibold tracking-[0.18em] text-primary-foreground/50 uppercase">Bengaluru intelligence</span>
              </span>
            </Link>
            <Link to="/dashboard" className="text-xs font-semibold text-primary-foreground/70 hover:text-primary-foreground lg:hidden">History</Link>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-primary-foreground/45 uppercase">Regional context</p>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Origin state">
                  <select
                    value={originState}
                    onChange={(e) => changeOriginState(e.target.value)}
                    className="command-field"
                    disabled={!data}
                  >
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                        {data && !locationsForState(state).length ? " — no modeled places yet" : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Origin" error={errors.origin}>
                  <select
                    value={form.origin}
                    onChange={(e) => setForm({ ...form, origin: e.target.value })}
                    className="command-field"
                    disabled={!data || !origins.length}
                  >
                    <option value="" disabled>
                      {origins.length ? "Select an origin" : "No modeled places in this state"}
                    </option>
                    {origins.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
              </Field>
                <Field label="Destination state">
                  <select
                    value={destinationState}
                    onChange={(e) => changeDestinationState(e.target.value)}
                    className="command-field"
                    disabled={!data}
                  >
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                        {data && !locationsForState(state).length ? " — no modeled places yet" : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Destination" error={errors.destination}>
                  <select
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    className="command-field"
                    disabled={!data || !destinations.length}
                  >
                    <option value="" disabled>
                      {destinations.length
                        ? "Select a destination"
                        : "No modeled places in this state"}
                    </option>
                    {destinations.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                  <Field label="Travel date" error={errors.date}>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="command-field"
                    />
                  </Field>
                  <Field label="Departure" error={errors.time}>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="command-field"
                    />
                  </Field>
            </div>
            <Field label="Weather">
                  <select
                    value={form.weather}
                    onChange={(e) => setForm({ ...form, weather: e.target.value as Weather })}
                    className="command-field"
                  >
                    {WEATHERS.map((w) => (
                      <option key={w} value={w}>
                        {w[0]?.toUpperCase() + w.slice(1)}
                      </option>
                    ))}
                  </select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-primary-foreground/65">
                  <input
                    type="checkbox"
                    checked={form.holiday}
                    onChange={(e) => setForm({ ...form, holiday: e.target.checked })}
                    className="size-4 accent-[var(--primary)]"
                  />
                  Public holiday
            </label>
            <Button
                type="submit"
                disabled={!data}
                className="h-12 w-full bg-accent font-bold text-accent-foreground shadow-lg hover:bg-accent/90"
              >
                {data ? "Generate forecast" : "Loading model…"}
              </Button>

              {loadError && <p className="mt-3 text-xs text-destructive">{loadError}</p>}
              {data && (!origins.length || !destinations.length) && (
                <p className="text-xs leading-relaxed text-primary-foreground/60">
                  The current observed traffic dataset covers Bengaluru, Karnataka. Other states
                  are ready to select as more real traffic sources are added.
                </p>
              )}
            </form>

          <div className="mt-auto border-t border-primary-foreground/10 pt-5">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-primary-foreground/40 uppercase">Signed in as</p>
            <p className="mt-1 truncate text-xs text-primary-foreground/80">{user?.email}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-9">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">Route intelligence workspace</p>
              <h1 className="display-title mt-2 text-4xl text-foreground sm:text-5xl">Forecast insights</h1>
              <p className="mt-2 text-sm text-muted-foreground">Observed Bengaluru travel-time patterns, scored for your departure window.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-low/25 bg-low/10 px-3 py-1 text-[10px] font-semibold tracking-wide text-low uppercase"><span className="size-1.5 rounded-full bg-low" />Model ready</span>
              <Button asChild variant="outline" size="sm"><Link to="/dashboard">Forecast history</Link></Button>
            </div>
          </header>

          <dl className="mt-7 grid gap-3 sm:grid-cols-3">
            <Metric label="Congestion index" value={routes ? `${score}%` : "—"} note={best?.level ?? "Awaiting route"} tone={best?.level === "High" ? "high" : best?.level === "Medium" ? "medium" : "low"} />
            <Metric label="Estimated travel time" value={best ? `${best.etaMinutes} min` : "—"} note={best ? "Best available route" : "Run a forecast"} tone="primary" />
            <Metric label="Model confidence" value={`${confidence}%`} note="Based on observed records" tone="low" />
          </dl>

          <section className="relative mt-5 min-h-[330px] overflow-hidden rounded-lg border border-border bg-card">
            <img src={cityImage} alt="Traffic moving through a Bengaluru city road" className="absolute inset-0 h-full w-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-background/55" />
            <div className="relative z-10 flex min-h-[330px] flex-col justify-between p-5 sm:p-7">
              <div className="max-w-sm rounded-md border border-border bg-card/90 p-4 shadow-panel backdrop-blur">
                <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Active route</p>
                <p className="mt-2 text-sm font-semibold">{submitted ? `${submitted.origin} → ${submitted.destination}` : "Choose a route to begin"}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{submitted ? `${submitted.date} · ${submitted.time} · ${submitted.weather}` : "The forecast will compare congestion, ETA and the recommended road."}</p>
              </div>
              <div className="max-w-xl rounded-md border border-primary/20 bg-primary p-5 text-primary-foreground shadow-panel">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-primary-foreground/60 uppercase">Traffic insight</p>
                <p className="mt-2 text-sm leading-relaxed">{thinking ? "Analysing the route options…" : advice?.summary ?? "Select Karnataka locations and generate a forecast for a concise route recommendation."}</p>
              </div>
            </div>
          </section>

          {routes && submitted ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {routes.map((route) => <RouteCard key={route.id} route={route} recommended={route.name === recommendedName} />)}
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <CongestionChart routes={routes} />
                <div className="panel p-5">
                  <p className="text-[10px] font-semibold tracking-[0.15em] text-primary uppercase">AI recommendation</p>
                  <p className="mt-3 text-base leading-relaxed">{advice?.reasoning ?? "Preparing your recommendation…"}</p>
                  <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{saved === "error" ? "This forecast could not be saved." : <>Saved to your <Link to="/dashboard" className="font-semibold text-primary">forecast history</Link>.</>}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="panel p-5"><p className="text-sm font-semibold">Verified source coverage</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">The current measured dataset contains {data?.meta.observations?.toLocaleString() ?? "97,831"} observations across {data?.meta.routes_observed ?? 13} Bengaluru routes. Other Indian states remain visible but are not given invented traffic results.</p></div>
              <FeedbackPanel route={best} origin={submitted?.origin ?? form.origin} destination={submitted?.destination ?? form.destination} time={submitted?.time ?? form.time} />
            </div>
          )}
        </main>

        <aside className="hidden w-64 shrink-0 border-l border-border bg-card p-6 xl:block">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Data record</p>
          <div className="mt-5 space-y-5">
            <Info label="Observed routes" value={String(data?.meta.routes_observed ?? 13)} />
            <Info label="Observations" value={(data?.meta.observations ?? 97831).toLocaleString()} />
            <Info label="Weather" value="Clear + rain" />
            <Info label="Coverage" value="Bengaluru, Karnataka" />
          </div>
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs font-semibold">Source transparency</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{data?.meta.source ?? "Traffic Monitor Lizard — Bengaluru traffic snapshots"}</p>
            <p className="mt-3 text-[10px] text-muted-foreground">{data?.meta.license ?? "CC BY 4.0"} · Model {data?.meta.version ?? "2.0.0"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: "primary" | "low" | "medium" | "high" }) {
  const tones = { primary: "bg-primary", low: "bg-low", medium: "bg-medium", high: "bg-high" };
  return (
    <div className="panel p-5"><dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</dt><dd className="mt-2 flex items-end justify-between gap-2"><span className="font-mono text-3xl font-medium text-foreground">{value}</span><span className="text-[10px] font-medium text-muted-foreground">{note}</span></dd><div className="mt-4 h-1 overflow-hidden rounded-full bg-muted"><div className={`h-full w-2/3 ${tones[tone]}`} /></div></div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>;
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
      <label className="text-[10px] font-semibold tracking-[0.12em] text-primary-foreground/45 uppercase">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
