// Module 1 + 3: client-side scoring, classification, validation and drift.

export type Weather = "clear" | "clouds" | "rain" | "fog" | "snow";
export type Level = "Low" | "Medium" | "High";

export type RouteDef = {
  id: string;
  name: string;
  distance_km: number;
  base_score: number;
  via: string;
};

export type TrafficData = {
  meta: { source: string; model: string; version: string; target: string };
  locations: string[];
  hour_factor: Record<string, number>;
  day_factor: Record<string, number>;
  weather_factor: Record<string, number>;
  holiday_factor: number;
  thresholds: { low: number; medium: number };
  routes: Record<string, RouteDef[]>;
};

export type ScoredRoute = RouteDef & {
  score: number;
  level: Level;
  etaMinutes: number;
};

export type Query = {
  origin: string;
  destination: string;
  time: string; // HH:MM
  date: string; // YYYY-MM-DD
  weather: Weather;
  holiday: boolean;
};

export function loadTrafficData(): Promise<TrafficData> {
  return fetch("/traffic_data.json").then((r) => {
    if (!r.ok) throw new Error("Could not load traffic_data.json");
    return r.json() as Promise<TrafficData>;
  });
}

export function routeKey(origin: string, destination: string) {
  return `${origin}>${destination}`;
}

export function findRoutes(data: TrafficData, origin: string, destination: string) {
  return (
    data.routes[routeKey(origin, destination)] ??
    data.routes[routeKey(destination, origin)] ??
    null
  );
}

export function classify(score: number, t: TrafficData["thresholds"]): Level {
  if (score < t.low) return "Low";
  if (score < t.medium) return "Medium";
  return "High";
}

export function predict(data: TrafficData, q: Query): ScoredRoute[] {
  const routes = findRoutes(data, q.origin, q.destination) ?? [];
  const hour = Number(q.time.split(":")[0] ?? 8);
  const dow = (new Date(`${q.date}T00:00:00`).getDay() + 6) % 7; // Mon=0
  const hf = data.hour_factor[String(hour)] ?? 0.7;
  const df = data.day_factor[String(dow)] ?? 1;
  const wf = data.weather_factor[q.weather] ?? 1;
  const holf = q.holiday ? data.holiday_factor : 1;

  return routes
    .map((r) => {
      const raw = r.base_score * hf * df * wf * holf;
      const score = Math.max(1, Math.min(100, Math.round(raw)));
      const freeFlowKmh = 52;
      const etaMinutes = Math.round(
        (r.distance_km / (freeFlowKmh * (1 - (score / 100) * 0.55))) * 60,
      );
      return { ...r, score, level: classify(score, data.thresholds), etaMinutes };
    })
    .sort((a, b) => a.score - b.score);
}

// ---- Validation -------------------------------------------------------------

export function validateQuery(q: Query, data: TrafficData | null) {
  const errors: Partial<Record<keyof Query, string>> = {};
  if (!q.origin) errors.origin = "Select an origin.";
  if (!q.destination) errors.destination = "Select a destination.";
  if (q.origin && q.origin === q.destination)
    errors.destination = "Destination must differ from origin.";
  if (!/^\d{2}:\d{2}$/.test(q.time)) {
    errors.time = "Enter a valid time (HH:MM).";
  } else {
    const [h, m] = q.time.split(":").map(Number);
    if (h > 23 || m > 59) errors.time = "Time must be between 00:00 and 23:59.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date) || Number.isNaN(Date.parse(q.date)))
    errors.date = "Pick a valid travel date.";
  if (
    !errors.origin &&
    !errors.destination &&
    data &&
    !findRoutes(data, q.origin, q.destination)
  )
    errors.destination = "No modelled route for this pair yet — try another destination.";
  return errors;
}

// ---- Feedback log + drift (localStorage) -----------------------------------

export type FeedbackEntry = {
  id: string;
  at: number;
  origin: string;
  destination: string;
  time: string;
  route: string;
  predictedScore: number;
  predictedLevel: Level;
  actualLevel: Level;
  matched: boolean;
};

const KEY = "traffiq.feedback.v1";
const LEVEL_SCORE: Record<Level, number> = { Low: 25, Medium: 55, High: 85 };

export function readFeedback(): FeedbackEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveFeedback(entry: FeedbackEntry): FeedbackEntry[] {
  const next = [entry, ...readFeedback()].slice(0, 200);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearFeedback() {
  window.localStorage.removeItem(KEY);
}

export type DriftReport = {
  samples: number;
  accuracy: number;
  meanError: number;
  bias: "over-predicting" | "under-predicting" | "calibrated";
  recentAvg: number;
  historicalAvg: number;
  drifting: boolean;
};

export function computeDrift(entries: FeedbackEntry[]): DriftReport | null {
  if (!entries.length) return null;
  const matched = entries.filter((e) => e.matched).length;
  const errors = entries.map((e) => e.predictedScore - LEVEL_SCORE[e.actualLevel]);
  const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const recent = entries.slice(0, Math.max(1, Math.min(10, entries.length)));
  const recentAvg = recent.reduce((a, e) => a + e.predictedScore, 0) / recent.length;
  const historicalAvg =
    entries.reduce((a, e) => a + e.predictedScore, 0) / entries.length;
  return {
    samples: entries.length,
    accuracy: Math.round((matched / entries.length) * 100),
    meanError: Math.round(meanError),
    bias:
      meanError > 8 ? "over-predicting" : meanError < -8 ? "under-predicting" : "calibrated",
    recentAvg: Math.round(recentAvg),
    historicalAvg: Math.round(historicalAvg),
    drifting: Math.abs(recentAvg - historicalAvg) > 10,
  };
}
