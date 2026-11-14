import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from './storage.js';
import { exportTransactionsToPdf } from './pdfReport.js';

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Gift',
  'Refund',
  'Other',
];

export const ALL_CATEGORIES = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
);

export const CATEGORY_COLORS = {
  Food: '#2563EB',
  Housing: '#0F172A',
  Transport: '#0EA5E9',
  Utilities: '#64748B',
  Healthcare: '#16A34A',
  Entertainment: '#D97706',
  Shopping: '#7C3AED',
  Education: '#0D9488',
  Salary: '#16A34A',
  Freelance: '#2563EB',
  Investments: '#0EA5E9',
  Gift: '#D97706',
  Refund: '#64748B',
  Other: '#94A3B8',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  const num = Number(value) || 0;
  return currencyFormatter.format(num);
}

export function formatDate(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString || '—';
  }
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return 'All Months';
  }
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateTransactionInput(input) {
  const errors = {};
  const title = (input.title || '').trim();
  const amount = Number(input.amount);
  const type = input.type;
  const category = (input.category || '').trim();
  const date = (input.date || '').trim();
  const description = (input.description || '').trim();

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (input.amount === '' || input.amount === null || input.amount === undefined) {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than $0.00.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds supported maximum.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Transaction type must be income or expense.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function filterAndSortTransactions(transactions, filters) {
  const search = (filters.search || '').trim().toLowerCase();
  const type = filters.type || 'all';
  const category = filters.category || 'all';
  const month = filters.month || 'all';
  const sortBy = filters.sortBy || 'date-desc';

  const filtered = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (month !== 'all' && !tx.date.startsWith(month)) return false;

    if (search) {
      const haystack = `${tx.title} ${tx.description} ${tx.category} ${tx.amount}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    return b.date.localeCompare(a.date);
  });
}

export function buildTransactionRowHtml(tx) {
  const isIncome = tx.type === 'income';
  const amountPrefix = isIncome ? '+' : '−';
  const amountClass = isIncome ? 'text-income' : 'text-expense';
  const typeLabel = isIncome ? 'Income' : 'Expense';
  const descHtml = tx.description
    ? `<span class="tx-desc-text" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</span>`
    : '';

  return `
    <tr data-tx-id="${escapeHtml(tx.id)}">
      <td>
        <div class="tx-title-cell">
          <span class="tx-title-text">${escapeHtml(tx.title)}</span>
          ${descHtml}
        </div>
      </td>
      <td>${escapeHtml(tx.category)}</td>
      <td class="tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
      <td><span class="tx-type-text ${amountClass}">${typeLabel}</span></td>
      <td class="text-right tabular-nums tx-amount ${amountClass}">${amountPrefix}${formatCurrency(tx.amount)}</td>
      <td class="text-right">
        <div class="row-actions">
          <button
            type="button"
            class="icon-btn"
            data-action="edit"
            data-id="${escapeHtml(tx.id)}"
            aria-label="Edit ${escapeHtml(tx.title)}"
            title="Edit transaction"
          >
            <i data-lucide="pencil"></i>
          </button>
          <button
            type="button"
            class="icon-btn icon-btn-danger"
            data-action="delete"
            data-id="${escapeHtml(tx.id)}"
            aria-label="Delete ${escapeHtml(tx.title)}"
            title="Delete transaction"
          >
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// UI State for Transaction History & Modal
const txFilterState = {
  search: '',
  type: 'all',
  category: 'all',
  month: 'all',
  sortBy: 'date-desc',
};

let callbacks = {
  getTransactions: () => [],
  getActiveMonth: () => '',
  onDataChanged: () => {},
  onRequestDelete: () => {},
  onShowToast: () => {},
  onRefreshIcons: () => {},
};

function populateFormCategories(type, selectedCategory = '') {
  const select = document.getElementById('tx-category-input');
  if (!select) return;
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a category';
  select.appendChild(placeholder);

  list.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  if (selectedCategory && list.includes(selectedCategory)) {
    select.value = selectedCategory;
  } else {
    select.value = list[0];
  }
}

function setFormType(type) {
  const typeInput = document.getElementById('tx-type-input');
  const toggleWrap = document.getElementById('tx-form-type-toggle');
  const categorySelect = document.getElementById('tx-category-input');
  if (!typeInput || !toggleWrap) return;

  typeInput.value = type;
  toggleWrap.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.formType === type);
  });

  const currentCat = categorySelect ? categorySelect.value : '';
  populateFormCategories(type, currentCat);
}

function clearFormErrors() {
  ['title', 'amount', 'category', 'date', 'description'].forEach((field) => {
    const input = document.getElementById(`tx-${field}-input`);
    const errorEl = document.getElementById(`tx-${field}-error`);
    if (input) input.classList.remove('is-invalid');
    if (errorEl) errorEl.textContent = '';
  });
}

function displayFormErrors(errors) {
  clearFormErrors();
  Object.entries(errors).forEach(([field, message]) => {
    const input = document.getElementById(`tx-${field}-input`);
    const errorEl = document.getElementById(`tx-${field}-error`);
    if (input) input.classList.add('is-invalid');
    if (errorEl) errorEl.textContent = message;
  });
}

export function openTransactionModal(transaction = null) {
  const modal = document.getElementById('transaction-modal');
  const modalTitle = document.getElementById('tx-modal-title');
  const idInput = document.getElementById('tx-id-input');
  const titleInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');
  const saveBtn = document.getElementById('save-tx-btn');

  if (!modal) return;
  clearFormErrors();

  if (transaction) {
    modalTitle.textContent = 'Edit Transaction';
    saveBtn.textContent = 'Update Transaction';
    idInput.value = transaction.id;
    setFormType(transaction.type);
    populateFormCategories(transaction.type, transaction.category);
    titleInput.value = transaction.title;
    amountInput.value = transaction.amount;
    dateInput.value = transaction.date;
    descInput.value = transaction.description || '';
  } else {
    modalTitle.textContent = 'Add Transaction';
    saveBtn.textContent = 'Save Transaction';
    idInput.value = '';
    setFormType('expense');
    populateFormCategories('expense');
    titleInput.value = '';
    amountInput.value = '';

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const activeMonth = callbacks.getActiveMonth();
    dateInput.value = todayStr.startsWith(activeMonth) ? todayStr : `${activeMonth}-15`;
    descInput.value = '';
  }

  modal.classList.remove('is-hidden');
  titleInput.focus();
}

export function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.classList.add('is-hidden');
  clearFormErrors();
}

function populateHistoryFilterOptions(transactions) {
  const catSelect = document.getElementById('tx-category-filter');
  const monthSelect = document.getElementById('tx-month-filter');

  if (catSelect) {
    const prevCat = txFilterState.category;
    const usedCategories = new Set([...ALL_CATEGORIES, ...transactions.map((t) => t.category)]);
    catSelect.innerHTML = '<option value="all">All Categories</option>';
    Array.from(usedCategories)
      .sort()
      .forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
      });
    catSelect.value = usedCategories.has(prevCat) ? prevCat : 'all';
  }

  if (monthSelect) {
    const prevMonth = txFilterState.month;
    const months = Array.from(
      new Set(transactions.map((t) => t.date.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))
    ).sort((a, b) => b.localeCompare(a));

    monthSelect.innerHTML = '<option value="all">All Months</option>';
    months.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = formatMonthLabel(m);
      monthSelect.appendChild(opt);
    });
    monthSelect.value = months.includes(prevMonth) ? prevMonth : 'all';
  }
}

function hasActiveFilters() {
  return (
    txFilterState.search.trim() !== '' ||
    txFilterState.type !== 'all' ||
    txFilterState.category !== 'all' ||
    txFilterState.month !== 'all' ||
    txFilterState.sortBy !== 'date-desc'
  );
}

export function resetHistoryFilters() {
  txFilterState.search = '';
  txFilterState.type = 'all';
  txFilterState.category = 'all';
  txFilterState.month = 'all';
  txFilterState.sortBy = 'date-desc';

  const searchInput = document.getElementById('tx-search-input');
  const catSelect = document.getElementById('tx-category-filter');
  const monthSelect = document.getElementById('tx-month-filter');
  const sortSelect = document.getElementById('tx-sort-select');
  const typeGroup = document.getElementById('tx-type-filter');

  if (searchInput) searchInput.value = '';
  if (catSelect) catSelect.value = 'all';
  if (monthSelect) monthSelect.value = 'all';
  if (sortSelect) sortSelect.value = 'date-desc';
  if (typeGroup) {
    typeGroup.querySelectorAll('[data-type]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.type === 'all');
    });
  }
}

let currentVisibleTransactions = [];

export function renderTransactionsView(transactions) {
  populateHistoryFilterOptions(transactions);

  const filtered = filterAndSortTransactions(transactions, txFilterState);
  currentVisibleTransactions = filtered;
  const tbody = document.getElementById('tx-table-tbody');
  const tableWrap = document.getElementById('tx-table-wrap');
  const emptyState = document.getElementById('tx-empty-state');
  const emptyMsg = document.getElementById('tx-empty-message');
  const emptyResetBtn = document.getElementById('tx-empty-reset-btn');
  const resetBtn = document.getElementById('tx-reset-filters-btn');
  const summaryBar = document.getElementById('tx-summary-bar');

  if (resetBtn) {
    resetBtn.classList.toggle('is-hidden', !hasActiveFilters());
  }

  const incomeTotal = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const expenseTotal = filtered
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netTotal = incomeTotal - expenseTotal;

  if (summaryBar) {
    summaryBar.innerHTML = `
      <span>Showing <strong>${filtered.length}</strong> of ${transactions.length} transactions</span>
      <div class="summary-strip-metrics tabular-nums">
        <span>Income: <strong class="text-income">${formatCurrency(incomeTotal)}</strong></span>
        <span>Expenses: <strong class="text-expense">${formatCurrency(expenseTotal)}</strong></span>
        <span>Net: <strong>${netTotal < 0 ? '−' : ''}${formatCurrency(Math.abs(netTotal))}</strong></span>
      </div>
    `;
  }

  if (filtered.length === 0) {
    if (tableWrap) tableWrap.classList.add('is-hidden');
    if (emptyState) emptyState.classList.remove('is-hidden');
    if (emptyMsg) {
      emptyMsg.textContent =
        transactions.length === 0
          ? 'No transactions recorded yet. Add your first income or expense entry.'
          : 'No transactions match your current search or filters.';
    }
    if (emptyResetBtn) {
      emptyResetBtn.classList.toggle('is-hidden', transactions.length === 0);
    }
    if (tbody) tbody.innerHTML = '';
    return;
  }

  if (tableWrap) tableWrap.classList.remove('is-hidden');
  if (emptyState) emptyState.classList.add('is-hidden');

  if (tbody) {
    tbody.innerHTML = filtered.map(buildTransactionRowHtml).join('');
  }

  callbacks.onRefreshIcons();
}

export function initTransactionsUI(appCallbacks) {
  callbacks = { ...callbacks, ...appCallbacks };

  const form = document.getElementById('transaction-form');
  const toggleWrap = document.getElementById('tx-form-type-toggle');
  const closeBtn = document.getElementById('close-tx-modal-btn');
  const cancelBtn = document.getElementById('cancel-tx-modal-btn');
  const modal = document.getElementById('transaction-modal');

  if (toggleWrap) {
    toggleWrap.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-form-type]');
      if (!btn) return;
      setFormType(btn.dataset.formType);
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeTransactionModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeTransactionModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeTransactionModal();
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const id = document.getElementById('tx-id-input').value;
      const payload = {
        title: document.getElementById('tx-title-input').value,
        amount: document.getElementById('tx-amount-input').value,
        type: document.getElementById('tx-type-input').value,
        category: document.getElementById('tx-category-input').value,
        date: document.getElementById('tx-date-input').value,
        description: document.getElementById('tx-description-input').value,
      };

      const validation = validateTransactionInput(payload);
      if (!validation.valid) {
        displayFormErrors(validation.errors);
        return;
      }

      try {
        if (id) {
          await updateTransaction(id, payload);
          callbacks.onShowToast('Transaction updated.');
        } else {
          await addTransaction(payload);
          callbacks.onShowToast('Transaction added.');
        }

        closeTransactionModal();
        callbacks.onDataChanged();
      } catch (err) {
        callbacks.onShowToast(err.message || 'Failed to save transaction', 'danger');
      }
    });
  }

  // Filter & Search Listeners
  const searchInput = document.getElementById('tx-search-input');
  const typeGroup = document.getElementById('tx-type-filter');
  const catSelect = document.getElementById('tx-category-filter');
  const monthSelect = document.getElementById('tx-month-filter');
  const sortSelect = document.getElementById('tx-sort-select');
  const resetBtn = document.getElementById('tx-reset-filters-btn');
  const emptyResetBtn = document.getElementById('tx-empty-reset-btn');
  const tbody = document.getElementById('tx-table-tbody');

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      txFilterState.search = event.target.value;
      renderTransactionsView(callbacks.getTransactions());
    });
  }

  if (typeGroup) {
    typeGroup.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-type]');
      if (!btn) return;
      txFilterState.type = btn.dataset.type;
      typeGroup.querySelectorAll('[data-type]').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.type === txFilterState.type);
      });
      renderTransactionsView(callbacks.getTransactions());
    });
  }

  if (catSelect) {
    catSelect.addEventListener('change', (event) => {
      txFilterState.category = event.target.value;
      renderTransactionsView(callbacks.getTransactions());
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener('change', (event) => {
      txFilterState.month = event.target.value;
      renderTransactionsView(callbacks.getTransactions());
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (event) => {
      txFilterState.sortBy = event.target.value;
      renderTransactionsView(callbacks.getTransactions());
    });
  }

  const handleReset = () => {
    resetHistoryFilters();
    renderTransactionsView(callbacks.getTransactions());
  };

  if (resetBtn) resetBtn.addEventListener('click', handleReset);
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', handleReset);

  const downloadPdfBtn = document.getElementById('download-pdf-btn');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      try {
        const transactionsToExport = currentVisibleTransactions.length > 0 
          ? currentVisibleTransactions 
          : callbacks.getTransactions();

        if (!transactionsToExport || transactionsToExport.length === 0) {
          callbacks.onShowToast('No transactions available to export.', 'warning');
          return;
        }

        const fileName = exportTransactionsToPdf(transactionsToExport, {
          search: txFilterState.search,
          type: txFilterState.type,
          category: txFilterState.category,
          month: txFilterState.month,
        });

        callbacks.onShowToast(`Report downloaded: ${fileName}`);
      } catch (err) {
        console.error('Failed to export PDF:', err);
        callbacks.onShowToast(err.message || 'Failed to generate PDF report.', 'danger');
      }
    });
  }

  if (tbody) {
    tbody.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('[data-action]');
      if (!actionBtn) return;
      const id = actionBtn.dataset.id;
      const tx = callbacks.getTransactions().find((item) => item.id === id);
      if (!tx) return;

      if (actionBtn.dataset.action === 'edit') {
        openTransactionModal(tx);
      } else if (actionBtn.dataset.action === 'delete') {
        callbacks.onRequestDelete(tx);
      }
    });
  }
}

export async function performDeleteTransaction(id) {
  return await deleteTransaction(id);
}
