"""Small educational credit-risk scoring web app.

The model is deliberately trained from a deterministic, synthetic sample at
startup.  It keeps the project tiny while making its illustrative nature clear:
it is not suitable for real lending decisions.
"""
from __future__ import annotations

import os
import random

from flask import Flask, jsonify, render_template, request
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

app = Flask(__name__)

FEATURES = (
    "monthly_income",
    "monthly_debt_payments",
    "loan_amount",
    "annual_interest_rate",
    "credit_history_years",
    "missed_payments_12m",
)


def build_model() -> Pipeline:
    """Train on normalized financial ratios, not raw currency amounts.

    This keeps the score meaningful whether the user enters a $3,000 or
    $60,000 monthly income.  The fitted probability is an educational
    percentage estimate, rather than a binary approve/reject decision.
    """
    rng = random.Random(42)
    samples, labels = [], []
    for _ in range(2_000):
        income = rng.randint(1_500, 100_000)
        debt = rng.randint(0, int(income * 0.85))
        loan = rng.randint(1_000, int(income * 24))
        rate = rng.uniform(4.0, 32.0)
        history = rng.uniform(0.25, 25.0)
        missed = rng.choices(range(7), weights=(48, 24, 13, 7, 4, 2, 1))[0]

        debt_ratio = debt / income
        loan_ratio = loan / (income * 12)
        risk_signal = (
            -3.0
            + 3.6 * debt_ratio
            + 2.8 * loan_ratio
            + 1.2 * (rate / 100)
            + 0.42 * missed
            - 0.035 * history
            + rng.uniform(-0.35, 0.35)
        )
        labels.append(int(risk_signal >= 0))
        samples.append([debt_ratio, loan_ratio, rate / 100, history, missed])

    return Pipeline(
        [
            ("scale", StandardScaler()),
            # liblinear is deliberately quick for this small, five-feature
            # educational model and keeps cloud cold starts short.
            ("classifier", LogisticRegression(solver="liblinear", max_iter=100, random_state=42)),
        ]
    ).fit(samples, labels)


MODEL = build_model()


def parse_payload(payload: dict) -> list[float]:
    values = []
    for feature in FEATURES:
        try:
            value = float(payload[feature])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Enter a valid number for {feature.replace('_', ' ')}.") from exc
        if value < 0:
            raise ValueError(f"{feature.replace('_', ' ').capitalize()} cannot be negative.")
        values.append(value)

    if values[0] == 0:
        raise ValueError("Monthly income must be greater than zero.")
    if values[3] > 100:
        raise ValueError("Annual interest rate must be 100% or below.")
    return values


def score(values: list[float]) -> dict:
    income, debt, loan, rate, history, missed = values
    debt_ratio = debt / income
    loan_ratio = loan / (income * 12)
    normalized_profile = [[debt_ratio, loan_ratio, rate / 100, history, missed]]
    probability = float(MODEL.predict_proba(normalized_profile)[0][1])
    # Blend ML probability with an explainable financial-factor percentage.
    # This keeps the result stable for very safe profiles instead of claiming
    # an unrealistic near-zero chance of default.
    factor_score = (
        min(debt_ratio / 0.60, 1) * 35
        + min(loan_ratio / 1.50, 1) * 25
        + min(max(rate - 6, 0) / 24, 1) * 15
        + min(missed / 4, 1) * 15
        + min(max(10 - history, 0) / 10, 1) * 10
    )
    risk_score = max(1, min(99, round((probability * 100 * 0.4) + (factor_score * 0.6))))
    if risk_score < 30:
        band, decision = "Low risk", "Favourable profile"
        low_months, high_months = 6, 20
    elif risk_score < 65:
        band, decision = "Moderate risk", "Review recommended"
        low_months, high_months = 3, 12
    else:
        band, decision = "High risk", "Higher default-risk signal"
        low_months, high_months = 1, 6

    # An affordability illustration based on disposable monthly income. This is
    # intentionally conservative and must never be used as a real sanction.
    disposable_income = max(0, income - debt)
    sanction_low = round((disposable_income * low_months) / 1_000) * 1_000
    sanction_high = round((disposable_income * high_months) / 1_000) * 1_000
    return {
        "risk_score": risk_score,
        "band": band,
        "decision": decision,
        "sanction_low": sanction_low,
        "sanction_high": sanction_high,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/score")
def api_score():
    payload = request.get_json(silent=True) or request.form.to_dict()
    try:
        result = score(parse_payload(payload))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
