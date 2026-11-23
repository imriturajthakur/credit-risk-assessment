/**
 * RiskLens — Multi-Model Credit Risk & Explainable AI (XAI) Dashboard
 */
(function() {
  'use strict';

  // Preset financial profiles for instant testing
  const PRESETS = {
    prime: {
      monthly_income: 75000,
      monthly_debt_payments: 12000,
      loan_amount: 250000,
      annual_interest_rate: 9.5,
      credit_history_years: 7.0,
      missed_payments_12m: 0
    },
    moderate: {
      monthly_income: 48000,
      monthly_debt_payments: 18000,
      loan_amount: 320000,
      annual_interest_rate: 14.5,
      credit_history_years: 4.5,
      missed_payments_12m: 1
    },
    strained: {
      monthly_income: 38000,
      monthly_debt_payments: 24000,
      loan_amount: 450000,
      annual_interest_rate: 22.0,
      credit_history_years: 2.0,
      missed_payments_12m: 3
    },
    newbie: {
      monthly_income: 55000,
      monthly_debt_payments: 5000,
      loan_amount: 120000,
      annual_interest_rate: 11.0,
      credit_history_years: 0.8,
      missed_payments_12m: 0
    }
  };

  const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });

  // State store
  let currentScoreData = null;
  let globalModelsData = null;
  let activeGlobalAlgo = 'consensus';

  // DOM Elements
  const form = document.querySelector('#risk-form');
  const submitBtn = document.querySelector('#submit-btn');
  const formError = document.querySelector('#form-error');
  const placeholder = document.querySelector('#results-placeholder');
  const resultsContent = document.querySelector('#results-content');

  // Gauge & Executive Summary
  const riskGauge = document.querySelector('#risk-gauge');
  const gaugeCircle = document.querySelector('#gauge-circle');
  const displayScore = document.querySelector('#display-score');
  const riskBandBadge = document.querySelector('#risk-band-badge');
  const modelAgreementBadge = document.querySelector('#model-agreement-badge');
  const verdictTitle = document.querySelector('#verdict-title');
  const advisoryText = document.querySelector('#advisory-text');
  const sanctionRangeText = document.querySelector('#sanction-range-text');
  const disposableIncomeText = document.querySelector('#disposable-income-text');

  // Leveled Pipeline
  const levelsContainer = document.querySelector('#levels-container');

  // Explainable AI (XAI)
  const waterfallChartContainer = document.querySelector('#waterfall-chart-container');
  const waterfallSummaryBox = document.querySelector('#waterfall-summary-box');
  const globalImportanceContainer = document.querySelector('#global-importance-container');
  const factorCardsGrid = document.querySelector('#factor-cards-grid');

  // Multi-Model Grid & Benchmark Table
  const modelsPredictionGrid = document.querySelector('#models-prediction-grid');
  const benchmarkTableBody = document.querySelector('#benchmark-table-body');

  /**
   * Initialize application
   */
  async function init() {
    setupTabNavigation();
    setupPresetButtons();
    setupAlgoSwitcher();
    setupFormSubmission();

    // Fetch baseline models and benchmarks
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        globalModelsData = await res.json();
        renderBenchmarkTable(globalModelsData.models);
        if (globalModelsData.models.gradient_boosting) {
          document.querySelector('#top-auc').textContent = `${globalModelsData.models.gradient_boosting.metrics.roc_auc}%`;
        }
        if (globalModelsData.baseline_risk) {
          document.querySelector('#top-baseline').textContent = `${globalModelsData.baseline_risk}%`;
        }
      }
    } catch (err) {
      console.warn('Could not fetch static models info:', err);
    }

    // Auto-run initial prime assessment on load for instant interactive experience
    await executeAssessment();
  }

  /**
   * Tab Navigation Setup
   */
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        const targetPaneId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
        });
        const targetPane = document.querySelector(`#${targetPaneId}`);
        if (targetPane) {
          targetPane.classList.add('active');
        }
      });
    });
  }

  /**
   * Preset Buttons Setup
   */
  function setupPresetButtons() {
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const presetKey = btn.getAttribute('data-preset');
        const data = PRESETS[presetKey];
        if (data) {
          Object.entries(data).forEach(([key, val]) => {
            const input = form.elements[key];
            if (input) input.value = val;
          });
          await executeAssessment();
        }
      });
    });
  }

  /**
   * Global XAI Algorithm Switcher Setup
   */
  function setupAlgoSwitcher() {
    const algoBtns = document.querySelectorAll('.algo-btn');
    algoBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        algoBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeGlobalAlgo = btn.getAttribute('data-algo');
        if (currentScoreData && currentScoreData.xai) {
          renderGlobalFeatureImportance(currentScoreData.xai.global_importance, activeGlobalAlgo);
        }
      });
    });
  }

  /**
   * Form Submission Setup
   */
  function setupFormSubmission() {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await executeAssessment();
    });
  }

  /**
   * Execute Assessment Request
   */
  async function executeAssessment() {
    formError.textContent = '';
    submitBtn.disabled = true;
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    btnText.textContent = 'Evaluating 4 ML Models…';

    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to compute credit risk assessment.');
      }

      currentScoreData = data;
      renderAllResults(data);

      placeholder.classList.add('hidden');
      resultsContent.classList.remove('hidden');

    } catch (err) {
      formError.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = originalText;
    }
  }

  /**
   * Master Render Coordinator
   */
  function renderAllResults(data) {
    const { consensus, models, xai, pipeline } = data;

    // 1. Executive Summary & Radial Gauge
    renderExecutiveSummary(consensus);

    // 2. Leveled Decision Pipeline
    renderLeveledPipeline(pipeline);

    // 3. Explainable AI: Waterfall Chart, Summary Chips, Diagnostics
    renderWaterfallChart(xai.waterfall);
    renderWaterfallSummary(xai.top_risk_driver, xai.top_mitigant);
    renderFactorDiagnostics(xai.attributions);
    renderGlobalFeatureImportance(xai.global_importance, activeGlobalAlgo);

    // 4. Multi-Model Grid & Benchmark Table
    renderModelsGrid(models);
    renderBenchmarkTable(models);
  }

  /**
   * Render Executive Summary and Circular Gauge
   */
  function renderExecutiveSummary(consensus) {
    const score = consensus.risk_score;
    displayScore.textContent = score;

    // Determine level classification
    let level = 'low';
    if (score >= 65) level = 'high';
    else if (score >= 30) level = 'moderate';

    riskGauge.setAttribute('data-level', level);

    // Update SVG stroke-dashoffset (Circle radius = 50, circumference = 2 * PI * 50 = ~314.159)
    const circumference = 314.159;
    const offset = circumference - (circumference * (score / 100));
    gaugeCircle.style.strokeDashoffset = Math.max(0, offset);

    // Badges & texts
    riskBandBadge.textContent = consensus.band;
    riskBandBadge.className = `status-badge ${level}`;

    modelAgreementBadge.textContent = consensus.agreement || '4/4 Models Converged';
    verdictTitle.textContent = consensus.decision;
    advisoryText.textContent = consensus.action_advice;

    sanctionRangeText.textContent = `${inrFormatter.format(consensus.sanction_low)} – ${inrFormatter.format(consensus.sanction_high)}`;
    disposableIncomeText.textContent = `${inrFormatter.format(consensus.disposable_income)} / month`;
  }

  /**
   * Render Leveled Decision Pipeline
   */
  function renderLeveledPipeline(pipeline) {
    levelsContainer.innerHTML = '';

    pipeline.forEach(item => {
      const card = document.createElement('div');
      card.className = 'level-card';

      const detailsHtml = item.details.map(d => {
        let badgeClass = 'level-badge';
        if (d.badge) {
          const bLow = d.badge.toLowerCase();
          if (bLow.includes('safe') || bLow.includes('favour') || bLow.includes('clean') || bLow.includes('prime') || bLow.includes('establ')) {
            badgeClass += ' safe';
          } else if (bLow.includes('strain') || bLow.includes('elevat') || bLow.includes('standard') || bLow.includes('develop') || bLow.includes('moder')) {
            badgeClass += ' moderate';
          } else if (bLow.includes('high') || bLow.includes('delinq')) {
            badgeClass += ' high';
          }
        }
        return `
          <div class="level-detail-pill">
            <span class="level-detail-label">${d.label}:</span>
            <span class="level-detail-val">${d.value}</span>
            <span class="${badgeClass}">${d.badge}</span>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div class="level-card-top">
          <div class="level-tag-wrap">
            <span class="level-num">${item.level}</span>
            <span class="level-title">${item.level_name}</span>
          </div>
          <span class="level-status">${item.status}</span>
        </div>
        <p class="level-summary">${item.summary}</p>
        <div class="level-details-grid">
          ${detailsHtml}
        </div>
      `;
      levelsContainer.appendChild(card);
    });
  }

  /**
   * Render Local Explainability Waterfall Chart (SVG)
   */
  function renderWaterfallChart(waterfallSteps) {
    waterfallChartContainer.innerHTML = '';
    if (!waterfallSteps || waterfallSteps.length === 0) return;

    const width = 760;
    const height = 280;
    const margin = { top: 35, right: 25, bottom: 65, left: 55 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const n = waterfallSteps.length;
    const colWidth = chartW / n;
    const barWidth = Math.min(colWidth * 0.65, 48);

    // Max scale up to 100%
    const yScale = (val) => chartH - (Math.max(0, Math.min(100, val)) / 100) * chartH;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'waterfall-svg');

    // Grid lines for 0%, 25%, 50%, 75%, 100%
    [0, 25, 50, 75, 100].forEach(tick => {
      const y = margin.top + yScale(tick);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', margin.left);
      line.setAttribute('x2', width - margin.right);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#e2e8f0');
      line.setAttribute('stroke-dasharray', '3 3');
      svg.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', margin.left - 8);
      label.setAttribute('y', y + 3);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', '#94a3b8');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-family', 'JetBrains Mono');
      label.textContent = `${tick}%`;
      svg.appendChild(label);
    });

    let prevY = null;
    let prevX = null;

    waterfallSteps.forEach((step, idx) => {
      const centerX = margin.left + idx * colWidth + colWidth / 2;
      const x = centerX - barWidth / 2;

      let barTop, barBottom, color;

      if (step.type === 'baseline' || step.type === 'final') {
        barTop = margin.top + yScale(step.value);
        barBottom = margin.top + yScale(0);
        color = '#4f46e5'; // Indigo for baseline & final total
      } else {
        const prevStepVal = waterfallSteps[idx - 1] ? waterfallSteps[idx - 1].value : step.value;
        const currentVal = step.value;
        barTop = margin.top + yScale(Math.max(prevStepVal, currentVal));
        barBottom = margin.top + yScale(Math.min(prevStepVal, currentVal));
        color = step.delta >= 0 ? '#dc2626' : '#059669'; // Red for risk increase, green for mitigation
      }

      const barH = Math.max(barBottom - barTop, 3);

      // Connecting guide line from previous step
      if (prevX !== null) {
        const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        guide.setAttribute('x1', prevX);
        guide.setAttribute('x2', x);
        guide.setAttribute('y1', prevY);
        guide.setAttribute('y2', prevY);
        guide.setAttribute('stroke', '#94a3b8');
        guide.setAttribute('stroke-dasharray', '2 2');
        svg.appendChild(guide);
      }

      // Bar rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', barTop);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', barH);
      rect.setAttribute('fill', color);
      rect.setAttribute('rx', '4');

      // Hover title tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${step.step}: ${step.value}% (${step.delta >= 0 ? '+' : ''}${step.delta}%)\n${step.text}`;
      rect.appendChild(title);
      svg.appendChild(rect);

      // Value label on top of bar
      const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valText.setAttribute('x', centerX);
      valText.setAttribute('y', barTop - 6);
      valText.setAttribute('text-anchor', 'middle');
      valText.setAttribute('font-size', '11');
      valText.setAttribute('font-weight', '600');
      valText.setAttribute('font-family', 'JetBrains Mono');
      valText.setAttribute('fill', color);
      valText.textContent = `${step.value}%`;
      svg.appendChild(valText);

      // Delta pill for intermediate steps
      if (step.type !== 'baseline' && step.type !== 'final') {
        const deltaText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        deltaText.setAttribute('x', centerX);
        deltaText.setAttribute('y', barBottom + 14);
        deltaText.setAttribute('text-anchor', 'middle');
        deltaText.setAttribute('font-size', '10');
        deltaText.setAttribute('font-weight', '600');
        deltaText.setAttribute('font-family', 'JetBrains Mono');
        deltaText.setAttribute('fill', color);
        deltaText.textContent = `${step.delta >= 0 ? '+' : ''}${step.delta}%`;
        svg.appendChild(deltaText);
      }

      // Step X-axis label
      const stepLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stepLabel.setAttribute('x', centerX);
      stepLabel.setAttribute('y', height - 20);
      stepLabel.setAttribute('text-anchor', 'middle');
      stepLabel.setAttribute('font-size', '10');
      stepLabel.setAttribute('fill', '#475569');
      stepLabel.setAttribute('font-weight', '500');

      // Shorten label for clarity
      let shortName = step.step;
      if (shortName.includes('Debt-to-Income')) shortName = 'DTI';
      else if (shortName.includes('Loan-to-Annual-Income')) shortName = 'LTI';
      else if (shortName.includes('Annual Interest')) shortName = 'Interest';
      else if (shortName.includes('Credit History')) shortName = 'History';
      else if (shortName.includes('Missed Payments')) shortName = 'Missed';
      else if (shortName.includes('Baseline')) shortName = 'Baseline';
      else if (shortName.includes('Final')) shortName = 'Consensus';

      stepLabel.textContent = shortName;
      svg.appendChild(stepLabel);

      prevX = x + barWidth;
      prevY = margin.top + yScale(step.value);
    });

    waterfallChartContainer.appendChild(svg);
  }

  /**
   * Render Top Drivers in Waterfall Summary Box
   */
  function renderWaterfallSummary(topRisk, topMitigant) {
    waterfallSummaryBox.innerHTML = '';

    if (topRisk) {
      const riskDiv = document.createElement('div');
      riskDiv.className = 'driver-pill risk';
      riskDiv.innerHTML = `
        <span>Primary Default Risk Driver: <strong>${topRisk.feature_name}</strong></span>
        <strong>+${topRisk.delta}% Risk</strong>
      `;
      waterfallSummaryBox.appendChild(riskDiv);
    }

    if (topMitigant) {
      const mitDiv = document.createElement('div');
      mitDiv.className = 'driver-pill mitigant';
      mitDiv.innerHTML = `
        <span>Strongest Solvency Mitigant: <strong>${topMitigant.feature_name}</strong></span>
        <strong>${topMitigant.delta}% Risk</strong>
      `;
      waterfallSummaryBox.appendChild(mitDiv);
    }
  }

  /**
   * Render Global Feature Importance Bars
   */
  function renderGlobalFeatureImportance(globalImportanceDict, algoKey) {
    globalImportanceContainer.innerHTML = '';
    const weights = globalImportanceDict[algoKey] || globalImportanceDict.consensus;
    if (!weights) return;

    const featureLabels = {
      debt_to_income: 'Debt-to-Income Ratio (DTI)',
      loan_to_income: 'Loan-to-Income Ratio (LTI)',
      annual_interest_rate: 'Annual Contractual Interest Rate',
      credit_history_years: 'Credit History Tenure Length',
      missed_payments_12m: 'Missed Payments in 12 Months'
    };

    // Sort features by weight descending
    const sortedFeatures = Object.entries(weights).sort((a, b) => b[1] - a[1]);

    sortedFeatures.forEach(([featKey, pct]) => {
      const row = document.createElement('div');
      row.className = 'importance-row';

      row.innerHTML = `
        <div class="importance-meta">
          <span class="importance-name">${featureLabels[featKey] || featKey}</span>
          <span class="importance-pct">${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%"></div>
        </div>
      `;
      globalImportanceContainer.appendChild(row);
    });
  }

  /**
   * Render Factor Impact Diagnostics Cards
   */
  function renderFactorDiagnostics(attributions) {
    factorCardsGrid.innerHTML = '';
    if (!attributions) return;

    attributions.forEach(attr => {
      const card = document.createElement('div');
      card.className = 'factor-card';

      let badgeClass = 'factor-delta-badge neutral';
      let deltaPrefix = '';
      if (attr.delta > 0) {
        badgeClass = 'factor-delta-badge increase';
        deltaPrefix = '+';
      } else if (attr.delta < 0) {
        badgeClass = 'factor-delta-badge mitigate';
      }

      card.innerHTML = `
        <div class="factor-card-top">
          <div>
            <span class="factor-title">${attr.feature_name}</span>
            <div style="font-size: 11px; color: var(--muted); font-family: 'JetBrains Mono'; margin-top: 2px;">
              Value: ${attr.feature_value_display}
            </div>
          </div>
          <span class="${badgeClass}">${deltaPrefix}${attr.delta}%</span>
        </div>
        <p class="factor-explanation">${attr.explanation}</p>
        <div class="factor-meta-foot">
          Benchmark: ${attr.benchmark}
        </div>
      `;
      factorCardsGrid.appendChild(card);
    });
  }

  /**
   * Render Multi-Model Prediction Cards
   */
  function renderModelsGrid(models) {
    modelsPredictionGrid.innerHTML = '';
    if (!models) return;

    Object.values(models).forEach(m => {
      const card = document.createElement('div');
      card.className = 'model-card';

      let barColor = 'var(--emerald)';
      if (m.risk_score >= 65) barColor = 'var(--crimson)';
      else if (m.risk_score >= 30) barColor = 'var(--amber)';

      card.innerHTML = `
        <div class="model-card-top">
          <div>
            <h5 class="model-name">${m.name}</h5>
            <span class="model-family">${m.family}</span>
          </div>
          <span class="model-badge">${m.badge || 'ML Core'}</span>
        </div>
        
        <div class="model-score-display">
          <strong>${m.risk_score}</strong>
          <span class="model-score-sub">/ 100 Risk Score (${m.probability}% prob)</span>
        </div>

        <div class="model-bar-track">
          <div class="model-bar-fill" style="width: ${m.risk_score}%; background: ${barColor};"></div>
        </div>

        <div class="model-metrics-row">
          <div class="metric-item">
            <span class="metric-label">ACCURACY</span>
            <span class="metric-val">${m.metrics.accuracy}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">ROC-AUC</span>
            <span class="metric-val">${m.metrics.roc_auc}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">F1-SCORE</span>
            <span class="metric-val">${m.metrics.f1_score}%</span>
          </div>
        </div>
      `;
      modelsPredictionGrid.appendChild(card);
    });
  }

  /**
   * Render Comprehensive Benchmark Table
   */
  function renderBenchmarkTable(models) {
    benchmarkTableBody.innerHTML = '';
    if (!models) return;

    Object.values(models).forEach(m => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${m.name}</strong></td>
        <td>${m.family}</td>
        <td>${m.metrics.accuracy}%</td>
        <td>${m.metrics.roc_auc}%</td>
        <td>${m.metrics.precision}%</td>
        <td>${m.metrics.recall}%</td>
        <td><strong>${m.metrics.f1_score}%</strong></td>
        <td>${(m.weight * 100).toFixed(0)}%</td>
      `;
      benchmarkTableBody.appendChild(row);
    });
  }

  // Start initialization on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
