"""RiskLens — Lightweight Credit Risk Assessment & Explainable AI (XAI) Suite.

Demonstrates modern credit risk modeling using 4 ML architectures:
- Logistic Regression (Linear baseline)
- Random Forest (Bagging ensemble)
- Gradient Boosting (Boosting ensemble)
- Multi-Layer Perceptron (Neural network)
with local instance-level explainability (waterfall attribution) and global feature importance.
"""
from __future__ import annotations

import os
from typing import Dict, List, Tuple
from flask import Flask, jsonify, render_template, request
import numpy as np

from models import FEATURE_KEYS, FEATURE_META, SUITE

app = Flask(__name__)

INPUT_FIELDS = (
    "monthly_income",
    "monthly_debt_payments",
    "loan_amount",
    "annual_interest_rate",
    "credit_history_years",
    "missed_payments_12m",
)


def parse_payload(payload: dict) -> Dict[str, float]:
    """Validates and parses numerical input values from request."""
    values: Dict[str, float] = {}
    for field in INPUT_FIELDS:
        try:
            val = float(payload[field])
        except (KeyError, TypeError, ValueError) as exc:
            field_name = field.replace("_", " ").capitalize()
            raise ValueError(f"Please provide a valid number for {field_name}.") from exc

        if val < 0:
            field_name = field.replace("_", " ").capitalize()
            raise ValueError(f"{field_name} cannot be negative.")
        values[field] = val

    if values["monthly_income"] <= 0:
        raise ValueError("Monthly income must be greater than zero.")
    if values["annual_interest_rate"] > 100:
        raise ValueError("Annual interest rate must be 100% or below.")
    if values["credit_history_years"] > 60:
        raise ValueError("Credit history length cannot exceed 60 years.")
    if values["missed_payments_12m"] > 30:
        raise ValueError("Missed payments cannot exceed 30.")

    return values


def compute_sanction_and_guidance(
    income: float, debt: float, loan: float, risk_score: int, band: str, dti: float, missed: float
) -> Dict[str, Any]:
    """Determines conservative indicative sanction limits and actionable credit advice."""
    disposable_income = max(0.0, income - debt)

    if risk_score < 30:
        low_mult, high_mult = 8, 24
        if dti < 0.25 and missed == 0:
            advice = "Exceptional profile. Eligible for prime tier rates and maximum tenure flexibility."
        else:
            advice = "Strong credit standing. Maintaining clean payment records secures preferred interest discounts."
    elif risk_score < 65:
        low_mult, high_mult = 4, 12
        if missed > 0:
            advice = f"Recent delinquency ({int(missed)} missed) recorded. 6 consecutive timely payments will substantially elevate score."
        elif dti > 0.40:
            target_debt = income * 0.30
            debt_reduction = max(0.0, debt - target_debt)
            advice = f"Elevated DTI ({dti * 100:.0f}%). Reducing monthly obligations by ~₹{int(debt_reduction):,} helps qualify for prime tier."
        else:
            advice = "Moderate risk classification. Additional income proof or collateral may be requested."
    else:
        low_mult, high_mult = 1, 5
        if missed >= 2:
            advice = "High delinquency count detected. Focus on curing overdue accounts before seeking major unsecured credit."
        elif dti > 0.50:
            advice = "Severe debt burden detected. Restructuring existing obligations is advised before taking on new principal."
        else:
            advice = "High default-risk indicators present. Loan restructuring or credit counseling strongly recommended."

    sanction_low = int(round((disposable_income * low_mult) / 5_000.0) * 5_000)
    sanction_high = int(round((disposable_income * high_mult) / 5_000.0) * 5_000)

    # Floor sanction to prevent 0 when disposable income is positive
    if disposable_income > 0:
        sanction_low = max(25_000, sanction_low)
        sanction_high = max(sanction_low, sanction_high)

    return {
        "disposable_income": int(round(disposable_income)),
        "sanction_low": sanction_low,
        "sanction_high": sanction_high,
        "action_advice": advice,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/models")
def api_models():
    """Returns static model architectures, holdout benchmark scores, and global feature importance."""
    return jsonify({
        "models": SUITE.benchmarks,
        "global_importance": SUITE.global_importance,
        "feature_meta": FEATURE_META,
        "baseline_risk": round(SUITE.baseline_risk * 100, 1),
    })


@app.post("/api/score")
def api_score():
    """Scores an applicant across all 4 ML models and computes explainable AI attributions."""
    payload = request.get_json(silent=True) or request.form.to_dict()
    try:
        raw_inputs = parse_payload(payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    income = raw_inputs["monthly_income"]
    debt = raw_inputs["monthly_debt_payments"]
    loan = raw_inputs["loan_amount"]
    rate = raw_inputs["annual_interest_rate"]
    history = raw_inputs["credit_history_years"]
    missed = raw_inputs["missed_payments_12m"]

    dti = debt / income
    lti = loan / (income * 12.0)
    rate_norm = rate / 100.0

    X_input = np.array([[dti, lti, rate_norm, history, missed]], dtype=np.float64)
    raw_feature_dict = {
        "debt_to_income": dti,
        "loan_to_income": lti,
        "annual_interest_rate": rate_norm,
        "credit_history_years": history,
        "missed_payments_12m": missed,
    }

    # 1. Multi-Model Inference
    multi_model_result = SUITE.predict_all_models(X_input)
    consensus = multi_model_result["consensus"]

    # 2. Explainable AI (XAI) Attribution & Waterfall
    xai_result = SUITE.explain_instance(X_input, raw_feature_dict)

    # 3. Decision Tree Scatter & Node Path
    tree_path_result = SUITE.evaluate_decision_tree_path(raw_feature_dict)

    # 4. Indicative Sanction & Advice
    sanction_info = compute_sanction_and_guidance(
        income, debt, loan, consensus["risk_score"], consensus["band"], dti, missed
    )

    # 5. Leveled 4-tier Decision Pipeline
    pipeline_levels = SUITE.generate_leveled_decision_pipeline(
        raw_inputs=raw_inputs,
        ratios={"debt_to_income": dti * 100, "loan_to_income": lti},
        multi_model_result=multi_model_result,
        xai_result=xai_result,
        sanction_info=sanction_info,
    )

    return jsonify({
        "consensus": {
            "risk_score": consensus["risk_score"],
            "probability": consensus["probability"],
            "band": consensus["band"],
            "decision": consensus["decision"],
            "agreement": consensus["agreement"],
            "sanction_low": sanction_info["sanction_low"],
            "sanction_high": sanction_info["sanction_high"],
            "disposable_income": sanction_info["disposable_income"],
            "action_advice": sanction_info["action_advice"],
        },
        "models": multi_model_result["models"],
        "tree_path": tree_path_result,
        "xai": {
            "baseline_risk": xai_result["baseline_risk"],
            "target_risk": xai_result["target_risk"],
            "attributions": xai_result["attributions"],
            "waterfall": xai_result["waterfall"],
            "top_risk_driver": xai_result["top_risk_driver"],
            "top_mitigant": xai_result["top_mitigant"],
            "global_importance": SUITE.global_importance,
        },
        "pipeline": pipeline_levels,
        "inputs": raw_inputs,
    })


@app.get("/api/health")
def api_health():
    return jsonify({
        "status": "healthy",
        "models_count": len(SUITE.models),
        "models_ready": list(SUITE.models.keys()),
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
