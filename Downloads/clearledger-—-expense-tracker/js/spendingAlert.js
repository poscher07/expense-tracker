/**
 * 90% Monthly Spending Limit Alert Module
 * Tracks current month spending vs. income and triggers warning alerts.
 */

import { formatCurrency, escapeHtml } from './transactions.js';

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function calculateCurrentMonthSpending(transactions) {
  const currentMonthKey = getCurrentMonthKey();
  let totalCredited = 0;
  let totalDebited = 0;

  transactions.forEach((tx) => {
    if (!tx.date || !tx.date.startsWith(currentMonthKey)) return;
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalCredited += amount;
    } else if (tx.type === 'expense') {
      totalDebited += amount;
    }
  });

  const hasIncome = totalCredited > 0;
  const percentage = hasIncome ? (totalDebited / totalCredited) * 100 : 0;
  const remaining = totalCredited - totalDebited;

  return {
    currentMonthKey,
    totalCredited,
    totalDebited,
    remaining,
    percentage,
    hasIncome,
  };
}

export function openSpendingAlertModal(spendingData) {
  const modal = document.getElementById('spending-alert-modal');
  const card = document.getElementById('spending-alert-card');
  const iconWrap = document.getElementById('spending-alert-icon');
  const titleEl = document.getElementById('spending-alert-title');
  const messageEl = document.getElementById('spending-alert-message');
  const progressFill = document.getElementById('spending-alert-progress-fill');
  const creditedEl = document.getElementById('spending-alert-credited');
  const spentEl = document.getElementById('spending-alert-spent');
  const remainingEl = document.getElementById('spending-alert-remaining');

  if (!modal) return;

  const isExceeded = spendingData.percentage >= 100;
  const pctDisplay = spendingData.percentage.toFixed(1);

  if (isExceeded) {
    if (card) {
      card.classList.remove('is-warning');
      card.classList.add('is-danger');
    }
    if (iconWrap) {
      iconWrap.className = 'spending-alert-icon is-danger';
      iconWrap.innerHTML = '<i data-lucide="alert-octagon"></i>';
    }
    if (titleEl) {
      titleEl.textContent = 'Critical Spending Alert';
    }
    if (messageEl) {
      const overAmount = formatCurrency(Math.abs(spendingData.remaining));
      messageEl.innerHTML = `<strong>Critical Alert:</strong> You have exceeded <strong>100%</strong> of your total money credited this month! You are currently over by <strong>${escapeHtml(overAmount)}</strong> (${pctDisplay}% spent).`;
    }
    if (progressFill) {
      progressFill.className = 'progress-fill is-exceeded';
      progressFill.style.width = '100%';
    }
  } else {
    if (card) {
      card.classList.remove('is-danger');
      card.classList.add('is-warning');
    }
    if (iconWrap) {
      iconWrap.className = 'spending-alert-icon';
      iconWrap.innerHTML = '<i data-lucide="alert-triangle"></i>';
    }
    if (titleEl) {
      titleEl.textContent = 'Spending Alert (90% Limit)';
    }
    if (messageEl) {
      messageEl.innerHTML = `Spending Alert: You have used <strong>${pctDisplay}%</strong> of your total money credited this month! Please review your expenses to avoid exceeding your income.`;
    }
    if (progressFill) {
      progressFill.className = 'progress-fill is-warning';
      progressFill.style.width = `${Math.min(spendingData.percentage, 100).toFixed(1)}%`;
    }
  }

  if (creditedEl) creditedEl.textContent = formatCurrency(spendingData.totalCredited);
  if (spentEl) spentEl.textContent = formatCurrency(spendingData.totalDebited);
  if (remainingEl) {
    if (spendingData.remaining < 0) {
      remainingEl.textContent = `−${formatCurrency(Math.abs(spendingData.remaining))}`;
      remainingEl.className = 'spending-stat-value text-expense tabular-nums';
    } else {
      remainingEl.textContent = formatCurrency(spendingData.remaining);
      remainingEl.className = 'spending-stat-value text-income tabular-nums';
    }
  }

  modal.classList.remove('is-hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

export function closeSpendingAlertModal() {
  const modal = document.getElementById('spending-alert-modal');
  if (modal) modal.classList.add('is-hidden');
}

/**
 * Checks if current month spending has crossed the 90% or 100% threshold.
 * Uses smart anti-spam keys in localStorage so each threshold triggers once per month.
 */
export function checkAndTriggerSpendingAlert(transactions) {
  const spending = calculateCurrentMonthSpending(transactions);

  // If no income recorded this month, do not trigger false alerts
  if (!spending.hasIncome) {
    return;
  }

  const monthKeySanitized = spending.currentMonthKey.replace('-', '_');
  const alert90Key = `alert_90_${monthKeySanitized}`;
  const alert100Key = `alert_100_${monthKeySanitized}`;

  if (spending.percentage >= 100) {
    const alreadyTriggered100 = window.localStorage.getItem(alert100Key);
    if (!alreadyTriggered100) {
      window.localStorage.setItem(alert100Key, 'true');
      window.localStorage.setItem(alert90Key, 'true'); // suppress 90% alert if jumping directly past 100%
      openSpendingAlertModal(spending);
    }
  } else if (spending.percentage >= 90) {
    const alreadyTriggered90 = window.localStorage.getItem(alert90Key);
    if (!alreadyTriggered90) {
      window.localStorage.setItem(alert90Key, 'true');
      openSpendingAlertModal(spending);
    }
  }
}

/**
 * Renders or updates the subtle visual warning banner on the Dashboard view.
 */
export function renderDashboardSpendingBanner(transactions, activeMonth) {
  const banner = document.getElementById('dashboard-spending-alert-banner');
  if (!banner) return;

  const currentMonthKey = getCurrentMonthKey();
  // Only show the active spending alert for the current calendar month
  if (activeMonth && activeMonth !== currentMonthKey) {
    banner.className = 'alert-banner is-hidden';
    banner.innerHTML = '';
    return;
  }

  const spending = calculateCurrentMonthSpending(transactions);
  if (!spending.hasIncome || spending.percentage < 90) {
    banner.className = 'alert-banner is-hidden';
    banner.innerHTML = '';
    return;
  }

  const pctDisplay = spending.percentage.toFixed(1);
  const spentFormatted = formatCurrency(spending.totalDebited);
  const creditedFormatted = formatCurrency(spending.totalCredited);

  if (spending.percentage >= 100) {
    const overAmount = formatCurrency(Math.abs(spending.remaining));
    banner.className = 'alert-banner alert-banner-danger';
    banner.innerHTML = `
      <i data-lucide="alert-octagon"></i>
      <div>
        <strong>Critical Income Spending Alert:</strong> You have exceeded 100% of your total money credited this month
        (${spentFormatted} spent of ${creditedFormatted} credited, <strong>${pctDisplay}%</strong>).
        Over limit by <strong class="tabular-nums">${escapeHtml(overAmount)}</strong>.
      </div>
    `;
  } else {
    const remainingFormatted = formatCurrency(spending.remaining);
    banner.className = 'alert-banner alert-banner-warning';
    banner.innerHTML = `
      <i data-lucide="alert-triangle"></i>
      <div>
        <strong>90% Monthly Spending Warning:</strong> You have spent <strong>${pctDisplay}%</strong> of your total money credited this month
        (${spentFormatted} spent of ${creditedFormatted} credited).
        Remaining balance: <strong class="tabular-nums">${escapeHtml(remainingFormatted)}</strong>.
      </div>
    `;
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

export function initSpendingAlertUI() {
  const modal = document.getElementById('spending-alert-modal');
  const closeBtn = document.getElementById('close-spending-alert-btn');
  const dismissBtn = document.getElementById('dismiss-spending-alert-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeSpendingAlertModal);
  if (dismissBtn) dismissBtn.addEventListener('click', closeSpendingAlertModal);

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeSpendingAlertModal();
      }
    });
  }
}
