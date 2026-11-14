/**
 * Centralized Persistence Layer (REST API Adapter)
 * Connected to Node.js + Express + SQLite backend.
 */

const API_BASE = '/api';

const STORAGE_KEYS = {
  TRANSACTIONS_BACKUP: 'clearledger_transactions_v1',
  BUDGET_BACKUP: 'clearledger_budget_v1',
  MIGRATED: 'clearledger_migrated_to_db_v1',
  ACTIVE_MONTH: 'clearledger_active_month_v1',
};

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function safeReadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function getActiveMonth() {
  const saved = window.localStorage.getItem(STORAGE_KEYS.ACTIVE_MONTH);
  if (saved && /^\d{4}-\d{2}$/.test(saved)) {
    return saved;
  }
  const current = getCurrentMonthKey();
  window.localStorage.setItem(STORAGE_KEYS.ACTIVE_MONTH, current);
  return current;
}

export function saveActiveMonth(monthKey) {
  if (/^\d{4}-\d{2}$/.test(monthKey)) {
    window.localStorage.setItem(STORAGE_KEYS.ACTIVE_MONTH, monthKey);
  }
}

/**
 * One-time migration: Import existing LocalStorage transactions & budgets into SQLite.
 * Leaves the original LocalStorage data as a backup.
 */
export async function migrateLocalStorageToApiIfNeeded() {
  const isMigrated = window.localStorage.getItem(STORAGE_KEYS.MIGRATED);
  if (isMigrated) {
    return { migrated: false, transactionCount: 0, budgetCount: 0 };
  }

  let transactionCount = 0;
  let budgetCount = 0;

  try {
    const existingRes = await fetch(`${API_BASE}/transactions`);
    if (!existingRes.ok) {
      throw new Error(`Failed to check existing transactions: ${existingRes.statusText}`);
    }
    const existingJson = await existingRes.json();
    const dbHasTransactions = existingJson.success && Array.isArray(existingJson.data) && existingJson.data.length > 0;

    const rawTx = safeReadJson(STORAGE_KEYS.TRANSACTIONS_BACKUP, []);
    if (!dbHasTransactions && Array.isArray(rawTx) && rawTx.length > 0) {
      for (const tx of rawTx) {
        const payload = {
          title: String(tx.title || 'Untitled').trim(),
          amount: Number(tx.amount) || 0.01,
          category: String(tx.category || 'Other').trim(),
          type: tx.type === 'income' ? 'income' : 'expense',
          date: String(tx.date || new Date().toISOString().slice(0, 10)).trim(),
          description: tx.description ? String(tx.description).trim() : ''
        };
        const postRes = await fetch(`${API_BASE}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (postRes.ok) {
          transactionCount += 1;
        }
      }
    }

    const rawBudget = safeReadJson(STORAGE_KEYS.BUDGET_BACKUP, null);
    if (rawBudget && typeof rawBudget === 'object') {
      const overrides = rawBudget.monthlyOverrides || {};
      for (const [monthKey, amount] of Object.entries(overrides)) {
        if (/^\d{4}-\d{2}$/.test(monthKey) && Number(amount) > 0) {
          const [year, month] = monthKey.split('-').map(Number);
          const postRes = await fetch(`${API_BASE}/budgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, month, amount: Number(amount) })
          });
          if (postRes.ok) {
            budgetCount += 1;
          }
        }
      }
    }

    window.localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
    return { migrated: true, transactionCount, budgetCount };
  } catch (err) {
    console.warn('Migration encountered an issue (will retry on next load):', err);
    return { migrated: false, transactionCount, budgetCount, error: err.message };
  }
}

/**
 * Fetch all transactions from the REST API (newest first).
 */
export async function getTransactions() {
  const response = await fetch(`${API_BASE}/transactions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions (${response.status})`);
  }
  const json = await response.json();
  const list = json.data || [];
  return list.map((item) => ({
    id: String(item.id),
    title: String(item.title || ''),
    amount: Number(item.amount) || 0,
    category: String(item.category || 'Other'),
    type: item.type === 'income' ? 'income' : 'expense',
    date: String(item.date || ''),
    description: String(item.description || ''),
  }));
}

/**
 * Create a new transaction via POST /api/transactions.
 */
export async function addTransaction(transactionInput) {
  const payload = {
    title: transactionInput.title.trim(),
    amount: Number(Number(transactionInput.amount).toFixed(2)),
    category: transactionInput.category,
    type: transactionInput.type === 'income' ? 'income' : 'expense',
    date: transactionInput.date,
    description: (transactionInput.description || '').trim(),
  };

  const response = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || `Failed to add transaction (${response.status})`);
  }

  const json = await response.json();
  const created = json.data;
  return {
    id: String(created.id),
    title: created.title,
    amount: Number(created.amount),
    category: created.category,
    type: created.type,
    date: created.date,
    description: created.description || '',
  };
}

/**
 * Update an existing transaction via PUT /api/transactions/:id.
 */
export async function updateTransaction(id, updatedFields) {
  const payload = {
    title: updatedFields.title.trim(),
    amount: Number(Number(updatedFields.amount).toFixed(2)),
    category: updatedFields.category,
    type: updatedFields.type === 'income' ? 'income' : 'expense',
    date: updatedFields.date,
    description: (updatedFields.description || '').trim(),
  };

  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || `Failed to update transaction (${response.status})`);
  }

  const json = await response.json();
  const updated = json.data;
  return {
    id: String(updated.id),
    title: updated.title,
    amount: Number(updated.amount),
    category: updated.category,
    type: updated.type,
    date: updated.date,
    description: updated.description || '',
  };
}

/**
 * Delete a transaction via DELETE /api/transactions/:id.
 */
export async function deleteTransaction(id) {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || `Failed to delete transaction (${response.status})`);
  }

  return true;
}

/**
 * Get monthly budget for year and month via GET /api/budgets/:year/:month.
 */
export async function getBudgetForMonth(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return 0;
  }
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  try {
    const response = await fetch(`${API_BASE}/budgets/${year}/${month}`);
    if (response.status === 404) {
      return 0;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch budget (${response.status})`);
    }
    const json = await response.json();
    return Number(json.data.amount) || 0;
  } catch (err) {
    console.warn(`Could not load budget for ${monthKey}:`, err);
    return 0;
  }
}

/**
 * Save monthly budget via POST or PUT /api/budgets.
 */
export async function saveBudget(monthKey, limitAmount) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error('Invalid month key.');
  }
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const cleanLimit = Number(Number(limitAmount).toFixed(2));

  // Check if a budget already exists for this month
  const checkRes = await fetch(`${API_BASE}/budgets/${year}/${month}`);
  if (checkRes.ok) {
    const checkJson = await checkRes.json();
    const existingId = checkJson.data.id;
    const putRes = await fetch(`${API_BASE}/budgets/${existingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: cleanLimit })
    });
    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to update budget (${putRes.status})`);
    }
    return cleanLimit;
  }

  // Create new budget entry
  const postRes = await fetch(`${API_BASE}/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year, month, amount: cleanLimit })
  });

  if (!postRes.ok) {
    const errJson = await postRes.json().catch(() => ({}));
    throw new Error(errJson.error || `Failed to save budget (${postRes.status})`);
  }

  return cleanLimit;
}

/**
 * Load sample transactions via API.
 */
export async function loadSampleTransactions(referenceMonthKey) {
  const [refYear, refMonth] = referenceMonthKey.split('-').map(Number);
  const monthOffset = (offset) => {
    const d = new Date(refYear, refMonth - 1 + offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const m0 = monthOffset(0);
  const m1 = monthOffset(-1);
  const m2 = monthOffset(-2);

  const samples = [
    { title: 'Monthly Salary', amount: 5200, category: 'Salary', type: 'income', date: `${m0}-01`, description: 'Primary monthly payroll' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m0}-02`, description: 'Monthly lease' },
    { title: 'Grocery Shopping', amount: 310.50, category: 'Food', type: 'expense', date: `${m0}-05`, description: 'Weekly groceries' },
    { title: 'Electric & Fiber Internet', amount: 165, category: 'Utilities', type: 'expense', date: `${m0}-07`, description: 'Monthly utilities' },
    { title: 'Freelance Design', amount: 850, category: 'Freelance', type: 'income', date: `${m0}-09`, description: 'Client project' },
    { title: 'Transit Pass', amount: 120, category: 'Transport', type: 'expense', date: `${m0}-10`, description: 'Commuter card' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m1}-02`, description: 'Prior month rent' },
    { title: 'Monthly Salary', amount: 5200, category: 'Salary', type: 'income', date: `${m1}-01`, description: 'Prior month payroll' },
    { title: 'Groceries', amount: 480, category: 'Food', type: 'expense', date: `${m1}-12`, description: 'Supermarket' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m2}-02`, description: 'Lease payment' }
  ];

  for (const s of samples) {
    await addTransaction(s);
  }

  await saveBudget(m0, 3500);
}

/**
 * Clear all records via API.
 */
export async function clearAllStoredData() {
  const allTx = await getTransactions();
  for (const tx of allTx) {
    await deleteTransaction(tx.id);
  }
}
