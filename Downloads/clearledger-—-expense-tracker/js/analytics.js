import {
  formatCurrency,
  formatMonthLabel,
  escapeHtml,
} from './transactions.js';
import {
  calculateTotals,
  getCategoryBreakdown,
  getMonthlySeries,
  shiftMonthKey,
} from './dashboard.js';

let analyticsScope = 'month';
let incomeExpenseChart = null;
let distributionChart = null;

function filterTransactionsByScope(transactions, activeMonth, scope) {
  if (scope === 'all') {
    return transactions;
  }
  if (scope === '6months') {
    const validMonths = new Set();
    for (let i = 0; i < 6; i += 1) {
      validMonths.add(shiftMonthKey(activeMonth, -i));
    }
    return transactions.filter((tx) => validMonths.has(tx.date.slice(0, 7)));
  }
  return transactions.filter((tx) => tx.date.startsWith(activeMonth));
}

export function computeAnalytics(transactions, activeMonth, scope = 'month') {
  const scopedTransactions = filterTransactionsByScope(transactions, activeMonth, scope);
  const totals = calculateTotals(scopedTransactions);
  const incomeEntries = scopedTransactions.filter((t) => t.type === 'income');
  const expenseEntries = scopedTransactions.filter((t) => t.type === 'expense');

  const categoryBreakdown = getCategoryBreakdown(scopedTransactions, 'expense', null);
  const highestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
  const totalSavings = totals.totalIncome - totals.totalExpenses;
  const savingsRate =
    totals.totalIncome > 0 ? (totalSavings / totals.totalIncome) * 100 : 0;
  const averageExpense =
    expenseEntries.length > 0 ? totals.totalExpenses / expenseEntries.length : 0;
  const monthlySeries = getMonthlySeries(transactions, 6, activeMonth);

  return {
    scope,
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    totalSavings,
    savingsRate,
    incomeCount: incomeEntries.length,
    expenseCount: expenseEntries.length,
    averageExpense,
    highestCategory,
    categoryBreakdown,
    monthlySeries,
  };
}

function renderIncomeVsExpenseChart(series) {
  const wrap = document.getElementById('analytics-ie-chart-wrap');
  const empty = document.getElementById('analytics-ie-empty');
  const canvas = document.getElementById('analytics-income-expense-chart');
  if (!wrap || !empty || !canvas) return;

  const hasData = series.some((s) => s.income > 0 || s.expense > 0);
  if (!hasData) {
    wrap.classList.add('is-hidden');
    empty.classList.remove('is-hidden');
    if (incomeExpenseChart) {
      incomeExpenseChart.destroy();
      incomeExpenseChart = null;
    }
    return;
  }

  wrap.classList.remove('is-hidden');
  empty.classList.add('is-hidden');

  if (typeof window.Chart !== 'function') return;
  if (incomeExpenseChart) incomeExpenseChart.destroy();

  incomeExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Income',
          data: series.map((s) => s.income),
          backgroundColor: '#16A34A',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.map((s) => s.expense),
          backgroundColor: '#DC2626',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
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

function renderDistributionChart(breakdown) {
  const wrap = document.getElementById('analytics-dist-chart-wrap');
  const empty = document.getElementById('analytics-dist-empty');
  const canvas = document.getElementById('analytics-distribution-chart');
  if (!wrap || !empty || !canvas) return;

  if (breakdown.length === 0) {
    wrap.classList.add('is-hidden');
    empty.classList.remove('is-hidden');
    if (distributionChart) {
      distributionChart.destroy();
      distributionChart = null;
    }
    return;
  }

  wrap.classList.remove('is-hidden');
  empty.classList.add('is-hidden');

  if (typeof window.Chart !== 'function') return;
  if (distributionChart) distributionChart.destroy();

  distributionChart = new window.Chart(canvas.getContext('2d'), {
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
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            color: '#475569',
            font: { family: 'DM Sans', size: 12 },
          },
        },
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

function renderCategoryTable(breakdown) {
  const wrap = document.getElementById('analytics-category-table-wrap');
  const empty = document.getElementById('analytics-category-empty');
  const tbody = document.getElementById('analytics-category-tbody');
  if (!wrap || !empty || !tbody) return;

  if (breakdown.length === 0) {
    wrap.classList.add('is-hidden');
    empty.classList.remove('is-hidden');
    tbody.innerHTML = '';
    return;
  }

  wrap.classList.remove('is-hidden');
  empty.classList.add('is-hidden');

  tbody.innerHTML = breakdown
    .map(
      (item) => `
      <tr>
        <td>
          <span class="category-legend-name">
            <span class="legend-swatch" style="background-color: ${escapeHtml(item.color)};"></span>
            <span>${escapeHtml(item.category)}</span>
          </span>
        </td>
        <td class="text-right tabular-nums">${item.count}</td>
        <td>
          <div class="share-bar-track">
            <div
              class="share-bar-fill"
              style="width: ${Math.max(item.percentage, 2).toFixed(1)}%; background-color: ${escapeHtml(item.color)};"
            ></div>
          </div>
        </td>
        <td class="text-right tabular-nums">${item.percentage.toFixed(1)}%</td>
        <td class="text-right tabular-nums tx-amount">${formatCurrency(item.total)}</td>
      </tr>
    `
    )
    .join('');
}

export function renderAnalyticsView(transactions, activeMonth) {
  const analytics = computeAnalytics(transactions, activeMonth, analyticsScope);

  const savingsEl = document.getElementById('analytics-savings');
  const savingsRateEl = document.getElementById('analytics-savings-rate');
  const topCatEl = document.getElementById('analytics-top-category');
  const topCatSubEl = document.getElementById('analytics-top-category-sub');
  const incomeEl = document.getElementById('analytics-income');
  const incomeCountEl = document.getElementById('analytics-income-count');
  const expensesEl = document.getElementById('analytics-expenses');
  const avgExpenseEl = document.getElementById('analytics-avg-expense');
  const distSubtitleEl = document.getElementById('analytics-dist-subtitle');

  if (savingsEl) {
    const prefix = analytics.totalSavings < 0 ? '−' : '';
    savingsEl.textContent = `${prefix}${formatCurrency(Math.abs(analytics.totalSavings))}`;
    savingsEl.classList.toggle('text-expense', analytics.totalSavings < 0);
    savingsEl.classList.toggle('text-income', analytics.totalSavings > 0);
  }
  if (savingsRateEl) {
    savingsRateEl.textContent =
      analytics.totalIncome > 0
        ? `${analytics.savingsRate.toFixed(1)}% savings rate`
        : 'No income in selected scope';
  }

  if (topCatEl && topCatSubEl) {
    if (analytics.highestCategory) {
      topCatEl.textContent = analytics.highestCategory.category;
      topCatSubEl.textContent = `${formatCurrency(analytics.highestCategory.total)} · ${analytics.highestCategory.percentage.toFixed(1)}% of spending`;
    } else {
      topCatEl.textContent = '—';
      topCatSubEl.textContent = 'No expenses recorded';
    }
  }

  if (incomeEl) incomeEl.textContent = formatCurrency(analytics.totalIncome);
  if (incomeCountEl) {
    incomeCountEl.textContent = `${analytics.incomeCount} income entr${analytics.incomeCount === 1 ? 'y' : 'ies'}`;
  }

  if (expensesEl) expensesEl.textContent = formatCurrency(analytics.totalExpenses);
  if (avgExpenseEl) {
    avgExpenseEl.textContent = `${formatCurrency(analytics.averageExpense)} avg across ${analytics.expenseCount} entries`;
  }

  if (distSubtitleEl) {
    if (analyticsScope === 'month') {
      distSubtitleEl.textContent = `${formatMonthLabel(activeMonth)} expense distribution`;
    } else if (analyticsScope === '6months') {
      distSubtitleEl.textContent = 'Last 6 months expense distribution';
    } else {
      distSubtitleEl.textContent = 'All-time expense distribution';
    }
  }

  renderIncomeVsExpenseChart(analytics.monthlySeries);
  renderDistributionChart(analytics.categoryBreakdown);
  renderCategoryTable(analytics.categoryBreakdown);
}

export function initAnalyticsUI(onScopeChanged) {
  const scopeGroup = document.getElementById('analytics-scope-filter');
  if (!scopeGroup) return;

  scopeGroup.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-scope]');
    if (!btn) return;
    analyticsScope = btn.dataset.scope;

    scopeGroup.querySelectorAll('[data-scope]').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.scope === analyticsScope);
    });

    onScopeChanged();
  });
}
