import {
  formatCurrency,
  formatMonthLabel,
  escapeHtml,
  buildTransactionRowHtml,
  CATEGORY_COLORS,
} from './transactions.js';

let monthlyChartInstance = null;
let categoryChartInstance = null;

export function shiftMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function calculateTotals(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;

  transactions.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpenses += tx.amount;
    }
  });

  return {
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
  };
}

export function calculateMonthlyMetrics(transactions, monthKey) {
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let monthlyIncomeCount = 0;
  let monthlyExpenseCount = 0;

  transactions.forEach((tx) => {
    if (!tx.date.startsWith(monthKey)) return;
    if (tx.type === 'income') {
      monthlyIncome += tx.amount;
      monthlyIncomeCount += 1;
    } else if (tx.type === 'expense') {
      monthlyExpenses += tx.amount;
      monthlyExpenseCount += 1;
    }
  });

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlySavings: monthlyIncome - monthlyExpenses,
    monthlyIncomeCount,
    monthlyExpenseCount,
  };
}

export function getRecentTransactions(transactions, limit = 6) {
  return [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function getCategoryBreakdown(transactions, type = 'expense', monthKey = null) {
  const map = new Map();
  let grandTotal = 0;

  transactions.forEach((tx) => {
    if (tx.type !== type) return;
    if (monthKey && !tx.date.startsWith(monthKey)) return;

    const current = map.get(tx.category) || { category: tx.category, total: 0, count: 0 };
    current.total += tx.amount;
    current.count += 1;
    map.set(tx.category, current);
    grandTotal += tx.amount;
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      percentage: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
      color: CATEGORY_COLORS[item.category] || '#64748B',
    }))
    .sort((a, b) => b.total - a.total);
}

export function getMonthlySeries(transactions, monthsCount = 6, referenceMonthKey) {
  const keys = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    keys.push(shiftMonthKey(referenceMonthKey, -i));
  }

  return keys.map((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });

    const metrics = calculateMonthlyMetrics(transactions, monthKey);
    return {
      monthKey,
      label,
      income: metrics.monthlyIncome,
      expense: metrics.monthlyExpenses,
      net: metrics.monthlySavings,
    };
  });
}

function renderBudgetStrip({ budgetStatus, activeMonth, onNavigateBudget }) {
  const strip = document.getElementById('dashboard-budget-strip');
  if (!strip) return;

  const monthName = formatMonthLabel(activeMonth);

  if (budgetStatus.status === 'unset') {
    strip.innerHTML = `
      <div class="budget-strip-main">
        <div class="budget-strip-top">
          <span class="budget-strip-title">
            <i data-lucide="wallet"></i>
            <span>Monthly Budget · ${escapeHtml(monthName)}</span>
          </span>
          <span class="budget-strip-stats">No monthly budget set yet</span>
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="dash-manage-budget-btn">
        Set Monthly Budget
      </button>
    `;
  } else {
    const clampedPct = Math.min(budgetStatus.utilization, 100);
    let fillClass = '';
    let statusIcon = 'check-circle-2';
    let statusText = `${budgetStatus.utilization.toFixed(1)}% used`;
    let textClass = '';

    if (budgetStatus.status === 'exceeded') {
      fillClass = 'is-exceeded';
      statusIcon = 'alert-octagon';
      textClass = 'text-expense';
      statusText = `Budget exceeded (${budgetStatus.utilization.toFixed(1)}%)`;
    } else if (budgetStatus.status === 'warning') {
      fillClass = 'is-warning';
      statusIcon = 'alert-triangle';
      textClass = 'text-warning';
      statusText = `Approaching limit (${budgetStatus.utilization.toFixed(1)}%)`;
    }

    const remainingText =
      budgetStatus.remaining >= 0
        ? `${formatCurrency(budgetStatus.remaining)} remaining of ${formatCurrency(budgetStatus.budgetLimit)}`
        : `${formatCurrency(Math.abs(budgetStatus.remaining))} over ${formatCurrency(budgetStatus.budgetLimit)} limit`;

    strip.innerHTML = `
      <div class="budget-strip-main">
        <div class="budget-strip-top">
          <span class="budget-strip-title ${textClass}">
            <i data-lucide="${statusIcon}"></i>
            <span>Monthly Budget · ${escapeHtml(statusText)}</span>
          </span>
          <span class="budget-strip-stats tabular-nums">${escapeHtml(remainingText)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width: ${clampedPct.toFixed(1)}%;"></div>
          <div class="progress-marker" title="80% warning threshold"></div>
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="dash-manage-budget-btn">
        Manage Budget
      </button>
    `;
  }

  const manageBtn = document.getElementById('dash-manage-budget-btn');
  if (manageBtn) {
    manageBtn.addEventListener('click', onNavigateBudget);
  }
}

function renderMonthlyOverviewChart(series) {
  const wrap = document.getElementById('dashboard-monthly-chart-wrap');
  const empty = document.getElementById('dashboard-monthly-empty');
  const canvas = document.getElementById('dashboard-monthly-chart');
  if (!canvas || !wrap || !empty) return;

  const hasAnyData = series.some((item) => item.income > 0 || item.expense > 0);
  if (!hasAnyData) {
    wrap.classList.add('is-hidden');
    empty.classList.remove('is-hidden');
    if (monthlyChartInstance) {
      monthlyChartInstance.destroy();
      monthlyChartInstance = null;
    }
    return;
  }

  wrap.classList.remove('is-hidden');
  empty.classList.add('is-hidden');

  if (typeof window.Chart !== 'function') return;

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  monthlyChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Income',
          data: series.map((s) => s.income),
          backgroundColor: '#16A34A',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.map((s) => s.expense),
          backgroundColor: '#2563EB',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: 'DM Sans', size: 12 },
          },
        },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748B', font: { family: 'DM Sans', size: 11 } },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#E2E8F0' },
          ticks: {
            color: '#64748B',
            font: { family: 'JetBrains Mono', size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
      },
    },
  });
}

function renderCategoryBreakdownChart(breakdown) {
  const content = document.getElementById('dashboard-category-content');
  const empty = document.getElementById('dashboard-category-empty');
  const canvas = document.getElementById('dashboard-category-chart');
  const listEl = document.getElementById('dashboard-category-list');
  if (!content || !empty || !canvas || !listEl) return;

  if (breakdown.length === 0) {
    content.classList.add('is-hidden');
    empty.classList.remove('is-hidden');
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
      categoryChartInstance = null;
    }
    listEl.innerHTML = '';
    return;
  }

  content.classList.remove('is-hidden');
  empty.classList.add('is-hidden');

  const topItems = breakdown.slice(0, 6);
  listEl.innerHTML = topItems
    .map(
      (item) => `
      <li class="category-legend-item">
        <span class="category-legend-name">
          <span class="legend-swatch" style="background-color: ${escapeHtml(item.color)};"></span>
          <span>${escapeHtml(item.category)}</span>
        </span>
        <span class="category-legend-meta tabular-nums">
          <span class="category-legend-pct">${item.percentage.toFixed(1)}%</span>
          <span class="category-legend-val">${formatCurrency(item.total)}</span>
        </span>
      </li>
    `
    )
    .join('');

  if (typeof window.Chart !== 'function') return;

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  categoryChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: breakdown.map((item) => item.category),
      datasets: [
        {
          data: breakdown.map((item) => item.total),
          backgroundColor: breakdown.map((item) => item.color),
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const item = breakdown[ctx.dataIndex];
              return `${item.category}: ${formatCurrency(item.total)} (${item.percentage.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderRecentTransactionsTable(transactions, callbacks) {
  const tbody = document.getElementById('dashboard-recent-tbody');
  const wrap = document.getElementById('dashboard-recent-table-wrap');
  const empty = document.getElementById('dashboard-recent-empty');
  if (!tbody || !wrap || !empty) return;

  const recent = getRecentTransactions(transactions, 6);

  if (recent.length === 0) {
    wrap.classList.add('is-hidden');
    empty.classList.remove('is-hidden');
    tbody.innerHTML = '';
    return;
  }

  wrap.classList.remove('is-hidden');
  empty.classList.add('is-hidden');
  tbody.innerHTML = recent.map(buildTransactionRowHtml).join('');

  tbody.onclick = (event) => {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;
    const id = actionBtn.dataset.id;
    const tx = transactions.find((item) => item.id === id);
    if (!tx) return;

    if (actionBtn.dataset.action === 'edit') {
      callbacks.onEditTransaction(tx);
    } else if (actionBtn.dataset.action === 'delete') {
      callbacks.onDeleteTransaction(tx);
    }
  };
}

export function renderDashboardView({
  transactions,
  activeMonth,
  budgetStatus,
  callbacks,
}) {
  const totals = calculateTotals(transactions);
  const monthly = calculateMonthlyMetrics(transactions, activeMonth);
  const categoryBreakdown = getCategoryBreakdown(transactions, 'expense', activeMonth);
  const monthlySeries = getMonthlySeries(transactions, 6, activeMonth);

  const balanceEl = document.getElementById('kpi-total-balance');
  const balanceSubEl = document.getElementById('kpi-balance-sub');
  const incomeEl = document.getElementById('kpi-total-income');
  const incomeSubEl = document.getElementById('kpi-income-sub');
  const expensesEl = document.getElementById('kpi-total-expenses');
  const expensesSubEl = document.getElementById('kpi-expenses-sub');
  const monthlyEl = document.getElementById('kpi-monthly-spending');
  const monthlySubEl = document.getElementById('kpi-monthly-sub');
  const categorySubEl = document.getElementById('dashboard-category-subtitle');

  if (balanceEl) {
    const prefix = totals.totalBalance < 0 ? '−' : '';
    balanceEl.textContent = `${prefix}${formatCurrency(Math.abs(totals.totalBalance))}`;
    balanceEl.classList.toggle('text-expense', totals.totalBalance < 0);
  }
  if (balanceSubEl) {
    balanceSubEl.textContent = `Across ${transactions.length} recorded transaction${transactions.length === 1 ? '' : 's'}`;
  }

  if (incomeEl) incomeEl.textContent = formatCurrency(totals.totalIncome);
  if (incomeSubEl) {
    incomeSubEl.textContent = `${formatCurrency(monthly.monthlyIncome)} in ${formatMonthLabel(activeMonth)}`;
  }

  if (expensesEl) expensesEl.textContent = formatCurrency(totals.totalExpenses);
  if (expensesSubEl) {
    const totalOutflows = transactions.filter((t) => t.type === 'expense').length;
    expensesSubEl.textContent = `${totalOutflows} expense transaction${totalOutflows === 1 ? '' : 's'}`;
  }

  if (monthlyEl) monthlyEl.textContent = formatCurrency(monthly.monthlyExpenses);
  if (monthlySubEl) {
    if (budgetStatus.status === 'unset') {
      monthlySubEl.textContent = `${monthly.monthlyExpenseCount} entries · No budget set`;
    } else {
      monthlySubEl.textContent = `${budgetStatus.utilization.toFixed(1)}% of ${formatCurrency(budgetStatus.budgetLimit)} budget`;
    }
  }

  if (categorySubEl) {
    categorySubEl.textContent = formatMonthLabel(activeMonth);
  }

  renderBudgetStrip({
    budgetStatus,
    activeMonth,
    onNavigateBudget: callbacks.onNavigateBudget,
  });
  renderMonthlyOverviewChart(monthlySeries);
  renderCategoryBreakdownChart(categoryBreakdown);
  renderRecentTransactionsTable(transactions, callbacks);

  callbacks.onRefreshIcons();
}
