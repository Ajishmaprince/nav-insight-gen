"""
Module 1 - Core AI model training + export (run in Colab or locally).

Trains a congestion predictor on the UCI "Metro Interstate Traffic Volume"
dataset (or a synthetic fallback with the same columns) and exports a
precomputed prediction table to `public/traffic_data.json`, which the static
frontend reads client-side. No Python runs in production.

Usage:
    pip install pandas scikit-learn
    python scripts/train_export_model.py
"""

import json
import math
import os
import random

import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

UCI_URL = (
    "https://archive.ics.uci.edu/ml/machine-learning-databases/00492/"
    "Metro_Interstate_Traffic_Volume.csv.gz"
)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "traffic_data.json")
WEATHER = ["clear", "clouds", "rain", "fog", "snow"]


def load_dataset() -> pd.DataFrame:
    try:
        df = pd.read_csv(UCI_URL, compression="gzip")
        df["date_time"] = pd.to_datetime(df["date_time"])
        df["hour"] = df["date_time"].dt.hour
        df["dow"] = df["date_time"].dt.dayofweek
        df["holiday_flag"] = (df["holiday"] != "None").astype(int)
        df["weather"] = df["weather_main"].str.lower().where(
            df["weather_main"].str.lower().isin(WEATHER), "clear"
        )
        return df[["hour", "dow", "holiday_flag", "weather", "traffic_volume"]]
    except Exception as exc:  # offline / dataset moved -> synthetic fallback
        print(f"UCI download failed ({exc}); generating synthetic dataset.")
        rows = []
        random.seed(7)
        for _ in range(20000):
            hour = random.randrange(24)
            dow = random.randrange(7)
            holiday = 1 if random.random() < 0.03 else 0
            weather = random.choice(WEATHER)
            peak = math.exp(-((hour - 8) ** 2) / 6) + math.exp(-((hour - 17.5) ** 2) / 7)
            vol = 6000 * (0.15 + 0.85 * peak)
            vol *= 1.0 if dow < 5 else 0.65
            vol *= 0.68 if holiday else 1.0
            vol *= {"clear": 1.0, "clouds": 1.03, "rain": 1.18, "fog": 1.24, "snow": 1.35}[weather]
            rows.append(
                dict(
                    hour=hour,
                    dow=dow,
                    holiday_flag=holiday,
                    weather=weather,
                    traffic_volume=max(0, vol + random.gauss(0, 250)),
                )
            )
        return pd.DataFrame(rows)


def main() -> None:
    df = load_dataset()
    X = pd.get_dummies(df[["hour", "dow", "holiday_flag", "weather"]], columns=["weather"])
    y = df["traffic_volume"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=200, min_samples_leaf=3, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    print(f"MAE={mean_absolute_error(y_test, pred):.1f}  R2={r2_score(y_test, pred):.3f}")

    # --- Export: reduce the fitted model to multiplicative factor tables ---
    def factor(col: str, value, base_row: dict) -> float:
        row = dict(base_row)
        row[col] = value
        frame = pd.DataFrame([row]).reindex(columns=X.columns, fill_value=0)
        return float(model.predict(frame)[0])

    base = {c: 0 for c in X.columns}
    base.update({"hour": 8, "dow": 0, "holiday_flag": 0, "weather_clear": 1})
    peak = factor("hour", 8, base)

    hour_factor = {str(h): round(factor("hour", h, base) / peak, 3) for h in range(24)}
    day_factor = {str(d): round(factor("dow", d, base) / factor("dow", 0, base), 3) for d in range(7)}
    weather_factor = {}
    for w in WEATHER:
        row = dict(base)
        for other in WEATHER:
            row[f"weather_{other}"] = 1 if other == w else 0
        frame = pd.DataFrame([row]).reindex(columns=X.columns, fill_value=0)
        weather_factor[w] = round(float(model.predict(frame)[0]) / peak, 3)

    with open(os.path.abspath(OUT), "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    payload["hour_factor"] = hour_factor
    payload["day_factor"] = day_factor
    payload["weather_factor"] = weather_factor
    payload["meta"]["model"] = "RandomForestRegressor -> precomputed prediction table"

    with open(os.path.abspath(OUT), "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
