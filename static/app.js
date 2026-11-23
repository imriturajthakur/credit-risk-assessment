/**
 * RiskLens — Animated Decision Flow & Node-Scattering Simulation Engine
 */
(function() {
  'use strict';

  // Preset financial profiles
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

  // Animation speed mapping (milliseconds)
  const SPEEDS = {
    slow: 1100,
    normal: 650,
    fast: 220
  };
  let currentSpeed = 'normal';

  // State store
  let currentScoreData = null;
  let globalModelsData = null;
  let activeGlobalAlgo = 'consensus';
  let isAnimating = false;
  let activeAnimationTimer = null;

  // DOM Elements
  const tooltip = document.querySelector('#universal-tooltip');
  const tipTitle = document.querySelector('#u-tooltip-title');
  const tipBody = document.querySelector('#u-tooltip-body');
  const tipMeta = document.querySelector('#u-tooltip-meta');

  // Inspector Drawer
  const inspectorDrawer = document.querySelector('#node-inspector-drawer');
  const inspCloseBtn = document.querySelector('#insp-close-btn');
  const inspStepBadge = document.querySelector('#insp-step-badge');
  const inspTitle = document.querySelector('#insp-title');
  const inspFormula = document.querySelector('#insp-formula');
  const inspCondDesc = document.querySelector('#insp-condition-desc');
  const inspInputsGrid = document.querySelector('#insp-inputs-grid');
  const inspVerdict = document.querySelector('#insp-verdict');

  // Top Pastel Boxes
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

  // Simulation Controls
  const simStatusChip = document.querySelector('#sim-status-chip');
  const simStatusText = document.querySelector('#sim-status-text');
  const simStepText = document.querySelector('#sim-step-text');
  const replayBtn = document.querySelector('#replay-flow-btn');
  const speedBtns = document.querySelectorAll('.speed-btn');

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

  // Narrative Text
  const narrativeText = document.querySelector('#narrative-text');
  const blueprintCanvas = document.querySelector('.blueprint-canvas');
  const themeBtns = document.querySelectorAll('.theme-btn');

  // Canvas Pan & Zoom State
  let panX = 0;
  let panY = 0;
  let zoomScale = 1.0;
  let isPanningCanvas = false;
  let panStartMouseX = 0;
  let panStartMouseY = 0;

  // Node Drag State
  let isDraggingNode = false;
  let draggedNodeId = null;
  let nodeStartPosX = 0;
  let nodeStartPosY = 0;
  let nodeDragStartMouseX = 0;
  let nodeDragStartMouseY = 0;
  let hasMovedNode = false;

  // Node Box Dimensions: Generously sized Excalidraw cards
  const nodeW = 230;
  const nodeH = 88;

  // Default Node Layout Positions (x, y) with generous spacing to prevent overlap/clipping
  const DEFAULT_NODES = {
    root: {
      x: 600, y: 60,
      title: 'Applicant Ingestion',
      stepTag: 'STEP 1 • INPUT',
      cond: 'Parse 5 financial ratios',
      evalRule: 'DTI, LTI, APR, History, Missed',
      badge: 'INPUT'
    },
    node_clean: {
      x: 340, y: 200,
      title: 'Clean Repayment Track',
      stepTag: 'STEP 2 • CRITERIA',
      cond: 'Missed Payments == 0',
      evalRule: '0 missed payments in 12m',
      badge: 'PASS'
    },
    node_delinquent: {
      x: 870, y: 200,
      title: 'Delinquency Track',
      stepTag: 'STEP 2 • WARNING',
      cond: 'Missed Payments > 0',
      evalRule: 'Active late payments detected',
      badge: 'WARNING'
    },
    node_low_dti: {
      x: 200, y: 355,
      title: 'Low Debt-to-Income',
      stepTag: 'STEP 3 • CASHFLOW',
      cond: 'DTI ≤ 36.0%',
      evalRule: 'Monthly obligations < 36%',
      badge: 'SAFE'
    },
    node_high_dti: {
      x: 480, y: 355,
      title: 'Elevated DTI',
      stepTag: 'STEP 3 • BURDEN',
      cond: 'DTI > 36.0%',
      evalRule: 'Testing tenure compensation',
      badge: 'STRAINED'
    },
    node_mild_delinq: {
      x: 780, y: 355,
      title: 'Mild Delinquency',
      stepTag: 'STEP 3 • RECOVERY',
      cond: 'Missed Payments ≤ 2',
      evalRule: 'Testing cashflow recovery',
      badge: 'RECOVERY'
    },
    leaf_prime: {
      x: 150, y: 520,
      title: 'Prime Tier Approval',
      stepTag: 'STEP 4 • FINAL VERDICT',
      cond: 'LTI ≤ 1.50x — Top Tier',
      evalRule: 'Preferred Rate & Max Sanction',
      badge: 'PRIME',
      leaf: true
    },
    leaf_standard: {
      x: 420, y: 520,
      title: 'Standard Solvency',
      stepTag: 'STEP 4 • FINAL VERDICT',
      cond: 'Standard Amortization',
      evalRule: 'Manageable Risk Profile',
      badge: 'STANDARD',
      leaf: true
    },
    leaf_strained: {
      x: 710, y: 520,
      title: 'Conditional Review',
      stepTag: 'STEP 4 • FINAL VERDICT',
      cond: 'Review / Mitigants Needed',
      evalRule: 'Restructuring / Co-borrower',
      badge: 'REVIEW',
      leaf: true
    },
    leaf_subprime: {
      x: 1010, y: 520,
      title: 'High Default Risk',
      stepTag: 'STEP 4 • FINAL VERDICT',
      cond: 'Critical Default Vulnerability',
      evalRule: 'Unsecured Credit Declined',
      badge: 'SUBPRIME',
      leaf: true
    }
  };

  const TREE_EDGES = [
    { id: 'e_root_clean', from: 'root', to: 'node_clean', label: 'Clean Track (0 missed)' },
    { id: 'e_root_delinq', from: 'root', to: 'node_delinquent', label: 'Delinquent (>0 missed)' },
    { id: 'e_clean_low_dti', from: 'node_clean', to: 'node_low_dti', label: 'DTI ≤ 36% (Safe)' },
    { id: 'e_clean_high_dti', from: 'node_clean', to: 'node_high_dti', label: 'DTI > 36% (Elevated)' },
    { id: 'e_delinq_mild', from: 'node_delinquent', to: 'node_mild_delinq', label: 'Missed ≤ 2 (Isolated)' },
    { id: 'e_delinq_severe', from: 'node_delinquent', to: 'leaf_subprime', label: 'Missed > 2 (Chronic)' },
    { id: 'e_low_dti_prime', from: 'node_low_dti', to: 'leaf_prime', label: 'LTI ≤ 1.5x (Optimal)' },
    { id: 'e_low_dti_std', from: 'node_low_dti', to: 'leaf_standard', label: 'LTI > 1.5x (Large Loan)' },
    { id: 'e_high_dti_std', from: 'node_high_dti', to: 'leaf_standard', label: 'History ≥ 5y (Seasoned)' },
    { id: 'e_high_dti_strain', from: 'node_high_dti', to: 'leaf_strained', label: 'History < 5y (Short)' },
    { id: 'e_mild_strain', from: 'node_mild_delinq', to: 'leaf_strained', label: 'DTI ≤ 42% (Buffer)' },
    { id: 'e_mild_subprime', from: 'node_mild_delinq', to: 'leaf_subprime', label: 'DTI > 42% (Overburdened)' }
  ];

  // Global reference to active tree graph nodes & edges
  let currentTreeNodes = {};
  let currentTreeEdges = [...TREE_EDGES];

  // Canvas floating toolbar controls
  const canvasZoomIn = document.querySelector('#canvas-zoom-in');
  const canvasZoomOut = document.querySelector('#canvas-zoom-out');
  const canvasZoomReset = document.querySelector('#canvas-zoom-reset');
  const canvasLayoutReset = document.querySelector('#canvas-layout-reset');
  const canvasZoomVal = document.querySelector('#canvas-zoom-val');

  /**
   * Application Initialization
   */
  async function init() {
    setupUniversalTooltips();
    setupInspectorDrawer();
    setupViewSwitching();
    setupPresetButtons();
    setupSimulationControls();
    setupCanvasPanZoomControls();
    setupThemeToggles();
    setupAlgoToggles();
    setupFormSubmission();

    // Default canvas theme: Excalidraw Whiteboard
    if (blueprintCanvas) {
      blueprintCanvas.classList.add('theme-excalidraw');
    }

    // Fetch baseline models
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        globalModelsData = await res.json();
        renderBenchmarkTable(globalModelsData.models);
      }
    } catch (e) {
      console.warn('Could not load static models metadata:', e);
    }

    // Auto-run initial prime assessment on load
    await executeAssessment();
  }

  /**
   * Apply Pan & Zoom Transform to Canvas Viewport Layer
   */
  function applyCanvasTransform() {
    const layer = document.querySelector('#tree-canvas-layer');
    if (layer) {
      layer.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoomScale})`);
    }
    if (canvasZoomVal) {
      canvasZoomVal.textContent = `${Math.round(zoomScale * 100)}%`;
    }
  }

  /**
   * Start dragging a node
   */
  function startNodeDrag(nodeId, clientX, clientY) {
    if (!currentTreeNodes[nodeId]) return;
    isDraggingNode = true;
    draggedNodeId = nodeId;
    hasMovedNode = false;

    nodeStartPosX = currentTreeNodes[nodeId].x;
    nodeStartPosY = currentTreeNodes[nodeId].y;
    nodeDragStartMouseX = clientX;
    nodeDragStartMouseY = clientY;

    const nodeGroup = document.querySelector(`#node-g-${nodeId}`);
    if (nodeGroup) {
      nodeGroup.classList.add('dragging');
    }
  }

  /**
   * Setup Canvas Pan, Zoom and Toolbar Buttons
   */
  function setupCanvasPanZoomControls() {
    if (canvasZoomIn) {
      canvasZoomIn.addEventListener('click', () => {
        zoomScale = Math.min(2.5, zoomScale * 1.2);
        applyCanvasTransform();
      });
    }
    if (canvasZoomOut) {
      canvasZoomOut.addEventListener('click', () => {
        zoomScale = Math.max(0.4, zoomScale / 1.2);
        applyCanvasTransform();
      });
    }
    if (canvasZoomReset) {
      canvasZoomReset.addEventListener('click', () => {
        panX = 0;
        panY = 0;
        zoomScale = 1.0;
        applyCanvasTransform();
      });
    }
    if (canvasLayoutReset) {
      canvasLayoutReset.addEventListener('click', () => {
        Object.keys(DEFAULT_NODES).forEach(nodeId => {
          if (currentTreeNodes[nodeId]) {
            currentTreeNodes[nodeId].x = DEFAULT_NODES[nodeId].x;
            currentTreeNodes[nodeId].y = DEFAULT_NODES[nodeId].y;
            const nodeGroup = document.querySelector(`#node-g-${nodeId}`);
            if (nodeGroup) {
              nodeGroup.setAttribute('transform', `translate(${DEFAULT_NODES[nodeId].x}, ${DEFAULT_NODES[nodeId].y})`);
            }
            updateConnectedEdges(nodeId);
          }
        });
      });
    }

    // Canvas Pan (Drag Background)
    if (treeContainer) {
      treeContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.tree-node-group')) return; // Handled by node drag
        isPanningCanvas = true;
        panStartMouseX = e.clientX - panX;
        panStartMouseY = e.clientY - panY;
        treeContainer.classList.add('panning');
      });

      // Mouse Wheel Zoom centered on cursor
      treeContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.4, Math.min(2.5, zoomScale * factor));

        const rect = treeContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        panX = mouseX - (mouseX - panX) * (newZoom / zoomScale);
        panY = mouseY - (mouseY - panY) * (newZoom / zoomScale);
        zoomScale = newZoom;

        applyCanvasTransform();
      }, { passive: false });

      // Touch Panning for Mobile / Tablet
      treeContainer.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
          if (e.target.closest('.tree-node-group')) return;
          isPanningCanvas = true;
          panStartMouseX = e.touches[0].clientX - panX;
          panStartMouseY = e.touches[0].clientY - panY;
          treeContainer.classList.add('panning');
        }
      }, { passive: true });
    }

    // Global Mouse Move & Mouse Up for Canvas Panning and Node Dragging
    window.addEventListener('mousemove', (e) => {
      // 1. Canvas Panning
      if (isPanningCanvas) {
        panX = e.clientX - panStartMouseX;
        panY = e.clientY - panStartMouseY;
        applyCanvasTransform();
        return;
      }

      // 2. Node Drag & Drop
      if (isDraggingNode && draggedNodeId && currentTreeNodes[draggedNodeId]) {
        const dx = (e.clientX - nodeDragStartMouseX) / zoomScale;
        const dy = (e.clientY - nodeDragStartMouseY) / zoomScale;

        if (Math.hypot(dx, dy) > 4) {
          hasMovedNode = true;
        }

        const newX = Math.round(nodeStartPosX + dx);
        const newY = Math.round(nodeStartPosY + dy);

        currentTreeNodes[draggedNodeId].x = newX;
        currentTreeNodes[draggedNodeId].y = newY;

        const nodeGroup = document.querySelector(`#node-g-${draggedNodeId}`);
        if (nodeGroup) {
          nodeGroup.setAttribute('transform', `translate(${newX}, ${newY})`);
        }

        // Real-time update of all connected connector edges!
        updateConnectedEdges(draggedNodeId);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanningCanvas) {
        isPanningCanvas = false;
        if (treeContainer) treeContainer.classList.remove('panning');
      }

      if (isDraggingNode) {
        const nodeGroup = document.querySelector(`#node-g-${draggedNodeId}`);
        if (nodeGroup) nodeGroup.classList.remove('dragging');

        // If not dragged significantly, treat as Click -> Open Inspector!
        if (!hasMovedNode && draggedNodeId && currentTreeNodes[draggedNodeId]) {
          const nodeMeta = currentTreeNodes[draggedNodeId];
          const evals = (currentScoreData && currentScoreData.tree_path && currentScoreData.tree_path.evaluations) || {};
          openNodeInspector(draggedNodeId, nodeMeta, evals[draggedNodeId]);
        }

        isDraggingNode = false;
        draggedNodeId = null;
      }
    });

    // Touch Move & Touch End for Mobile / Tablet
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 1) {
        const touch = e.touches[0];
        if (isPanningCanvas) {
          e.preventDefault();
          panX = touch.clientX - panStartMouseX;
          panY = touch.clientY - panStartMouseY;
          applyCanvasTransform();
        } else if (isDraggingNode && draggedNodeId && currentTreeNodes[draggedNodeId]) {
          e.preventDefault();
          const dx = (touch.clientX - nodeDragStartMouseX) / zoomScale;
          const dy = (touch.clientY - nodeDragStartMouseY) / zoomScale;
          if (Math.hypot(dx, dy) > 4) hasMovedNode = true;
          const newX = Math.round(nodeStartPosX + dx);
          const newY = Math.round(nodeStartPosY + dy);
          currentTreeNodes[draggedNodeId].x = newX;
          currentTreeNodes[draggedNodeId].y = newY;
          const nodeGroup = document.querySelector(`#node-g-${draggedNodeId}`);
          if (nodeGroup) nodeGroup.setAttribute('transform', `translate(${newX}, ${newY})`);
          updateConnectedEdges(draggedNodeId);
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (isPanningCanvas) {
        isPanningCanvas = false;
        if (treeContainer) treeContainer.classList.remove('panning');
      }
      if (isDraggingNode) {
        const nodeGroup = document.querySelector(`#node-g-${draggedNodeId}`);
        if (nodeGroup) nodeGroup.classList.remove('dragging');
        if (!hasMovedNode && draggedNodeId && currentTreeNodes[draggedNodeId]) {
          const nodeMeta = currentTreeNodes[draggedNodeId];
          const evals = (currentScoreData && currentScoreData.tree_path && currentScoreData.tree_path.evaluations) || {};
          openNodeInspector(draggedNodeId, nodeMeta, evals[draggedNodeId]);
        }
        isDraggingNode = false;
        draggedNodeId = null;
      }
    });
  }

  /**
   * Recalculate and update SVG edge paths connected to a dragged node in real time
   */
  function updateConnectedEdges(nodeId) {
    const nodeH = 88;

    currentTreeEdges.forEach(edge => {
      if (edge.from !== nodeId && edge.to !== nodeId) return;

      const fromNode = currentTreeNodes[edge.from];
      const toNode = currentTreeNodes[edge.to];
      if (!fromNode || !toNode) return;

      const x1 = fromNode.x;
      const y1 = fromNode.y + nodeH / 2;
      const x2 = toNode.x;
      const y2 = toNode.y - nodeH / 2;

      const midY = (y1 + y2) / 2;
      const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

      const pathElem = document.querySelector(`#edge-p-${edge.id}`);
      if (pathElem) {
        pathElem.setAttribute('d', pathD);
      }

      const midX = (x1 + x2) / 2;
      const lblGroup = document.querySelector(`#edge-lbl-${edge.id}`);
      if (lblGroup) {
        const pillW = Math.min(edge.label.length * 6.5 + 16, 170);
        const pillH = 18;

        const pillBg = lblGroup.querySelector('rect');
        if (pillBg) {
          pillBg.setAttribute('x', midX - pillW / 2);
          pillBg.setAttribute('y', midY - pillH / 2);
        }

        const lblText = lblGroup.querySelector('text');
        if (lblText) {
          lblText.setAttribute('x', midX);
          lblText.setAttribute('y', midY + 4);
        }
      }
    });
  }

  /**
   * Theme Toggles (Excalidraw, Blueprint, Minimal)
   */
  function setupThemeToggles() {
    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.getAttribute('data-theme') || 'excalidraw';

        if (blueprintCanvas) {
          blueprintCanvas.classList.remove('theme-excalidraw', 'theme-blueprint', 'theme-minimal');
          blueprintCanvas.classList.add(`theme-${theme}`);
        }
      });
    });
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
   * Inspector Drawer Setup
   */
  function setupInspectorDrawer() {
    inspCloseBtn.addEventListener('click', () => {
      inspectorDrawer.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') inspectorDrawer.classList.add('hidden');
    });
  }

  /**
   * Open Inspector for a given Node
   */
  function openNodeInspector(nodeId, nodeMeta, evalData) {
    if (!evalData) {
      evalData = {
        title: nodeMeta.title,
        step: 1,
        condition: nodeMeta.cond,
        formula: 'Evaluated based on applicant ratio thresholds',
        detail: nodeMeta.cond,
        inputs_used: { 'Status': 'Evaluated' },
        verdict_impact: 'Condition determines the active decision branch taken.'
      };
    }

    inspStepBadge.textContent = `STEP ${evalData.step || 1}`;
    inspTitle.textContent = evalData.title || nodeMeta.title;
    inspFormula.textContent = evalData.formula || evalData.condition;
    inspCondDesc.textContent = evalData.detail || nodeMeta.cond;

    // Render Ingested Inputs Table
    inspInputsGrid.innerHTML = '';
    const inputsMap = evalData.inputs_used || {};
    Object.entries(inputsMap).forEach(([k, v]) => {
      const item = document.createElement('div');
      item.className = 'insp-input-item';
      item.innerHTML = `
        <span>${k}</span>
        <strong>${v}</strong>
      `;
      inspInputsGrid.appendChild(item);
    });

    // Render Impact
    inspVerdict.textContent = evalData.verdict_impact || 'Path determined.';
    inspVerdict.className = 'insp-verdict-box';
    if (evalData.status === 'WARNING' || evalData.status === 'REVIEW') {
      inspVerdict.classList.add('warning');
    } else if (evalData.status === 'HIGH RISK') {
      inspVerdict.classList.add('risk');
    }

    inspectorDrawer.classList.remove('hidden');
  }

  /**
   * Simulation & Speed Controls
   */
  function setupSimulationControls() {
    replayBtn.addEventListener('click', () => {
      if (currentScoreData && currentScoreData.tree_path) {
        runAnimatedFlow(currentScoreData);
      }
    });

    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSpeed = btn.getAttribute('data-speed') || 'normal';
      });
    });
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
    submitText.textContent = 'Simulating Decision Stream…';

    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      // Live update quick ratios
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

      // 1. Static companion views update immediately
      renderArchitectureHub(data.inputs, data.consensus, data.models);
      renderWaterfall(data.xai.waterfall);
      renderDriverChips(data.xai.top_risk_driver, data.xai.top_mitigant);
      renderGlobalFeatureImportance(data.xai.global_importance, activeGlobalAlgo);
      renderModelCards(data.models);
      renderBenchmarkTable(data.models);

      // 2. Trigger Heavily Animated Decision Flow with Delays!
      await runAnimatedFlow(data);

    } catch (err) {
      formError.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      submitText.textContent = 'Run Assessment & Animate Flow';
    }
  }

  /**
   * Delay Helper
   */
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Animated Number Count-Up Odometer
   */
  function animateValue(elem, start, end, duration, suffix = '') {
    const startTime = performance.now();
    const isCurrency = suffix === '₹';

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease Out Quartic
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (end - start) * ease);

      if (isCurrency) {
        elem.textContent = inrFormatter.format(current).replace('₹', '₹ ');
      } else {
        elem.textContent = `${current}${suffix}`;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }

  /**
   * The Animated Graph Simulation Engine
   * Animates step-by-step from root to leaf with live particle pulses, node glows, and delays!
   */
  async function runAnimatedFlow(data) {
    if (isAnimating) return;
    isAnimating = true;

    const { tree_path, consensus } = data;
    const pathNodes = tree_path.path_nodes || [];
    const pathEdges = tree_path.path_edges || [];
    const evals = tree_path.evaluations || {};

    const delayMs = SPEEDS[currentSpeed] || 650;

    // Reset Top Pastel Cards to 0 before count-up
    topScore.textContent = '...';
    topSanction.textContent = '...';
    topAgreement.textContent = '...';
    topVerdict.textContent = 'Evaluating...';

    // Build the SVG base DOM
    renderDecisionTreeDOM(tree_path);

    // Update simulation status bar
    simStatusChip.classList.add('animating');
    simStatusText.textContent = 'Simulating Decision Stream…';
    simStepText.textContent = `Step 0 of ${pathNodes.length}`;

    // Reset all nodes and edges to idle
    document.querySelectorAll('.tree-node-group').forEach(n => {
      n.classList.remove('active', 'processing', 'resolved', 'warning', 'risk');
    });
    document.querySelectorAll('.tree-edge').forEach(e => {
      e.classList.remove('active', 'animating');
    });

    // Step-by-Step Animation Loop
    for (let i = 0; i < pathNodes.length; i++) {
      const nodeId = pathNodes[i];
      const nodeElem = document.querySelector(`#node-g-${nodeId}`);
      const evalData = evals[nodeId] || {};

      simStepText.textContent = `Step ${i + 1} of ${pathNodes.length}`;
      simStatusText.textContent = `Evaluating: ${evalData.title || nodeId}…`;

      // 1. Highlight Node in Processing / Evaluating state (Blue Glow + Ripple)
      if (nodeElem) {
        nodeElem.classList.add('processing');
      }

      // Breadcrumb chip activation
      const chipElem = document.querySelector(`#chip-step-${nodeId}`);
      if (chipElem) {
        chipElem.classList.add('animating');
      }

      // Allow visual delay for user to inspect
      await wait(delayMs);

      // 2. Resolve Node to Final Status (Emerald/Amber/Crimson)
      if (nodeElem) {
        nodeElem.classList.remove('processing');
        nodeElem.classList.add('active', 'resolved');
        if (evalData.status === 'WARNING' || evalData.status === 'REVIEW') {
          nodeElem.classList.add('warning');
        } else if (evalData.status === 'HIGH RISK') {
          nodeElem.classList.add('risk');
        }
      }

      if (chipElem) {
        chipElem.classList.remove('animating');
        chipElem.classList.add('active');
      }

      // 3. Fire Laser / Particle Stream to Next Node along the Edge
      if (i < pathEdges.length) {
        const edgeId = pathEdges[i];
        const edgeElem = document.querySelector(`#edge-p-${edgeId}`);
        if (edgeElem) {
          edgeElem.classList.add('active', 'animating');
          const isWarn = evalData.status === 'WARNING' || evalData.status === 'REVIEW';
          const isRisk = evalData.status === 'HIGH RISK';
          if (isRisk) {
            edgeElem.setAttribute('marker-end', 'url(#arrow-risk)');
          } else if (isWarn) {
            edgeElem.setAttribute('marker-end', 'url(#arrow-warning)');
          } else {
            edgeElem.setAttribute('marker-end', 'url(#arrow-active)');
          }
        }
        await wait(Math.round(delayMs * 0.65));
      }
    }

    // Phase 4: Final Arrival & Top Metric Cards Count-Up
    simStatusChip.classList.remove('animating');
    simStatusText.textContent = 'Decision Flow Complete ✓';

    animateValue(topScore, 0, consensus.risk_score, 800, '%');
    animateValue(topSanction, 0, consensus.sanction_high, 900, '₹');
    topAgreement.textContent = consensus.agreement ? consensus.agreement.split(' ')[0] : '4 / 4';
    topVerdict.textContent = consensus.band;

    // Render Full Process Narrative Trail
    renderNarrativeTrail(data);

    isAnimating = false;
  }

  /**
   * Render Full Unabbreviated Decision Process Narrative
   */
  function renderNarrativeTrail(data) {
    if (!narrativeText || !data) return;
    const { inputs, consensus, tree_path } = data;
    const evals = tree_path.evaluations || {};
    const dtiPct = ((inputs.monthly_debt_payments / inputs.monthly_income) * 100).toFixed(1);
    const ltiVal = (inputs.loan_amount / (inputs.monthly_income * 12)).toFixed(2);
    const missed = parseInt(inputs.missed_payments_12m, 10);

    let statusTag = 'prime';
    if (consensus.risk_score >= 65) statusTag = 'risk';
    else if (consensus.risk_score >= 30) statusTag = 'warning';

    let stepsHtml = '';
    (tree_path.path_nodes || []).forEach((nodeId, idx) => {
      const ev = evals[nodeId];
      if (!ev) return;
      stepsHtml += `
        <div style="margin-top: 6px;">
          <strong>Step ${idx + 1}: ${ev.title}</strong> — ${ev.detail}
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #475569; margin-top: 2px;">
            ↳ Formula Evaluated: <span style="color: #0f172a; font-weight: 600;">${ev.formula || ev.condition}</span>
          </div>
        </div>
      `;
    });

    narrativeText.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Applicant Intake Summary:</strong> Gross Salary of <strong>${inrFormatter.format(inputs.monthly_income)}</strong> with <strong>${inrFormatter.format(inputs.monthly_debt_payments)}</strong> existing monthly debt (<span class="narrative-tag">DTI: ${dtiPct}%</span>), requested loan of <strong>${inrFormatter.format(inputs.loan_amount)}</strong> (<span class="narrative-tag">LTI: ${ltiVal}x</span>), interest rate <strong>${inputs.annual_interest_rate}% APR</strong>, <strong>${inputs.credit_history_years} years</strong> history tenure, and <strong>${missed} missed payments</strong>.
      </div>
      <div style="border-left: 2px solid #cbd5e1; padding-left: 10px; margin-bottom: 8px;">
        ${stepsHtml}
      </div>
      <div style="margin-top: 8px; font-weight: 500;">
        <strong>Final Underwriting Verdict:</strong> Classified as <span class="narrative-tag ${statusTag}">${consensus.band.toUpperCase()}</span> with a calculated default risk score of <span class="narrative-highlight">${consensus.risk_score}/100 (${consensus.probability}% probability)</span>. Consensus supported by <span class="narrative-highlight">${consensus.agreement || '4/4 models'}</span>. Maximum recommended indicative capital sanction is <span class="narrative-highlight">${inrFormatter.format(consensus.sanction_high)}</span> with an estimated monthly cashflow surplus of <span class="narrative-highlight">${inrFormatter.format(consensus.disposable_income)}</span>.
      </div>
    `;
  }

  /**
   * Render SVG Tree Base DOM — Excalidraw Spacious Rectangular Card Style with Pan, Zoom & Drag-and-Drop
   */
  function renderDecisionTreeDOM(treePath) {
    treeContainer.innerHTML = '';
    pathStepsList.innerHTML = '';
    if (!treePath) return;

    const evals = treePath.evaluations || {};
    const svgWidth = 1200;
    const svgHeight = 620;

    // Initialize or preserve currentTreeNodes positions across runs
    if (!currentTreeNodes || Object.keys(currentTreeNodes).length === 0) {
      currentTreeNodes = JSON.parse(JSON.stringify(DEFAULT_NODES));
    } else {
      Object.keys(DEFAULT_NODES).forEach(nodeId => {
        if (!currentTreeNodes[nodeId]) {
          currentTreeNodes[nodeId] = { ...DEFAULT_NODES[nodeId] };
        }
      });
    }
    currentTreeEdges = TREE_EDGES;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute('class', 'tree-svg excalidraw-svg');
    svg.setAttribute('id', 'tree-svg-root');

    // Arrow markers for Excalidraw-style edges
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
      </marker>
      <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
      </marker>
      <marker id="arrow-warning" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#d97706" />
      </marker>
      <marker id="arrow-risk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
      </marker>
    `;
    svg.appendChild(defs);

    // Canvas Viewport Transform Layer (for pan & zoom)
    const canvasLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    canvasLayer.setAttribute('id', 'tree-canvas-layer');
    canvasLayer.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoomScale})`);

    // Layer for connector edges
    const edgesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesLayer.setAttribute('id', 'tree-edges-layer');
    canvasLayer.appendChild(edgesLayer);

    // Layer for node cards
    const nodesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesLayer.setAttribute('id', 'tree-nodes-layer');
    canvasLayer.appendChild(nodesLayer);

    // 1. Draw Edges
    TREE_EDGES.forEach(edge => {
      const fromNode = currentTreeNodes[edge.from];
      const toNode = currentTreeNodes[edge.to];
      if (!fromNode || !toNode) return;

      const x1 = fromNode.x;
      const y1 = fromNode.y + nodeH / 2;
      const x2 = toNode.x;
      const y2 = toNode.y - nodeH / 2;

      const midY = (y1 + y2) / 2;
      const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', `edge-p-${edge.id}`);
      path.setAttribute('d', pathD);
      path.setAttribute('class', 'tree-edge');
      path.setAttribute('marker-end', 'url(#arrow-default)');

      path.setAttribute('data-tip-title', `Condition: ${edge.label}`);
      path.setAttribute('data-tip-body', `Branch connecting ${fromNode.title} to ${toNode.title}.`);
      path.setAttribute('data-tip-meta', 'BRANCH CONNECTOR');

      edgesLayer.appendChild(path);

      // Edge Pill Label (with white pill background)
      const midX = (x1 + x2) / 2;
      const lblGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      lblGroup.setAttribute('id', `edge-lbl-${edge.id}`);
      lblGroup.setAttribute('class', 'edge-label-group');

      const pillW = Math.min(edge.label.length * 6.5 + 16, 170);
      const pillH = 18;

      const pillBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pillBg.setAttribute('x', midX - pillW / 2);
      pillBg.setAttribute('y', midY - pillH / 2);
      pillBg.setAttribute('width', pillW);
      pillBg.setAttribute('height', pillH);
      pillBg.setAttribute('rx', '4');
      pillBg.setAttribute('class', 'edge-label-pill');
      lblGroup.appendChild(pillBg);

      const lblText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lblText.setAttribute('x', midX);
      lblText.setAttribute('y', midY + 4);
      lblText.setAttribute('text-anchor', 'middle');
      lblText.setAttribute('font-size', '9');
      lblText.setAttribute('font-family', 'JetBrains Mono');
      lblText.setAttribute('fill', '#475569');
      lblText.setAttribute('font-weight', '600');
      lblText.textContent = edge.label;
      lblGroup.appendChild(lblText);

      edgesLayer.appendChild(lblGroup);
    });

    // 2. Draw Excalidraw Rectangular Nodes centered at (0, 0) inside transform translate(x, y)
    const halfW = nodeW / 2; // 115
    const halfH = nodeH / 2; // 44

    Object.entries(currentTreeNodes).forEach(([nodeId, node]) => {
      const evalData = evals[nodeId] || {};

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', `node-g-${nodeId}`);
      g.setAttribute('class', 'tree-node-group excalidraw-node');
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

      // Mouse drag start
      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startNodeDrag(nodeId, e.clientX, e.clientY);
      });

      // Touch drag start
      g.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
          e.stopPropagation();
          startNodeDrag(nodeId, e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: false });

      // Hover Tooltip
      g.setAttribute('data-tip-title', evalData.title || node.title);
      g.setAttribute('data-tip-body', `${evalData.detail || node.cond} (Drag card to reposition • Click to inspect)`);
      g.setAttribute('data-tip-meta', 'DRAGGABLE NODE');

      // Base Rectangular Box (Excalidraw Card Style)
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -halfW);
      rect.setAttribute('y', -halfH);
      rect.setAttribute('width', nodeW);
      rect.setAttribute('height', nodeH);
      rect.setAttribute('class', 'node-box');
      g.appendChild(rect);

      // Top Row: Step Tag on Left
      const stepTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stepTxt.setAttribute('x', -halfW + 12);
      stepTxt.setAttribute('y', -halfH + 18);
      stepTxt.setAttribute('class', 'node-step-tag');
      stepTxt.textContent = node.stepTag || `STEP ${evalData.step || 1}`;
      g.appendChild(stepTxt);

      // Top Row: Status Badge on Right (Dedicated coordinates: NEVER collides with title!)
      const badgeW = 54;
      const badgeH = 17;
      const badgeX = halfW - badgeW - 10;
      const badgeY = -halfH + 8;

      const badgeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      badgeRect.setAttribute('x', badgeX);
      badgeRect.setAttribute('y', badgeY);
      badgeRect.setAttribute('width', badgeW);
      badgeRect.setAttribute('height', badgeH);
      badgeRect.setAttribute('class', 'node-badge-rect');
      g.appendChild(badgeRect);

      const badgeTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeTxt.setAttribute('x', badgeX + badgeW / 2);
      badgeTxt.setAttribute('y', badgeY + 12);
      badgeTxt.setAttribute('text-anchor', 'middle');
      badgeTxt.setAttribute('class', 'node-badge-text');
      badgeTxt.textContent = evalData.status || node.badge;
      g.appendChild(badgeTxt);

      // Middle Row: Bold Title (Given full width 210px! Never truncated!)
      const titleTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleTxt.setAttribute('x', -halfW + 12);
      titleTxt.setAttribute('y', -halfH + 42);
      titleTxt.setAttribute('class', 'node-title-text');
      titleTxt.textContent = node.title;
      g.appendChild(titleTxt);

      // Lower Row 1: Condition / Rule (Monospace)
      const ruleTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ruleTxt.setAttribute('x', -halfW + 12);
      ruleTxt.setAttribute('y', -halfH + 60);
      ruleTxt.setAttribute('class', 'node-condition-text');
      ruleTxt.textContent = node.cond;
      g.appendChild(ruleTxt);

      // Lower Row 2: Evaluation Detail
      const detailTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      detailTxt.setAttribute('x', -halfW + 12);
      detailTxt.setAttribute('y', -halfH + 76);
      detailTxt.setAttribute('class', 'node-eval-detail-text');
      detailTxt.textContent = node.evalRule || evalData.formula || 'Rule evaluated';
      g.appendChild(detailTxt);

      nodesLayer.appendChild(g);
    });

    svg.appendChild(canvasLayer);
    treeContainer.appendChild(svg);

    // 3. Render Breadcrumbs in Path Summary Bar with Full Process Text
    treePath.path_nodes.forEach((nodeId, idx) => {
      const node = currentTreeNodes[nodeId] || DEFAULT_NODES[nodeId];
      if (!node) return;
      const chip = document.createElement('span');
      chip.id = `chip-step-${nodeId}`;
      chip.className = 'step-chip';
      chip.textContent = node.title;
      chip.setAttribute('data-tip-title', node.title);
      chip.setAttribute('data-tip-body', evals[nodeId] ? evals[nodeId].detail : node.cond);
      chip.setAttribute('data-tip-meta', `Step ${idx + 1} of Flow`);

      chip.addEventListener('click', () => {
        openNodeInspector(nodeId, node, evals[nodeId]);
      });

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
        color = '#0f172a';
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
