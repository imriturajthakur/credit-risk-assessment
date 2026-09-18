# RiskLens — Lightweight Credit Risk Score

A very small Flask and scikit-learn educational demo. It accepts six financial inputs and returns an estimated default-risk score from 0–100.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

## API

`POST /api/score` accepts JSON with: `monthly_income`, `monthly_debt_payments`, `loan_amount`, `annual_interest_rate`, `credit_history_years`, and `missed_payments_12m`.

The model is trained from 2,000 deterministic synthetic educational records at startup, so no bulky dataset or model artifact is deployed. The displayed percentage blends the ML probability with normalized debt-to-income and loan-to-income ratios, interest rate, credit-history length, and missed payments. Do not use it to make real credit, lending, employment, insurance, or housing decisions.

## Deploy

Render detects the `Procfile`; set the build command to `pip install -r requirements.txt` and start command to `gunicorn app:app`. Vercel is better for static/serverless applications; a Flask + scikit-learn app is most straightforward on Render.

## Source reference

The downloaded upstream starter is preserved in `upstream-credit-risk/`: [abeed04/Bank-Credit-Risk-Model-using-Machine-Learning](https://github.com/abeed04/Bank-Credit-Risk-Model-using-Machine-Learning), BSD-2-Clause licensed. This project replaces its 90-field, 10 MB-dataset interface with a six-field lightweight educational scorer.
