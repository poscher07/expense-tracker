import {
  migrateLocalStorageToApiIfNeeded,
  getTransactions,
  getBudgetForMonth,
  getActiveMonth,
  saveActiveMonth,
  loadSampleTransactions,
  clearAllStoredData,
} from './storage.js';
import {
  initTransactionsUI,
  renderTransactionsView,
  openTransactionModal,
  closeTransactionModal,
  performDeleteTransaction,
  formatMonthLabel,
  escapeHtml,
} from './transactions.js';
import {
  renderDashboardView,
  calculateMonthlyMetrics,
  shiftMonthKey,
} from './dashboard.js';
import { initAnalyticsUI, renderAnalyticsView } from './analytics.js';
import {
  initBudgetUI,
  renderBudgetView,
  calculateBudgetStatus,
} from './budget.js';
import {
  initSpendingAlertUI,
  checkAndTriggerSpendingAlert,
  renderDashboardSpendingBanner,
  closeSpendingAlertModal,
} from './spendingAlert.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
};

const appState = {
  activeView: 'dashboard',
  activeMonth: getActiveMonth(),
  transactions: [],
  pendingConfirmAction: null,
};

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, variant = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (variant === 'warning') toast.classList.add('toast-warning');
  if (variant === 'danger') toast.classList.add('toast-danger');

  const iconName =
    variant === 'danger'
      ? 'alert-octagon'
      : variant === 'warning'
        ? 'alert-triangle'
        : 'check-circle-2';

  toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  refreshIcons();

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

function showGlobalError(message) {
  let banner = document.getElementById('global-api-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'global-api-error-banner';
    banner.className = 'alert-banner alert-banner-danger';
    const main = document.querySelector('.main-content');
    if (main) main.prepend(banner);
  }
  banner.classList.remove('is-hidden');
  banner.innerHTML = `<i data-lucide="alert-octagon"></i><div><strong>Connection Error:</strong> ${escapeHtml(message)}</div>`;
  refreshIcons();
}

function clearGlobalError() {
  const banner = document.getElementById('global-api-error-banner');
  if (banner) banner.classList.add('is-hidden');
}

function showLoadingState(isLoading) {
  const main = document.querySelector('.main-content');
  if (!main) return;
  let loader = document.getElementById('global-api-loading-state');
  if (isLoading && appState.transactions.length === 0) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'global-api-loading-state';
      loader.className = 'empty-state';
      loader.innerHTML = '<p>Loading financial records from database...</p>';
      main.prepend(loader);
    }
    loader.classList.remove('is-hidden');
  } else if (loader) {
    loader.classList.add('is-hidden');
  }
}

function closeSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-open');
}

function openSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-open');
}

function openConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-message');
  const acceptBtn = document.getElementById('accept-confirm-btn');

  if (!modal) return;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (acceptBtn) acceptBtn.textContent = confirmLabel;

  appState.pendingConfirmAction = onConfirm;
  modal.classList.remove('is-hidden');
  if (acceptBtn) acceptBtn.focus();
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.classList.add('is-hidden');
  appState.pendingConfirmAction = null;
}

function setActiveView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  appState.activeView = viewName;

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle('is-active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.toggle('is-active', section.id === `view-${viewName}`);
  });

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewName];

  closeSidebarMobile();
  renderCurrentView();
}

function syncMonthHeader() {
  const monthInput = document.getElementById('active-month-input');
  const monthLabel = document.getElementById('page-month-label');
  if (monthInput) monthInput.value = appState.activeMonth;
  if (monthLabel) monthLabel.textContent = formatMonthLabel(appState.activeMonth);
}

function setActiveMonth(newMonthKey) {
  if (!/^\d{4}-\d{2}$/.test(newMonthKey)) return;
  appState.activeMonth = newMonthKey;
  saveActiveMonth(newMonthKey);
  syncMonthHeader();
  renderCurrentView();
}

async function renderCurrentView() {
  clearGlobalError();
  showLoadingState(true);

  try {
    const [transactions, budgetLimit] = await Promise.all([
      getTransactions(),
      getBudgetForMonth(appState.activeMonth)
    ]);

    appState.transactions = transactions;
    const monthlyMetrics = calculateMonthlyMetrics(transactions, appState.activeMonth);
    const budgetStatus = calculateBudgetStatus(monthlyMetrics.monthlyExpenses, budgetLimit);

    if (appState.activeView === 'dashboard') {
      renderDashboardView({
        transactions,
        activeMonth: appState.activeMonth,
        budgetStatus,
        callbacks: {
          onEditTransaction: (tx) => openTransactionModal(tx),
          onDeleteTransaction: (tx) => requestDeleteTransaction(tx),
          onNavigateBudget: () => setActiveView('budget'),
          onRefreshIcons: refreshIcons,
        },
      });
      renderDashboardSpendingBanner(transactions, appState.activeMonth);
    } else if (appState.activeView === 'transactions') {
      renderTransactionsView(transactions);
    } else if (appState.activeView === 'analytics') {
      renderAnalyticsView(transactions, appState.activeMonth);
    } else if (appState.activeView === 'budget') {
      renderBudgetView({
        transactions,
        activeMonth: appState.activeMonth,
        budgetLimit,
        onRefreshIcons: refreshIcons,
      });
    }
  } catch (err) {
    console.error('Error fetching data from API:', err);
    showGlobalError(err.message || 'Cannot connect to backend server. Make sure the server is running.');
  } finally {
    showLoadingState(false);
    refreshIcons();
  }
}

async function handleDataChanged(meta) {
  await renderCurrentView();

  // Check 90% and 100% monthly spending limit alert (especially when expense added/edited)
  checkAndTriggerSpendingAlert(appState.transactions);

  try {
    const budgetLimit = await getBudgetForMonth(appState.activeMonth);
    const monthlyMetrics = calculateMonthlyMetrics(appState.transactions, appState.activeMonth);
    const budgetStatus = calculateBudgetStatus(monthlyMetrics.monthlyExpenses, budgetLimit);

    if (budgetStatus.status === 'exceeded') {
      showToast(
        `Alert: Monthly budget exceeded (${budgetStatus.utilization.toFixed(0)}%).`,
        'danger'
      );
    } else if (budgetStatus.status === 'warning') {
      showToast(
        `Warning: ${budgetStatus.utilization.toFixed(0)}% of monthly budget used.`,
        'warning'
      );
    }
  } catch {
    // Non-fatal if alert calculation fails
  }
}

function requestDeleteTransaction(tx) {
  openConfirmModal({
    title: 'Delete Transaction',
    message: `Are you sure you want to delete "${tx.title}"? This action cannot be undone.`,
    confirmLabel: 'Delete',
    onConfirm: async () => {
      try {
        await performDeleteTransaction(tx.id);
        showToast('Transaction deleted.');
        await renderCurrentView();
      } catch (err) {
        showToast(err.message || 'Failed to delete transaction.', 'danger');
      }
    },
  });
}

function bindGlobalNavigationAndEvents() {
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveView(btn.dataset.view);
    });
  });

  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setActiveView(link.dataset.navLink);
    });
  });

  const viewAllBtn = document.getElementById('view-all-transactions-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => setActiveView('transactions'));
  }

  const openAddBtn = document.getElementById('open-add-modal-btn');
  if (openAddBtn) {
    openAddBtn.addEventListener('click', () => openTransactionModal(null));
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-add]');
    if (trigger) {
      openTransactionModal(null);
    }
  });

  const monthInput = document.getElementById('active-month-input');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');

  if (monthInput) {
    monthInput.addEventListener('change', (event) => {
      if (event.target.value) setActiveMonth(event.target.value);
    });
  }
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      setActiveMonth(shiftMonthKey(appState.activeMonth, -1));
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      setActiveMonth(shiftMonthKey(appState.activeMonth, 1));
    });
  }

  // Mobile Sidebar
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const closeSidebarBtn = document.getElementById('close-sidebar-btn');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openSidebarMobile);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebarMobile);
  if (backdrop) backdrop.addEventListener('click', closeSidebarMobile);

  // Sample Data & Clear Data
  const seedBtn = document.getElementById('seed-demo-btn');
  const clearBtn = document.getElementById('clear-data-btn');

  if (seedBtn) {
    seedBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Load Sample Data',
        message:
          'This will add sample transactions and set a budget for the active month in your database.',
        confirmLabel: 'Load Sample Data',
        onConfirm: async () => {
          try {
            await loadSampleTransactions(appState.activeMonth);
            showToast('Sample transactions loaded.');
            await renderCurrentView();
          } catch (err) {
            showToast(err.message || 'Failed to load sample data.', 'danger');
          }
        },
      });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Clear All Data',
        message:
          'This will permanently delete all stored transactions from the database.',
        confirmLabel: 'Clear Everything',
        onConfirm: async () => {
          try {
            await clearAllStoredData();
            showToast('All stored data cleared.');
            await renderCurrentView();
          } catch (err) {
            showToast(err.message || 'Failed to clear data.', 'danger');
          }
        },
      });
    });
  }

  // Confirm Modal Actions
  const confirmModal = document.getElementById('confirm-modal');
  const closeConfirmBtn = document.getElementById('close-confirm-modal-btn');
  const cancelConfirmBtn = document.getElementById('cancel-confirm-btn');
  const acceptConfirmBtn = document.getElementById('accept-confirm-btn');

  if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', closeConfirmModal);
  if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', closeConfirmModal);
  if (confirmModal) {
    confirmModal.addEventListener('click', (event) => {
      if (event.target === confirmModal) closeConfirmModal();
    });
  }
  if (acceptConfirmBtn) {
    acceptConfirmBtn.addEventListener('click', () => {
      const action = appState.pendingConfirmAction;
      closeConfirmModal();
      if (typeof action === 'function') action();
    });
  }

  // Keyboard Escape handling
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTransactionModal();
      closeConfirmModal();
      closeSpendingAlertModal();
      closeSidebarMobile();
    }
  });
}

async function bootstrapApp() {
  appState.activeMonth = getActiveMonth();
  syncMonthHeader();

  initTransactionsUI({
    getTransactions: () => appState.transactions,
    getActiveMonth: () => appState.activeMonth,
    onDataChanged: handleDataChanged,
    onRequestDelete: requestDeleteTransaction,
    onShowToast: showToast,
    onRefreshIcons: refreshIcons,
  });

  initAnalyticsUI(() => {
    renderCurrentView();
  });

  initBudgetUI({
    getActiveMonth: () => appState.activeMonth,
    onBudgetSaved: () => renderCurrentView(),
    onShowToast: showToast,
  });

  initSpendingAlertUI();

  bindGlobalNavigationAndEvents();
  setActiveView('dashboard');

  try {
    const mig = await migrateLocalStorageToApiIfNeeded();
    if (mig.migrated && (mig.transactionCount > 0 || mig.budgetCount > 0)) {
      showToast(`Imported ${mig.transactionCount} transactions and ${mig.budgetCount} budgets into database.`);
      await renderCurrentView();
    }
  } catch (err) {
    console.warn('Migration error:', err);
  }
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
