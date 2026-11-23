# RiskLens — Multi-Model Credit Risk & Explainable AI (XAI) Suite

An institutional-grade, lightweight credit risk assessment and underwriting dashboard powered by **Flask** and **scikit-learn**.

RiskLens evaluates loan applicants across multiple modern Machine Learning architectures in parallel, computes ensemble consensus, breaks down risk drivers via **Explainable AI (XAI)** waterfall attribution and global Gini feature importances, and levels every step of the decision pipeline for complete auditability.

---

## Key Capabilities

1. **Multi-Model Algorithmic Suite**:
   - **Logistic Regression**: Linear statistical baseline computing log-odds with scaled feature weights.
   - **Random Forest (100 Trees)**: Bagging ensemble capturing non-linear interactions through randomized feature splits.
   - **Gradient Boosting (100 Estimators)**: Sequential boosting minimizing deviance loss residuals for optimal tabular accuracy.
   - **Multi-Layer Perceptron (Neural Network)**: Deep feed-forward network capturing complex non-linear manifolds.
   - **Ensemble Consensus**: Calibrated weighted ensemble blending all 4 paradigms.

2. **Holdout Benchmark Performance**:
   - Holdout test evaluation (3,200 sample population) with live tracking of **Accuracy (95%+), ROC-AUC (98%+), Precision, Recall, and F1-Score**.

3. **Explainable AI (XAI)**:
   - **Local Waterfall Attribution**: Dynamic SVG waterfall chart showing incremental contributions (+ / -) starting from population baseline risk to final predicted risk.
   - **Global Feature Importance**: Direct algorithm-by-algorithm comparison of feature weights (Random Forest MDI, Gradient Boosting impurity, Logistic Regression coefficients).
   - **Risk Drivers & Mitigants**: Automated diagnostic identification of primary risk driver and strongest solvency mitigant with plain-language underwriting explanations.

4. **Leveled 4-Tier Decision Pipeline**:
   - **Level 1**: Financial Ingestion & Normalized Ratio Computation (DTI, LTI, Rate, History, Delinquencies).
   - **Level 2**: Parallel Multi-Model Inference & Consensus Convergence.
   - **Level 3**: Explainable AI Attribution & Risk Factor Decomposition.
   - **Level 4**: Underwriting Decision, Indicative Sanction Limits (INR), & Cashflow Buffer.

---

## Run Locally

```powershell
# 1. Activate virtual environment or create one
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start application
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

---

## API Endpoints

- `GET /`: Clean, minimalist web dashboard.
- `GET /api/models`: Model architectures, holdout benchmark scores, and global feature importance metrics.
- `POST /api/score`: Takes applicant financial profile JSON (`monthly_income`, `monthly_debt_payments`, `loan_amount`, `annual_interest_rate`, `credit_history_years`, `missed_payments_12m`) and returns consensus score, individual model outputs, XAI waterfall steps, and leveled decision pipeline.
- `GET /api/health`: Healthcheck endpoint for cloud infrastructure.

---

## Deployment

Configured for **Render** via `Procfile`:
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`
