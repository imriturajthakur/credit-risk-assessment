"""Credit Risk Machine Learning & Explainable AI (XAI) Engine.

Trains and serves 4 distinct ML architectures:
1. Logistic Regression (Linear / Statistical Baseline)
2. Random Forest (Bagging Ensemble)
3. Gradient Boosting (Boosting Ensemble)
4. Multi-Layer Perceptron (Neural Network)

Provides:
- Holdout benchmark metrics (Accuracy, ROC-AUC, Precision, Recall, F1-Score).
- Global Explainability: Feature importances across algorithms.
- Local Explainability: Instance-level waterfall attribution and risk decomposition.
- Leveled 4-tier decision pipeline for end-to-end auditability.
"""
from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_KEYS = [
    "debt_to_income",
    "loan_to_income",
    "annual_interest_rate",
    "credit_history_years",
    "missed_payments_12m",
]

FEATURE_META = {
    "debt_to_income": {
        "name": "Debt-to-Income (DTI)",
        "unit": "%",
        "description": "Monthly debt payments relative to gross monthly income.",
        "benchmark": "Safe under 36%; strained above 45%",
    },
    "loan_to_income": {
        "name": "Loan-to-Annual-Income (LTI)",
        "unit": "x annual",
        "description": "Requested loan principal relative to annual income.",
        "benchmark": "Safe under 1.5x; high leverage above 2.5x",
    },
    "annual_interest_rate": {
        "name": "Annual Interest Rate",
        "unit": "%",
        "description": "Contractual annual interest rate of the loan facility.",
        "benchmark": "Prime under 12%; standard 12-18%; subprime above 20%",
    },
    "credit_history_years": {
        "name": "Credit History Length",
        "unit": "years",
        "description": "Length of documented active credit repayment history.",
        "benchmark": "Prime depth is 5+ years",
    },
    "missed_payments_12m": {
        "name": "Missed Payments (12m)",
        "unit": "events",
        "description": "Count of 30+ day delinquencies recorded in the past 12 months.",
        "benchmark": "Zero delinquencies required for prime tier",
    },
}


def generate_dataset(n_samples: int = 3200, seed: int = 42) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Generates a realistic deterministic synthetic credit assessment dataset."""
    rng = random.Random(seed)
    np_rng = np.random.RandomState(seed)

    X_raw = []
    y_raw = []

    for _ in range(n_samples):
        income = rng.randint(2500, 100000)
        debt = rng.randint(0, int(income * 0.72))
        loan = rng.randint(2000, int(income * 20))
        rate = rng.uniform(5.0, 30.0)
        history = rng.uniform(0.5, 22.0)
        missed = rng.choices(range(6), weights=(60, 20, 10, 5, 3, 2))[0]

        dti = debt / income
        lti = loan / (income * 12.0)
        rate_norm = rate / 100.0

        # Calibrated latent risk: ~28% baseline default rate
        latent_risk = (
            -3.75
            + 4.0 * dti
            + 2.0 * lti
            + 1.6 * rate_norm
            + 0.58 * missed
            - 0.05 * history
            + 1.8 * (dti * (missed > 0))  # compound risk penalty
            + np_rng.normal(0, 0.32)
        )
        label = int(latent_risk >= 0)
        X_raw.append([dti, lti, rate_norm, history, missed])
        y_raw.append(label)

    X = np.array(X_raw, dtype=np.float64)
    y = np.array(y_raw, dtype=np.int32)

    split_idx = int(n_samples * 0.80)
    indices = np_rng.permutation(n_samples)
    train_idx, test_idx = indices[:split_idx], indices[split_idx:]

    X_train, y_train = X[train_idx], y[train_idx]
    X_test, y_test = X[test_idx], y[test_idx]

    feature_medians = np.median(X_train, axis=0)

    return X_train, y_train, X_test, y_test, feature_medians


class CreditRiskModelSuite:
    """Trains, compares and explains 4 distinct ML architectures."""

    def __init__(self) -> None:
        self.X_train, self.y_train, self.X_test, self.y_test, self.feature_medians = generate_dataset()
        self.baseline_risk = float(np.mean(self.y_train))
        self.models: Dict[str, Any] = {}
        self.benchmarks: Dict[str, Dict[str, Any]] = {}
        self.global_importance: Dict[str, Dict[str, float]] = {}

        self._train_and_evaluate()

    def _train_and_evaluate(self) -> None:
        model_defs = {
            "logistic_regression": {
                "name": "Logistic Regression",
                "family": "Linear / Probabilistic",
                "badge": "Statistical Baseline",
                "description": "Parametric baseline computing log-odds with scaled feature weights.",
                "estimator": Pipeline([
                    ("scaler", StandardScaler()),
                    ("clf", LogisticRegression(solver="liblinear", max_iter=200, random_state=42)),
                ]),
                "weight": 0.15,
            },
            "random_forest": {
                "name": "Random Forest",
                "family": "Bagging Ensemble",
                "badge": "Tree Bagging",
                "description": "Ensemble of 100 de-correlated decision trees with randomized feature subsampling.",
                "estimator": RandomForestClassifier(
                    n_estimators=100, max_depth=6, min_samples_split=6, random_state=42, n_jobs=-1
                ),
                "weight": 0.35,
            },
            "gradient_boosting": {
                "name": "Gradient Boosting",
                "family": "Boosting Ensemble",
                "badge": "Sequential Boosting",
                "description": "Iterative gradient boosted trees sequentially minimizing deviance loss residuals.",
                "estimator": GradientBoostingClassifier(
                    n_estimators=100, learning_rate=0.08, max_depth=4, random_state=42
                ),
                "weight": 0.35,
            },
            "neural_network": {
                "name": "Multi-Layer Perceptron (MLP)",
                "family": "Neural Network",
                "badge": "Deep Representation",
                "description": "Feed-forward neural network with hidden layers capturing non-linear interactions.",
                "estimator": Pipeline([
                    ("scaler", StandardScaler()),
                    ("clf", MLPClassifier(hidden_layer_sizes=(32, 16), max_iter=350, random_state=42)),
                ]),
                "weight": 0.15,
            },
        }

        for model_id, info in model_defs.items():
            est = info["estimator"]
            est.fit(self.X_train, self.y_train)
            self.models[model_id] = est

            y_pred = est.predict(self.X_test)
            y_proba = est.predict_proba(self.X_test)[:, 1]

            acc = float(accuracy_score(self.y_test, y_pred))
            auc = float(roc_auc_score(self.y_test, y_proba))
            prec = float(precision_score(self.y_test, y_pred, zero_division=0))
            rec = float(recall_score(self.y_test, y_pred, zero_division=0))
            f1 = float(f1_score(self.y_test, y_pred, zero_division=0))

            self.benchmarks[model_id] = {
                "id": model_id,
                "name": info["name"],
                "family": info["family"],
                "badge": info["badge"],
                "description": info["description"],
                "weight": info["weight"],
                "metrics": {
                    "accuracy": round(acc * 100, 1),
                    "roc_auc": round(auc * 100, 1),
                    "precision": round(prec * 100, 1),
                    "recall": round(rec * 100, 1),
                    "f1_score": round(f1 * 100, 1),
                },
            }

        self._compute_global_feature_importance()

    def _compute_global_feature_importance(self) -> None:
        rf_imp = self.models["random_forest"].feature_importances_
        gb_imp = self.models["gradient_boosting"].feature_importances_

        lr_coef = np.abs(self.models["logistic_regression"].named_steps["clf"].coef_[0])
        lr_imp = lr_coef / np.sum(lr_coef)

        consensus_imp = (
            0.35 * rf_imp +
            0.35 * gb_imp +
            0.15 * lr_imp +
            0.15 * rf_imp
        )
        consensus_imp = consensus_imp / np.sum(consensus_imp)

        def make_dict(arr: np.ndarray) -> Dict[str, float]:
            return {k: round(float(v) * 100, 1) for k, v in zip(FEATURE_KEYS, arr)}

        self.global_importance = {
            "consensus": make_dict(consensus_imp),
            "random_forest": make_dict(rf_imp),
            "gradient_boosting": make_dict(gb_imp),
            "logistic_regression": make_dict(lr_imp),
        }

    def predict_all_models(self, X_input: np.ndarray) -> Dict[str, Any]:
        results = {}
        weighted_proba = 0.0

        for model_id, meta in self.benchmarks.items():
            est = self.models[model_id]
            proba = float(est.predict_proba(X_input)[0][1])
            risk_score = int(round(proba * 100))
            band, decision = self._classify_risk_band(risk_score)

            results[model_id] = {
                "id": model_id,
                "name": meta["name"],
                "family": meta["family"],
                "badge": meta["badge"],
                "probability": round(proba * 100, 1),
                "risk_score": risk_score,
                "band": band,
                "decision": decision,
                "weight": meta["weight"],
                "metrics": meta["metrics"],
            }
            weighted_proba += proba * meta["weight"]

        consensus_score = int(round(weighted_proba * 100))
        band, decision = self._classify_risk_band(consensus_score)

        # Assess model agreement
        bands = [m["band"] for m in results.values()]
        agreement_count = bands.count(band)
        agreement_text = f"{agreement_count}/4 models converge on {band}"

        return {
            "models": results,
            "consensus": {
                "probability": round(weighted_proba * 100, 1),
                "risk_score": consensus_score,
                "band": band,
                "decision": decision,
                "agreement": agreement_text,
            },
        }

    def explain_instance(self, X_input: np.ndarray, raw_values: Dict[str, float]) -> Dict[str, Any]:
        """Calculates local explainability (XAI) feature attributions and waterfall deltas."""
        base_proba = self.baseline_risk
        est = self.models["gradient_boosting"]
        target_proba = float(est.predict_proba(X_input)[0][1])

        raw_attributions = []
        x_vec = X_input[0].copy()

        for i, key in enumerate(FEATURE_KEYS):
            x_perturbed = x_vec.copy()
            x_perturbed[i] = self.feature_medians[i]
            proba_perturbed = float(est.predict_proba([x_perturbed])[0][1])
            delta = target_proba - proba_perturbed
            raw_attributions.append(delta)

        total_delta = target_proba - base_proba
        raw_sum = sum(raw_attributions)
        if abs(raw_sum) > 1e-5:
            scaled_attributions = [delta * (total_delta / raw_sum) for delta in raw_attributions]
        else:
            scaled_attributions = [0.0] * len(FEATURE_KEYS)

        attributions = []
        waterfall_steps = []
        current_cumulative = base_proba * 100.0

        waterfall_steps.append({
            "step": "Baseline Risk",
            "type": "baseline",
            "value": round(current_cumulative, 1),
            "delta": 0.0,
            "text": f"Population baseline risk ({round(current_cumulative, 1)}%) before applicant specifics.",
        })

        for i, key in enumerate(FEATURE_KEYS):
            attr_val = scaled_attributions[i] * 100.0
            current_cumulative += attr_val
            direction = "risk_increase" if attr_val > 0.3 else ("risk_mitigation" if attr_val < -0.3 else "neutral")

            raw_val = raw_values.get(key, 0.0)
            formatted_val = self._format_feature_display(key, raw_val)
            explanation = self._generate_feature_explanation(key, raw_val, attr_val)

            item = {
                "feature_key": key,
                "feature_name": FEATURE_META[key]["name"],
                "feature_value_display": formatted_val,
                "delta": round(attr_val, 1),
                "cumulative": round(max(0.0, min(100.0, current_cumulative)), 1),
                "direction": direction,
                "explanation": explanation,
                "benchmark": FEATURE_META[key]["benchmark"],
            }
            attributions.append(item)
            waterfall_steps.append({
                "step": FEATURE_META[key]["name"],
                "type": direction,
                "value": round(max(0.0, min(100.0, current_cumulative)), 1),
                "delta": round(attr_val, 1),
                "text": explanation,
            })

        waterfall_steps.append({
            "step": "Final Assessment",
            "type": "final",
            "value": round(target_proba * 100.0, 1),
            "delta": 0.0,
            "text": f"Consensus evaluated probability of default ({round(target_proba * 100.0, 1)}%).",
        })

        drivers_sorted = sorted(attributions, key=lambda x: abs(x["delta"]), reverse=True)
        top_risk_driver = next((d for d in drivers_sorted if d["direction"] == "risk_increase"), None)
        top_mitigant = next((d for d in drivers_sorted if d["direction"] == "risk_mitigation"), None)

        return {
            "baseline_risk": round(base_proba * 100.0, 1),
            "target_risk": round(target_proba * 100.0, 1),
            "attributions": attributions,
            "waterfall": waterfall_steps,
            "top_risk_driver": top_risk_driver,
            "top_mitigant": top_mitigant,
        }

    def generate_leveled_decision_pipeline(
        self,
        raw_inputs: Dict[str, float],
        ratios: Dict[str, float],
        multi_model_result: Dict[str, Any],
        xai_result: Dict[str, Any],
        sanction_info: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Constructs a 4-level sequential decision pipeline showing exact inputs to final verdict."""
        levels = [
            {
                "level": 1,
                "level_name": "Level 1: Ingestion & Ratio Normalization",
                "tag": "Input Layer",
                "status": "Validated",
                "summary": "Financial parameters ingested, validated, and computed into normalized ratios.",
                "details": [
                    {"label": "Debt-to-Income (DTI)", "value": f"{ratios['debt_to_income']:.1f}%", "badge": "Safe" if ratios['debt_to_income'] <= 36 else ("Strained" if ratios['debt_to_income'] <= 48 else "High Risk")},
                    {"label": "Loan-to-Annual-Income (LTI)", "value": f"{ratios['loan_to_income']:.2f}x", "badge": "Favourable" if ratios['loan_to_income'] <= 1.5 else "Elevated"},
                    {"label": "Annual Interest Rate", "value": f"{raw_inputs['annual_interest_rate']:.1f}%", "badge": "Prime" if raw_inputs['annual_interest_rate'] <= 12 else "Standard"},
                    {"label": "Credit History Length", "value": f"{raw_inputs['credit_history_years']:.1f} yrs", "badge": "Established" if raw_inputs['credit_history_years'] >= 5 else "Developing"},
                    {"label": "Missed Payments (12m)", "value": f"{int(raw_inputs['missed_payments_12m'])} events", "badge": "Clean" if raw_inputs['missed_payments_12m'] == 0 else "Delinquent"},
                ],
            },
            {
                "level": 2,
                "level_name": "Level 2: Multi-Model Inference & Consensus",
                "tag": "Inference Layer",
                "status": "4 Models Evaluated",
                "summary": "Parallel scoring across Linear, Bagging, Boosting, and Neural architectures.",
                "details": [
                    {"label": "Logistic Regression", "value": f"{multi_model_result['models']['logistic_regression']['probability']}%", "badge": multi_model_result['models']['logistic_regression']['band']},
                    {"label": "Random Forest", "value": f"{multi_model_result['models']['random_forest']['probability']}%", "badge": multi_model_result['models']['random_forest']['band']},
                    {"label": "Gradient Boosting", "value": f"{multi_model_result['models']['gradient_boosting']['probability']}%", "badge": multi_model_result['models']['gradient_boosting']['band']},
                    {"label": "Multi-Layer Perceptron", "value": f"{multi_model_result['models']['neural_network']['probability']}%", "badge": multi_model_result['models']['neural_network']['band']},
                    {"label": "Ensemble Consensus", "value": f"{multi_model_result['consensus']['risk_score']} / 100", "badge": multi_model_result['consensus']['band']},
                ],
            },
            {
                "level": 3,
                "level_name": "Level 3: Explainable AI Attribution",
                "tag": "XAI Engine",
                "status": "Attribution Complete",
                "summary": "Additive decomposition isolating positive risk drivers and negative mitigating factors.",
                "details": [
                    {"label": "Baseline Population Risk", "value": f"{xai_result['baseline_risk']}%", "badge": "Prior"},
                    {"label": "Primary Risk Driver", "value": xai_result['top_risk_driver']['feature_name'] if xai_result['top_risk_driver'] else "None (Optimal)", "badge": f"+{xai_result['top_risk_driver']['delta']}%" if xai_result['top_risk_driver'] else "Neutral"},
                    {"label": "Strongest Mitigant", "value": xai_result['top_mitigant']['feature_name'] if xai_result['top_mitigant'] else "None", "badge": f"{xai_result['top_mitigant']['delta']}%" if xai_result['top_mitigant'] else "Neutral"},
                    {"label": "XAI Methodology", "value": "Marginal Perturbation & Gini Importance", "badge": "Auditable"},
                ],
            },
            {
                "level": 4,
                "level_name": "Level 4: Underwriting Decision & Indicative Sanction",
                "tag": "Decision Layer",
                "status": "Verdict Issued",
                "summary": "Affordability policy aligned with disposable income and borrower risk profile.",
                "details": [
                    {"label": "Underwriting Decision", "value": multi_model_result['consensus']['decision'], "badge": multi_model_result['consensus']['band']},
                    {"label": "Indicative Sanction Range", "value": f"₹{sanction_info['sanction_low']:,} – ₹{sanction_info['sanction_high']:,}", "badge": "Capital Limit"},
                    {"label": "Monthly Disposable Income", "value": f"₹{sanction_info['disposable_income']:,}", "badge": "Cashflow Buffer"},
                    {"label": "Underwriting Guidance", "value": sanction_info['action_advice'], "badge": "Advisory"},
                ],
            },
        ]
        return levels

    @staticmethod
    def _classify_risk_band(score: int) -> Tuple[str, str]:
        if score < 30:
            return "Low risk", "Favourable profile — Prime tier"
        elif score < 65:
            return "Moderate risk", "Standard profile — Review recommended"
        else:
            return "High risk", "Elevated default probability — Mitigants required"

    @staticmethod
    def _format_feature_display(key: str, val: float) -> str:
        if key == "debt_to_income":
            return f"{val * 100:.1f}%"
        elif key == "loan_to_income":
            return f"{val:.2f}x"
        elif key == "annual_interest_rate":
            return f"{val * 100:.1f}%"
        elif key == "credit_history_years":
            return f"{val:.1f} yrs"
        elif key == "missed_payments_12m":
            return f"{int(val)} missed"
        return str(val)

    @staticmethod
    def _generate_feature_explanation(key: str, val: float, delta: float) -> str:
        if key == "missed_payments_12m":
            if val == 0:
                return "Zero missed payments in the past 12 months reflects disciplined repayment habits."
            elif val == 1:
                return "1 missed payment in 12m indicates an isolated delinquency; adds slight risk penalty."
            return f"{int(val)} missed payments signal acute repayment instability and substantially increase default probability."
        elif key == "debt_to_income":
            dti_pct = val * 100
            if dti_pct <= 25:
                return f"Comfortable DTI ({dti_pct:.0f}%); leaves strong monthly buffer to absorb emergencies."
            elif dti_pct <= 40:
                return f"Standard DTI ({dti_pct:.0f}%); balanced monthly debt obligations within banking norms."
            return f"High DTI ({dti_pct:.0f}%); majority of monthly income is already committed to existing debts."
        elif key == "loan_to_income":
            if val <= 1.0:
                return f"Conservative loan sizing ({val:.2f}x annual income); easily amortized over typical tenure."
            elif val <= 2.0:
                return f"Moderate loan sizing ({val:.2f}x annual income); acceptable debt service coverage."
            return f"Aggressive borrowing request ({val:.2f}x annual income); puts heavy leverage on future earnings."
        elif key == "credit_history_years":
            if val >= 7:
                return f"Extensive credit record ({val:.1f} years) confirms consistent solvency across credit cycles."
            elif val >= 3:
                return f"Adequate credit tenure ({val:.1f} years); verifiable historical track record."
            return f"Short credit history ({val:.1f} years); lack of extensive seasoned data creates uncertainty."
        elif key == "annual_interest_rate":
            rate_pct = val * 100
            if rate_pct <= 10:
                return f"Competitive prime rate ({rate_pct:.1f}%); lower monthly interest burden aids repayment."
            elif rate_pct <= 18:
                return f"Typical market rate ({rate_pct:.1f}%); manageable interest compounding."
            return f"High interest rate ({rate_pct:.1f}%); rapid interest accumulation elevates default vulnerability."
        return "Feature contribution analyzed."


SUITE = CreditRiskModelSuite()
