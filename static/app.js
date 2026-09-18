const form = document.querySelector('#score-form');
const error = document.querySelector('#error');
const result = document.querySelector('#result');
const sample = { monthly_income: 60000, monthly_debt_payments: 12000, loan_amount: 200000, annual_interest_rate: 10, credit_history_years: 6, missed_payments_12m: 0 };
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

document.querySelector('#sample').addEventListener('click', () => {
  Object.entries(sample).forEach(([name, value]) => form.elements[name].value = value);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.firstChild.textContent = 'Calculating… ';
  try {
    const payload = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/score', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not calculate a score.');
    document.querySelector('#score').textContent = data.risk_score;
    document.querySelector('#dial').style.setProperty('--score', data.risk_score);
    document.querySelector('#dial').dataset.level = data.band.split(' ')[0].toLowerCase();
    document.querySelector('#band').textContent = data.band;
    document.querySelector('#decision').textContent = data.decision;
    document.querySelector('#sanction-range').textContent = `${inr.format(data.sanction_low)} – ${inr.format(data.sanction_high)}`;
    result.classList.remove('hidden');
  } catch (err) { error.textContent = err.message; }
  finally { button.disabled = false; button.firstChild.textContent = 'Calculate risk score '; }
});
