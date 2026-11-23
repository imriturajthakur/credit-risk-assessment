/**
 * RiskLens — Minimalist Credit Risk & Decision Tree Scattering XAI
 */
(function() {
  'use strict';

  // Preset financial profiles for rapid one-click testing
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
  const tooltip = document.querySelector('#universal-tooltip');
  const tipTitle = document.querySelector('#u-tooltip-title');
  const tipBody = document.querySelector('#u-tooltip-body');
  const tipMeta = document.querySelector('#u-tooltip-meta');

  // Top Pastel Boxes (Image 3 Style)
  const topScore = document.querySelector('#top-score');
  const topSanction = document.querySelector('#top-sanction');
  const topAgreement = document.querySelector('#top-agreement');
  const topVerdict = document.querySelector('#top-verdict');

  // Input Form & Quick Ratios
  const form = document.querySelector('#credit-form');
  const submitBtn = document.querySelector('#submit-btn');
  const submitText = document.querySelector('#submit-text');
  const formError = document.querySelector('#form-error');
  const valDti = document.querySelector('#val-dti');
  const valLti = document.querySelector('#val-lti');
  const valTrack = document.querySelector('#val-track');

  // View Panels & Switchers
  const viewPills = document.querySelectorAll('.view-pill');
  const viewPanels = document.querySelectorAll('.view-panel');

  // Tree View
  const treeContainer = document.querySelector('#tree-viewport-container');
  const pathStepsList = document.querySelector('#path-steps-list');

  // Hub View (Image 2 Style)
  const hubDtiLabel = document.querySelector('#hub-dti-label');
  const hubLtiLabel = document.querySelector('#hub-lti-label');
  const hubTenureLabel = document.querySelector('#hub-tenure-label');
  const hubMissedLabel = document.querySelector('#hub-missed-label');
  const terminalJson = document.querySelector('#terminal-json-output');

  // XAI View
  const waterfallWrap = document.querySelector('#waterfall-wrap');
  const xaiDriversBox = document.querySelector('#xai-drivers-box');
  const globalBarsGrid = document.querySelector('#global-bars-grid');
  const algoToggles = document.querySelectorAll('#algo-toggle-strip .toggle-pill');

  // Models View
  const modelsCardsRow = document.querySelector('#models-cards-row');
  const benchmarkTbody = document.querySelector('#benchmark-tbody');

  /**
   * Application Initialization
   */
  async function init() {
    setupUniversalTooltips();
    setupViewSwitching();
    setupPresetButtons();
    setupAlgoToggles();
    setupFormSubmission();

    // Fetch static models & baseline
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        globalModelsData = await res.json();
        renderBenchmarkTable(globalModelsData.models);
      }
    } catch (e) {
      console.warn('Could not load static models metadata:', e);
    }

    // Auto-evaluate prime preset on load
    await executeAssessment();
  }

  /**
   * Universal Floating Tooltip Engine
   */
  function setupUniversalTooltips() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-tip-title], [data-tip-body]');
      if (!target) {
        tooltip.classList.add('hidden');
        return;
      }

      const title = target.getAttribute('data-tip-title') || '';
      const body = target.getAttribute('data-tip-body') || '';
      const meta = target.getAttribute('data-tip-meta') || '';

      tipTitle.textContent = title;
      tipBody.textContent = body;
      if (meta) {
        tipMeta.textContent = meta;
        tipMeta.style.display = 'block';
      } else {
        tipMeta.style.display = 'none';
      }

      tooltip.classList.remove('hidden');
      positionTooltip(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (!tooltip.classList.contains('hidden')) {
        positionTooltip(e);
      }
    });

    document.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });

    function positionTooltip(e) {
      const gap = 14;
      let left = e.clientX + gap;
      let top = e.clientY + gap;

      const rect = tooltip.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      if (left + rect.width > winW - 15) {
        left = e.clientX - rect.width - gap;
      }
      if (top + rect.height > winH - 15) {
        top = e.clientY - rect.height - gap;
      }

      tooltip.style.left = `${Math.max(10, left)}px`;
      tooltip.style.top = `${Math.max(10, top)}px`;
    }
  }

  /**
   * View Switcher Setup
   */
  function setupViewSwitching() {
    viewPills.forEach(pill => {
      pill.addEventListener('click', () => {
        viewPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const targetView = pill.getAttribute('data-view');
        viewPanels.forEach(panel => panel.classList.remove('active'));
        const activePanel = document.querySelector(`#${targetView}`);
        if (activePanel) activePanel.classList.add('active');
      });
    });
  }

  /**
   * Preset Buttons Setup
   */
  function setupPresetButtons() {
    const presetPills = document.querySelectorAll('.preset-pill');
    presetPills.forEach(btn => {
      btn.addEventListener('click', async () => {
        presetPills.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const key = btn.getAttribute('data-preset');
        const data = PRESETS[key];
        if (data) {
          Object.entries(data).forEach(([name, val]) => {
            const input = form.elements[name];
            if (input) input.value = val;
          });
          await executeAssessment();
        }
      });
    });
  }

  /**
   * Global XAI Algorithm Toggle
   */
  function setupAlgoToggles() {
    algoToggles.forEach(btn => {
      btn.addEventListener('click', () => {
        algoToggles.forEach(b => b.classList.remove('active'));
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
    submitText.textContent = 'Evaluating Decision Nodes…';

    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      // Update quick ratio chips immediately
      const inc = parseFloat(payload.monthly_income) || 1;
      const debt = parseFloat(payload.monthly_debt_payments) || 0;
      const loan = parseFloat(payload.loan_amount) || 0;
      const missed = parseInt(payload.missed_payments_12m, 10) || 0;

      const dtiCalc = (debt / inc) * 100;
      const ltiCalc = loan / (inc * 12);

      valDti.textContent = `${dtiCalc.toFixed(1)}%`;
      valLti.textContent = `${ltiCalc.toFixed(2)}x`;
      valTrack.textContent = missed === 0 ? 'Clean (0)' : `${missed} Delinquent`;

      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to compute assessment.');
      }

      currentScoreData = data;
      renderAll(data);

    } catch (err) {
      formError.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      submitText.textContent = 'Run Assessment';
    }
  }

  /**
   * Master Render Coordinator
   */
  function renderAll(data) {
    const { consensus, models, tree_path, xai, inputs } = data;

    // 1. Top Pastel Metric Cards (Image 3 Style)
    renderTopPastelCards(consensus);

    // 2. Decision Tree Scattering Graph (Node-to-Node Scatter)
    renderDecisionTreeGraph(tree_path, consensus);

    // 3. Architecture Hub View (Image 2 Reference Style)
    renderArchitectureHub(inputs, consensus, models);

    // 4. Explainable AI (Waterfall + Global Gini Weights)
    renderWaterfall(xai.waterfall);
    renderDriverChips(xai.top_risk_driver, xai.top_mitigant);
    renderGlobalFeatureImportance(xai.global_importance, activeGlobalAlgo);

    // 5. Multi-Model Benchmark Cards & Table
    renderModelCards(models);
    renderBenchmarkTable(models);
  }

  /**
   * Render Top 4 Pastel Metric Boxes (Reference Image 3 Style)
   */
  function renderTopPastelCards(consensus) {
    topScore.textContent = `${consensus.risk_score}%`;
    topSanction.textContent = `${inrFormatter.format(consensus.sanction_high).replace('₹', '₹ ')}`;
    topAgreement.textContent = consensus.agreement ? consensus.agreement.split(' ')[0] : '4 / 4';
    topVerdict.textContent = consensus.band;
  }

  /**
   * Render Interactive Decision Tree Scattering Graph (Node Scatter)
   * Visually scatters from root node into criteria nodes and leaves!
   */
  function renderDecisionTreeGraph(treePath, consensus) {
    treeContainer.innerHTML = '';
    pathStepsList.innerHTML = '';
    if (!treePath) return;

    const activeNodes = new Set(treePath.path_nodes || []);
    const activeEdges = new Set(treePath.path_edges || []);
    const evals = treePath.evaluations || {};

    const svgWidth = 920;
    const svgHeight = 440;

    // Node layout positions (x, y)
    const NODES = {
      root: { x: 460, y: 35, title: 'Root: Financial Ingestion', cond: 'Applicant Parameters Ingested', badge: 'INPUT' },
      
      // Level 1 Split: Missed payments
      node_clean: { x: 230, y: 135, title: 'Clean Repayment Track', cond: 'Missed Payments == 0', badge: 'PASS' },
      node_delinquent: { x: 690, y: 135, title: 'Delinquency Track', cond: 'Missed Payments > 0', badge: 'RISK' },

      // Level 2 Split: Clean path -> DTI; Delinquent path -> Delinquency severity
      node_low_dti: { x: 120, y: 245, title: 'Low Debt-to-Income', cond: 'DTI ≤ 36.0%', badge: 'SAFE' },
      node_high_dti: { x: 340, y: 245, title: 'Elevated DTI', cond: 'DTI > 36.0%', badge: 'STRAINED' },
      node_mild_delinq: { x: 580, y: 245, title: 'Mild Delinquency', cond: 'Missed Payments ≤ 2', badge: 'RECOVER' },

      // Level 3 Terminal Leaves
      leaf_prime: { x: 60, y: 360, title: 'Prime Approval', cond: 'LTI ≤ 1.50x — Top Tier', badge: 'PRIME', leaf: true },
      leaf_standard: { x: 230, y: 360, title: 'Standard Solvency', cond: 'Standard Lending Tier', badge: 'STANDARD', leaf: true },
      leaf_strained: { x: 440, y: 360, title: 'Conditional Review', cond: 'High Debt / Delinquency', badge: 'REVIEW', leaf: true },
      leaf_subprime: { x: 740, y: 360, title: 'High Default Risk', cond: 'Critical Default Signal', badge: 'SUBPRIME', leaf: true },
    };

    // Edge definitions connecting nodes
    const EDGES = [
      { id: 'e_root_clean', from: 'root', to: 'node_clean', label: 'Clean (0)' },
      { id: 'e_root_delinq', from: 'root', to: 'node_delinquent', label: 'Missed (>0)' },
      
      { id: 'e_clean_low_dti', from: 'node_clean', to: 'node_low_dti', label: 'DTI ≤ 36%' },
      { id: 'e_clean_high_dti', from: 'node_clean', to: 'node_high_dti', label: 'DTI > 36%' },

      { id: 'e_delinq_mild', from: 'node_delinquent', to: 'node_mild_delinq', label: 'Missed ≤ 2' },
      { id: 'e_delinq_severe', from: 'node_delinquent', to: 'leaf_subprime', label: 'Missed > 2' },

      { id: 'e_low_dti_prime', from: 'node_low_dti', to: 'leaf_prime', label: 'LTI ≤ 1.5x' },
      { id: 'e_low_dti_std', from: 'node_low_dti', to: 'leaf_standard', label: 'LTI > 1.5x' },

      { id: 'e_high_dti_std', from: 'node_high_dti', to: 'leaf_standard', label: 'History ≥ 5y' },
      { id: 'e_high_dti_strain', from: 'node_high_dti', to: 'leaf_strained', label: 'History < 5y' },

      { id: 'e_mild_strain', from: 'node_mild_delinq', to: 'leaf_strained', label: 'DTI ≤ 42%' },
      { id: 'e_mild_subprime', from: 'node_mild_delinq', to: 'leaf_subprime', label: 'DTI > 42%' },
    ];

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute('class', 'tree-svg');

    // 1. Draw Edges first so nodes render on top
    EDGES.forEach(edge => {
      const fromNode = NODES[edge.from];
      const toNode = NODES[edge.to];
      if (!fromNode || !toNode) return;

      const x1 = fromNode.x;
      const y1 = fromNode.y + 24; // bottom of parent
      const x2 = toNode.x;
      const y2 = toNode.y - 24; // top of child

      // Clean orthogonal/curved bezier branch
      const midY = (y1 + y2) / 2;
      const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      const isActive = activeEdges.has(edge.id);
      path.setAttribute('class', `tree-edge ${isActive ? 'active' : ''}`);

      // Hover metadata for edge
      path.setAttribute('data-tip-title', `Branch Condition: ${edge.label}`);
      path.setAttribute('data-tip-body', `Connects ${fromNode.title} to ${toNode.title}.`);
      path.setAttribute('data-tip-meta', isActive ? 'ACTIVE PATH TAKEN' : 'INACTIVE ALTERNATE PATH');

      svg.appendChild(path);

      // Edge condition pill label
      const midX = (x1 + x2) / 2;
      const lblText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lblText.setAttribute('x', midX);
      lblText.setAttribute('y', midY - 4);
      lblText.setAttribute('text-anchor', 'middle');
      lblText.setAttribute('font-size', '8.5');
      lblText.setAttribute('font-family', 'JetBrains Mono');
      lblText.setAttribute('fill', isActive ? '#059669' : '#94a3b8');
      lblText.setAttribute('font-weight', isActive ? '700' : '500');
      lblText.textContent = edge.label;
      svg.appendChild(lblText);
    });

    // 2. Draw Nodes
    const nodeW = 146;
    const nodeH = 46;

    Object.entries(NODES).forEach(([nodeId, node]) => {
      const isActive = activeNodes.has(nodeId);
      const evalData = evals[nodeId] || {};

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `tree-node-group ${isActive ? 'active' : ''}`);

      // Hover tooltip for node
      g.setAttribute('data-tip-title', evalData.title || node.title);
      g.setAttribute('data-tip-body', evalData.detail || node.cond);
      g.setAttribute('data-tip-meta', isActive ? 'STATUS: EVALUATED & TAKEN' : 'STATUS: NOT TAKEN');

      // Node box rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', node.x - nodeW / 2);
      rect.setAttribute('y', node.y - nodeH / 2);
      rect.setAttribute('width', nodeW);
      rect.setAttribute('height', nodeH);
      rect.setAttribute('class', 'node-box');
      g.appendChild(rect);

      // Badge rect (top-right pill)
      const badgeW = 42;
      const badgeH = 14;
      const badgeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      badgeRect.setAttribute('x', node.x + nodeW / 2 - badgeW - 6);
      badgeRect.setAttribute('y', node.y - nodeH / 2 + 5);
      badgeRect.setAttribute('width', badgeW);
      badgeRect.setAttribute('height', badgeH);
      badgeRect.setAttribute('class', 'node-badge-rect');
      g.appendChild(badgeRect);

      // Badge text
      const badgeTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeTxt.setAttribute('x', node.x + nodeW / 2 - badgeW / 2 - 6);
      badgeTxt.setAttribute('y', node.y - nodeH / 2 + 15);
      badgeTxt.setAttribute('text-anchor', 'middle');
      badgeTxt.setAttribute('class', 'node-badge-text');
      badgeTxt.textContent = evalData.status || node.badge;
      g.appendChild(badgeTxt);

      // Title text
      const titleTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleTxt.setAttribute('x', node.x - nodeW / 2 + 8);
      titleTxt.setAttribute('y', node.y - nodeH / 2 + 16);
      titleTxt.setAttribute('class', 'node-title-text');
      titleTxt.textContent = node.title.length > 17 ? node.title.substring(0, 16) + '…' : node.title;
      g.appendChild(titleTxt);

      // Condition text
      const condTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      condTxt.setAttribute('x', node.x - nodeW / 2 + 8);
      condTxt.setAttribute('y', node.y + nodeH / 2 - 10);
      condTxt.setAttribute('class', 'node-condition-text');
      condTxt.textContent = node.cond.length > 21 ? node.cond.substring(0, 20) + '…' : node.cond;
      g.appendChild(condTxt);

      svg.appendChild(g);
    });

    treeContainer.appendChild(svg);

    // 3. Render Breadcrumbs in path summary bar
    treePath.path_nodes.forEach((nodeId, idx) => {
      const node = NODES[nodeId];
      if (!node) return;
      const chip = document.createElement('span');
      chip.className = 'step-chip active';
      chip.textContent = node.title;
      chip.setAttribute('data-tip-title', node.title);
      chip.setAttribute('data-tip-body', evals[nodeId] ? evals[nodeId].detail : node.cond);
      chip.setAttribute('data-tip-meta', `Step ${idx + 1} of Tree Path`);

      pathStepsList.appendChild(chip);

      if (idx < treePath.path_nodes.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'step-arrow';
        arrow.textContent = '→';
        pathStepsList.appendChild(arrow);
      }
    });
  }

  /**
   * Render Architecture Hub View (Image 2 Blueprint Style)
   */
  function renderArchitectureHub(inputs, consensus, models) {
    if (!inputs) return;

    const dtiPct = ((inputs.monthly_debt_payments / inputs.monthly_income) * 100).toFixed(1);
    const ltiVal = (inputs.loan_amount / (inputs.monthly_income * 12)).toFixed(2);

    hubDtiLabel.textContent = `DTI: ${dtiPct}%`;
    hubLtiLabel.textContent = `LTI: ${ltiVal}x`;
    hubTenureLabel.textContent = `${inputs.credit_history_years} Years`;
    hubMissedLabel.textContent = `${inputs.missed_payments_12m} Missed`;

    const terminalObj = {
      applicant_status: consensus.band.toUpperCase().replace(' ', '_'),
      calculated_risk_score: consensus.risk_score,
      default_probability: `${consensus.probability}%`,
      decision_verdict: consensus.decision,
      indicative_sanction: {
        minimum_inr: consensus.sanction_low,
        maximum_inr: consensus.sanction_high
      },
      disposable_cashflow_monthly: consensus.disposable_income,
      models_consensus: consensus.agreement || '4/4',
      algorithms_evaluated: Object.keys(models || {})
    };

    terminalJson.textContent = JSON.stringify(terminalObj, null, 2);
  }

  /**
   * Render XAI Local Waterfall Chart
   */
  function renderWaterfall(steps) {
    waterfallWrap.innerHTML = '';
    if (!steps || steps.length === 0) return;

    const width = 760;
    const height = 230;
    const margin = { top: 25, right: 20, bottom: 45, left: 45 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const n = steps.length;
    const colWidth = chartW / n;
    const barWidth = Math.min(colWidth * 0.65, 42);

    const yScale = (val) => chartH - (Math.max(0, Math.min(100, val)) / 100) * chartH;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.width = '100%';
    svg.style.height = 'auto';

    // Horizontal grid lines
    [0, 25, 50, 75, 100].forEach(tick => {
      const y = margin.top + yScale(tick);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', margin.left);
      line.setAttribute('x2', width - margin.right);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#e2e8f0');
      line.setAttribute('stroke-dasharray', '2 2');
      svg.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', margin.left - 6);
      label.setAttribute('y', y + 3);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', '#94a3b8');
      label.setAttribute('font-size', '9.5');
      label.setAttribute('font-family', 'JetBrains Mono');
      label.textContent = `${tick}%`;
      svg.appendChild(label);
    });

    steps.forEach((step, idx) => {
      const centerX = margin.left + idx * colWidth + colWidth / 2;
      const x = centerX - barWidth / 2;

      let barTop, barBottom, color;
      if (step.type === 'baseline' || step.type === 'final') {
        barTop = margin.top + yScale(step.value);
        barBottom = margin.top + yScale(0);
        color = '#0f172a'; // Ink dark
      } else {
        const prevStepVal = steps[idx - 1] ? steps[idx - 1].value : step.value;
        const currentVal = step.value;
        barTop = margin.top + yScale(Math.max(prevStepVal, currentVal));
        barBottom = margin.top + yScale(Math.min(prevStepVal, currentVal));
        color = step.delta >= 0 ? '#dc2626' : '#059669';
      }

      const barH = Math.max(barBottom - barTop, 3);

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', barTop);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', barH);
      rect.setAttribute('fill', color);
      rect.setAttribute('rx', '3');

      rect.setAttribute('data-tip-title', `${step.step}: ${step.value}%`);
      rect.setAttribute('data-tip-body', step.text);
      rect.setAttribute('data-tip-meta', step.delta !== 0 ? `DELTA: ${step.delta >= 0 ? '+' : ''}${step.delta}%` : 'ANCHOR VALUE');

      svg.appendChild(rect);

      // Value label
      const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valText.setAttribute('x', centerX);
      valText.setAttribute('y', barTop - 5);
      valText.setAttribute('text-anchor', 'middle');
      valText.setAttribute('font-size', '10');
      valText.setAttribute('font-weight', '700');
      valText.setAttribute('font-family', 'JetBrains Mono');
      valText.setAttribute('fill', color);
      valText.textContent = `${step.value}%`;
      svg.appendChild(valText);

      // X-Axis label
      const stepLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stepLabel.setAttribute('x', centerX);
      stepLabel.setAttribute('y', height - 12);
      stepLabel.setAttribute('text-anchor', 'middle');
      stepLabel.setAttribute('font-size', '9.5');
      stepLabel.setAttribute('fill', '#475569');
      stepLabel.setAttribute('font-weight', '600');

      let shortName = step.step;
      if (shortName.includes('Debt-to-Income')) shortName = 'DTI';
      else if (shortName.includes('Loan-to-Annual-Income')) shortName = 'LTI';
      else if (shortName.includes('Annual Interest')) shortName = 'APR';
      else if (shortName.includes('Credit History')) shortName = 'History';
      else if (shortName.includes('Missed Payments')) shortName = 'Missed';
      else if (shortName.includes('Baseline')) shortName = 'Baseline';
      else if (shortName.includes('Final')) shortName = 'Consensus';

      stepLabel.textContent = shortName;
      svg.appendChild(stepLabel);
    });

    waterfallWrap.appendChild(svg);
  }

  /**
   * Render Top Driver & Mitigant Chips
   */
  function renderDriverChips(topRisk, topMitigant) {
    xaiDriversBox.innerHTML = '';

    if (topRisk) {
      const riskDiv = document.createElement('div');
      riskDiv.className = 'driver-pill-clean risk';
      riskDiv.setAttribute('data-tip-title', 'Primary Risk Inflator');
      riskDiv.setAttribute('data-tip-body', topRisk.explanation);
      riskDiv.setAttribute('data-tip-meta', `+${topRisk.delta}% to default probability`);
      riskDiv.innerHTML = `
        <span>Primary Risk Driver: <strong>${topRisk.feature_name}</strong></span>
        <strong>+${topRisk.delta}%</strong>
      `;
      xaiDriversBox.appendChild(riskDiv);
    }

    if (topMitigant) {
      const mitDiv = document.createElement('div');
      mitDiv.className = 'driver-pill-clean mitigant';
      mitDiv.setAttribute('data-tip-title', 'Strongest Solvency Mitigant');
      mitDiv.setAttribute('data-tip-body', topMitigant.explanation);
      mitDiv.setAttribute('data-tip-meta', `${topMitigant.delta}% risk reduction`);
      mitDiv.innerHTML = `
        <span>Strongest Mitigant: <strong>${topMitigant.feature_name}</strong></span>
        <strong>${topMitigant.delta}%</strong>
      `;
      xaiDriversBox.appendChild(mitDiv);
    }
  }

  /**
   * Render Global Feature Importance Bars
   */
  function renderGlobalFeatureImportance(globalDict, algo) {
    globalBarsGrid.innerHTML = '';
    const weights = globalDict[algo] || globalDict.consensus;
    if (!weights) return;

    const names = {
      debt_to_income: 'Debt-to-Income (DTI)',
      loan_to_income: 'Loan-to-Income (LTI)',
      annual_interest_rate: 'Annual Contractual Interest Rate (APR)',
      credit_history_years: 'Credit History Tenure Length',
      missed_payments_12m: 'Missed Payments (Last 12 Months)'
    };

    const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([key, val]) => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.setAttribute('data-tip-title', names[key] || key);
      row.setAttribute('data-tip-body', `Feature weight: ${val}% in ${algo.replace('_', ' ').toUpperCase()} model.`);
      row.setAttribute('data-tip-meta', 'GLOBAL FEATURE IMPORTANCE');

      row.innerHTML = `
        <div class="bar-meta-clean">
          <span class="bar-name-txt">${names[key] || key}</span>
          <span class="bar-val-txt">${val}%</span>
        </div>
        <div class="bar-bg-line">
          <div class="bar-fill-line" style="width: ${val}%"></div>
        </div>
      `;
      globalBarsGrid.appendChild(row);
    });
  }

  /**
   * Render Multi-Model Mini Cards
   */
  function renderModelCards(models) {
    modelsCardsRow.innerHTML = '';
    if (!models) return;

    Object.values(models).forEach(m => {
      const card = document.createElement('div');
      card.className = 'mini-model-card';
      card.setAttribute('data-tip-title', `${m.name} (${m.family})`);
      card.setAttribute('data-tip-body', `Holdout Test ROC-AUC: ${m.metrics.roc_auc}%, Accuracy: ${m.metrics.accuracy}%.`);
      card.setAttribute('data-tip-meta', `PREDICTED SCORE: ${m.risk_score} / 100`);

      let barColor = 'var(--emerald)';
      if (m.risk_score >= 65) barColor = 'var(--crimson)';
      else if (m.risk_score >= 30) barColor = 'var(--amber)';

      card.innerHTML = `
        <div class="mm-head">
          <span class="mm-name">${m.name}</span>
          <span class="mm-family">${m.family.split(' ')[0]}</span>
        </div>
        <div class="mm-score">${m.risk_score}<span style="font-size: 13px; font-weight: 500; color: var(--ink-500);"> / 100</span></div>
        <div class="mm-bar">
          <div class="mm-bar-fill" style="width: ${m.risk_score}%; background: ${barColor};"></div>
        </div>
        <div class="mm-metrics">
          <span>AUC: <strong>${m.metrics.roc_auc}%</strong></span>
          <span>F1: <strong>${m.metrics.f1_score}%</strong></span>
          <span>Acc: <strong>${m.metrics.accuracy}%</strong></span>
        </div>
      `;
      modelsCardsRow.appendChild(card);
    });
  }

  /**
   * Render Multi-Model Benchmark Table
   */
  function renderBenchmarkTable(models) {
    benchmarkTbody.innerHTML = '';
    if (!models) return;

    Object.values(models).forEach(m => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-tip-title', m.name);
      tr.setAttribute('data-tip-body', `Ensemble weight: ${(m.weight * 100).toFixed(0)}%.`);
      tr.setAttribute('data-tip-meta', m.family);

      tr.innerHTML = `
        <td><strong>${m.name}</strong></td>
        <td>${m.family}</td>
        <td>${m.metrics.accuracy}%</td>
        <td><strong>${m.metrics.roc_auc}%</strong></td>
        <td>${m.metrics.precision}%</td>
        <td>${m.metrics.recall}%</td>
        <td><strong>${m.metrics.f1_score}%</strong></td>
        <td>${(m.weight * 100).toFixed(0)}%</td>
      `;
      benchmarkTbody.appendChild(tr);
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
