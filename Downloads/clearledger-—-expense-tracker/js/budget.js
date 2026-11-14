import { saveBudget } from './storage.js';
import {
  formatCurrency,
  formatMonthLabel,
  escapeHtml,
} from './transactions.js';
import {
  calculateMonthlyMetrics,
  getCategoryBreakdown,
} from './dashboard.js';

export function calculateBudgetStatus(monthlyExpenses, budgetLimit) {
  const limit = Number(budgetLimit) || 0;
  const spent = Number(monthlyExpenses) || 0;

  if (limit <= 0) {
    return {
      budgetLimit: 0,
      spent,
      remaining: 0,
      utilization: 0,
      status: 'unset',
    };
  }

  const remaining = limit - spent;
  const utilization = (spent / limit) * 100;

  let status = 'normal';
  if (utilization > 100) {
    status = 'exceeded';
  } else if (utilization >= 80) {
    status = 'warning';
  }

  return {
    budgetLimit: limit,
    spent,
    remaining,
    utilization,
    status,
  };
}

function renderBudgetBanner(budgetStatus, activeMonth) {
  const banner = document.getElementById('budget-alert-banner');
  if (!banner) return;

  const monthLabel = formatMonthLabel(activeMonth);

  if (budgetStatus.status === 'exceeded') {
    const excess = Math.abs(budgetStatus.remaining);
    banner.className = 'alert-banner alert-banner-danger';
    banner.innerHTML = `
      <i data-lucide="alert-octagon"></i>
      <div>
        <strong>Budget Exceeded (${escapeHtml(monthLabel)}):</strong>
        Monthly expenses of <span class="tabular-nums">${formatCurrency(budgetStatus.spent)}</span>
        have exceeded your <span class="tabular-nums">${formatCurrency(budgetStatus.budgetLimit)}</span>
        budget by <strong class="tabular-nums">${formatCurrency(excess)}</strong>
        (<span class="tabular-nums">${budgetStatus.utilization.toFixed(1)}%</span> utilized).
      </div>
    `;
    return;
  }

  if (budgetStatus.status === 'warning') {
    banner.className = 'alert-banner alert-banner-warning';
    banner.innerHTML = `
      <i data-lucide="alert-triangle"></i>
      <div>
        <strong>Budget Warning (${escapeHtml(monthLabel)}):</strong>
        You have reached <strong class="tabular-nums">${budgetStatus.utilization.toFixed(1)}%</strong>
        of your monthly budget. <span class="tabular-nums">${formatCurrency(budgetStatus.remaining)}</span> remaining.
      </div>
    `;
    return;
  }

  banner.className = 'alert-banner is-hidden';
  banner.innerHTML = '';
}

function renderCategoryDrivers(transactions, activeMonth, budgetLimit) {
  const container = document.getElementById('budget-category-drivers');
  if (!container) return;

  const breakdown = getCategoryBreakdown(transactions, 'expense', activeMonth);
  if (breakdown.length === 0) {
    container.innerHTML = '<p class="kpi-sub">No expenses recorded for this month yet.</p>';
    return;
  }

  container.innerHTML = breakdown
    .slice(0, 5)
    .map((item) => {
      const budgetShare =
        budgetLimit > 0 ? ((item.total / budgetLimit) * 100).toFixed(1) : item.percentage.toFixed(1);
      const shareLabel = budgetLimit > 0 ? `${budgetShare}% of budget` : `${budgetShare}% of spend`;

      return `
        <div class="driver-row">
          <div class="driver-meta">
            <span class="legend-swatch" style="background-color: ${escapeHtml(item.color)};"></span>
            <span>${escapeHtml(item.category)}</span>
          </div>
          <div class="category-legend-meta tabular-nums">
            <span class="category-legend-pct">${escapeHtml(shareLabel)}</span>
            <span class="category-legend-val">${formatCurrency(item.total)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

export function renderBudgetView({ transactions, activeMonth, budgetLimit, onRefreshIcons }) {
  const monthly = calculateMonthlyMetrics(transactions, activeMonth);
  const budgetStatus = calculateBudgetStatus(monthly.monthlyExpenses, budgetLimit);
  const monthLabel = formatMonthLabel(activeMonth);

  const trackerSub = document.getElementById('budget-tracker-subtitle');
  const formMonthLabel = document.getElementById('budget-form-month-label');
  const statusText = document.getElementById('budget-status-text');
  const limitDisplay = document.getElementById('budget-limit-display');
  const spentDisplay = document.getElementById('budget-spent-display');
  const remainingDisplay = document.getElementById('budget-remaining-display');
  const utilDisplay = document.getElementById('budget-utilization-display');
  const progressBar = document.getElementById('budget-progressbar');
  const progressFill = document.getElementById('budget-progress-fill');
  const progressCaption = document.getElementById('budget-progress-caption');
  const limitInput = document.getElementById('budget-limit-input');

  if (trackerSub) trackerSub.textContent = monthLabel;
  if (formMonthLabel) formMonthLabel.textContent = monthLabel;

  if (limitDisplay) {
    limitDisplay.textContent =
      budgetStatus.status === 'unset' ? 'Not set' : formatCurrency(budgetStatus.budgetLimit);
  }
  if (spentDisplay) spentDisplay.textContent = formatCurrency(budgetStatus.spent);

  if (remainingDisplay) {
    if (budgetStatus.status === 'unset') {
      remainingDisplay.textContent = '—';
      remainingDisplay.className = 'metric-figure tabular-nums';
    } else if (budgetStatus.remaining < 0) {
      remainingDisplay.textContent = `−${formatCurrency(Math.abs(budgetStatus.remaining))}`;
      remainingDisplay.className = 'metric-figure tabular-nums text-expense';
    } else {
      remainingDisplay.textContent = formatCurrency(budgetStatus.remaining);
      remainingDisplay.className = 'metric-figure tabular-nums text-income';
    }
  }

  if (utilDisplay) {
    utilDisplay.textContent =
      budgetStatus.status === 'unset' ? '0.0%' : `${budgetStatus.utilization.toFixed(1)}%`;
    utilDisplay.className = 'metric-figure tabular-nums';
    if (budgetStatus.status === 'exceeded') utilDisplay.classList.add('text-expense');
    if (budgetStatus.status === 'warning') utilDisplay.classList.add('text-warning');
  }

  if (statusText) {
    statusText.className = 'status-label';
    if (budgetStatus.status === 'unset') {
      statusText.textContent = 'No Budget Set';
    } else if (budgetStatus.status === 'exceeded') {
      statusText.textContent = 'Over Budget';
      statusText.classList.add('text-expense');
    } else if (budgetStatus.status === 'warning') {
      statusText.textContent = '80% Warning';
      statusText.classList.add('text-warning');
    } else {
      statusText.textContent = 'On Track';
      statusText.classList.add('text-income');
    }
  }

  if (progressFill && progressBar && progressCaption) {
    const clampedPct = Math.min(budgetStatus.utilization, 100);
    progressFill.style.width = `${clampedPct.toFixed(1)}%`;
    progressFill.className = 'progress-fill';
    if (budgetStatus.status === 'exceeded') progressFill.classList.add('is-exceeded');
    else if (budgetStatus.status === 'warning') progressFill.classList.add('is-warning');

    progressBar.setAttribute('aria-valuenow', clampedPct.toFixed(0));
    progressCaption.textContent =
      budgetStatus.status === 'unset'
        ? 'Set a monthly budget to track utilization'
        : `${budgetStatus.utilization.toFixed(1)}% used`;
  }

  if (limitInput && document.activeElement !== limitInput) {
    limitInput.value = budgetLimit > 0 ? String(budgetLimit) : '';
  }

  renderBudgetBanner(budgetStatus, activeMonth);
  renderCategoryDrivers(transactions, activeMonth, budgetLimit);

  if (onRefreshIcons) onRefreshIcons();
}

export function initBudgetUI({ getActiveMonth, onBudgetSaved, onShowToast }) {
  const form = document.getElementById('budget-form');
  const limitInput = document.getElementById('budget-limit-input');
  const limitError = document.getElementById('budget-limit-error');
  const applyDefaultCheckbox = document.getElementById('budget-apply-default');

  document.querySelectorAll('[data-budget-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (limitInput) {
        limitInput.value = btn.dataset.budgetPreset;
        limitInput.classList.remove('is-invalid');
      }
      if (limitError) limitError.textContent = '';
    });
  });

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!limitInput) return;

      const value = Number(limitInput.value);
      if (!limitInput.value || !Number.isFinite(value) || value <= 0) {
        limitInput.classList.add('is-invalid');
        if (limitError) limitError.textContent = 'Please enter a valid monthly budget greater than $0.';
        return;
      }

      limitInput.classList.remove('is-invalid');
      if (limitError) limitError.textContent = '';

      const applyDefault = applyDefaultCheckbox ? applyDefaultCheckbox.checked : true;
      const activeMonth = getActiveMonth();
      try {
        await saveBudget(activeMonth, value, applyDefault);
        onShowToast(`Monthly budget saved (${formatCurrency(value)}).`);
        onBudgetSaved();
      } catch (err) {
        onShowToast(err.message || 'Failed to save budget.', 'danger');
      }
    });
  }
}
