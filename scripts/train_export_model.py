"""Export a browser-ready Bengaluru congestion model from real observations.

The source is the open Bengaluru traffic dataset maintained by Traffic Monitor
Lizard. It contains timestamped Google Maps travel-time estimates for real
city routes. The browser only reads the compact JSON generated here; Python
and pandas are never used in production.

Usage:
    pip install pandas
    python scripts/train_export_model.py
"""

import json
import os

import pandas as pd

TRAFFIC_URL = "https://raw.githubusercontent.com/thecont1/traffic-monitor-lizard/main/data/csv-traffic-bangalore.csv"
ROUTES_URL = "https://raw.githubusercontent.com/thecont1/traffic-monitor-lizard/main/data/csv-routes-bangalore.csv"
SOURCE_URL = "https://github.com/thecont1/traffic-monitor-lizard"
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "traffic_data.json"))
WEATHER = ["clear", "rain"]


def load_dataset() -> tuple[pd.DataFrame, pd.DataFrame]:
    traffic = pd.read_csv(TRAFFIC_URL)
    routes = pd.read_csv(ROUTES_URL)
    required = {"date", "time", "route_code", "duration", "distance", "rsi_flag"}
    missing = required - set(traffic.columns)
    if missing:
        raise ValueError(f"Traffic source is missing columns: {sorted(missing)}")

    traffic["duration"] = pd.to_numeric(traffic["duration"], errors="coerce")
    traffic["distance"] = pd.to_numeric(traffic["distance"], errors="coerce")
    traffic = traffic.dropna(subset=["date", "time", "route_code", "duration", "distance"])
    traffic = traffic[(traffic["duration"] > 0) & (traffic["distance"] > 0)]
    traffic["date_value"] = pd.to_datetime(traffic["date"], errors="coerce")
    traffic = traffic.dropna(subset=["date_value"])
    traffic["hour"] = traffic["time"].str.slice(0, 2).astype(int)
    traffic["dow"] = traffic["date_value"].dt.dayofweek
    traffic["weather"] = traffic["rsi_flag"].fillna("").str.lower().str.contains("rain").map(
        {True: "rain", False: "clear"}
    )
    return traffic, routes


def median_factor(series: pd.Series, baseline: float) -> dict[str, float]:
    values = series.groupby(series.index).median()
    return {str(key): round(float(value / baseline), 3) for key, value in values.items()}


def main() -> None:
    df, route_catalog = load_dataset()

    # A route's free-flow baseline is its 10th percentile duration. Scores
    # measure excess duration against that route's 90th percentile, making
    # routes comparable even when their distances differ.
    free_flow = df.groupby("route_code")["duration"].quantile(0.10).rename("free_flow")
    congested = df.groupby("route_code")["duration"].quantile(0.90).rename("congested")
    df = df.join(free_flow, on="route_code").join(congested, on="route_code")
    spread = (df["congested"] - df["free_flow"]).clip(lower=1)
    df["score"] = (((df["duration"] - df["free_flow"]) / spread) * 100).clip(0, 100)

    overall_score = float(df["score"].median())
    hour_scores = df.groupby("hour")["score"].median()
    day_scores = df.groupby("dow")["score"].median()
    weather_scores = df.groupby("weather")["score"].median()

    hour_factor = {str(hour): round(float(score / overall_score), 3) for hour, score in hour_scores.items()}
    day_factor = {str(day): round(float(score / day_scores.loc[0]), 3) for day, score in day_scores.items()}
    weather_factor = {
        weather: round(float(weather_scores.get(weather, overall_score) / weather_scores["clear"]), 3)
        for weather in WEATHER
    }

    catalog = route_catalog.set_index("route_code")
    routes: dict[str, list[dict]] = {}
    locations: list[str] = []
    route_stats = df.groupby("route_code").agg(
        base_score=("score", "median"),
        distance_km=("distance", "median"),
        observations=("score", "size"),
    )

    for route_code, stats in route_stats.iterrows():
        if route_code not in catalog.index:
            continue
        label = str(catalog.loc[route_code, "label_full"])
        endpoints = [part.strip() for part in label.split("→", maxsplit=1)]
        if len(endpoints) != 2:
            continue
        origin, destination = endpoints
        locations.extend([origin, destination])
        route_key = f"{origin}>{destination}"
        routes[route_key] = [
            {
                "id": str(route_code),
                "name": str(catalog.loc[route_code, "label_short"]),
                "distance_km": round(float(stats["distance_km"]), 1),
                "base_score": round(float(stats["base_score"]), 1),
                "via": "Google Maps observed route",
                "observations": int(stats["observations"]),
            }
        ]

    dates = pd.to_datetime(df["date_value"])
    sorted_locations = sorted(set(locations))
    payload = {
        "meta": {
            "source": "Traffic Monitor Lizard — Bengaluru traffic snapshots (Google Maps estimates)",
            "source_url": SOURCE_URL,
            "license": "CC BY 4.0",
            "model": "Observed-duration baseline → route, hour, weekday and rain factors",
            "version": "2.0.0",
            "generated_by": "scripts/train_export_model.py",
            "target": "congestion score (0–100) from observed duration above route free-flow baseline",
            "observations": int(len(df)),
            "routes_observed": int(len(routes)),
            "date_range": {"start": dates.min().date().isoformat(), "end": dates.max().date().isoformat()},
            "weather_coverage": "The source contains clear conditions and rain flags; other weather types are not inferred.",
        },
        "locations": sorted_locations,
        "location_states": {location: "Karnataka" for location in sorted_locations},
        "hour_factor": hour_factor,
        "day_factor": day_factor,
        "weather_factor": weather_factor,
        # The source has no holiday indicator, so holiday remains neutral.
        "holiday_factor": 1,
        "thresholds": {"low": 40, "medium": 70},
        "routes": routes,
    }

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    print(
        f"Exported {len(df):,} observations across {len(routes)} routes "
        f"({dates.min().date()} to {dates.max().date()}) to {OUT}"
    )


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
