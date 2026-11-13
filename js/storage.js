/**
 * Centralized Persistence Layer (LocalStorage Adapter)
 *
 * All data access passes through this module so that future migration
 * to a REST API (Node.js / Express.js / SQL) only requires replacing
 * the persistence calls inside these functions.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
  ACTIVE_MONTH: 'clearledger_active_month_v1',
};

const DEFAULT_BUDGET_CONFIG = {
  defaultLimit: 3500,
  monthlyOverrides: {},
};

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildSeedTransactions(referenceMonthKey) {
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
  const m3 = monthOffset(-3);
  const m4 = monthOffset(-4);
  const m5 = monthOffset(-5);

  return [
    {
      id: 'tx_seed_01',
      title: 'Monthly Product Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: `${m0}-01`,
      description: 'Primary monthly payroll deposit',
    },
    {
      id: 'tx_seed_02',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m0}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_03',
      title: 'Grocery Shopping',
      amount: 285.4,
      category: 'Food',
      type: 'expense',
      date: `${m0}-05`,
      description: 'Weekly groceries and pantry staples',
    },
    {
      id: 'tx_seed_04',
      title: 'Electric & Fiber Internet',
      amount: 164.8,
      category: 'Utilities',
      type: 'expense',
      date: `${m0}-07`,
      description: 'Monthly utility and broadband bill',
    },
    {
      id: 'tx_seed_05',
      title: 'Design Audit Retainer',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: `${m0}-09`,
      description: 'UX consultation invoice #204',
    },
    {
      id: 'tx_seed_06',
      title: 'Transit Pass & Fuel',
      amount: 142.5,
      category: 'Transport',
      type: 'expense',
      date: `${m0}-10`,
      description: 'Monthly commuter pass and fuel refill',
    },
    {
      id: 'tx_seed_07',
      title: 'Pharmacy & Dental Checkup',
      amount: 195,
      category: 'Healthcare',
      type: 'expense',
      date: `${m0}-11`,
      description: 'Routine dental cleaning and prescriptions',
    },
    {
      id: 'tx_seed_08',
      title: 'Neighborhood Bistro & Coffee',
      amount: 96.3,
      category: 'Food',
      type: 'expense',
      date: `${m0}-12`,
      description: 'Lunch meetings and coffee beans',
    },
    {
      id: 'tx_seed_09',
      title: 'Winter Coat & Workwear',
      amount: 210,
      category: 'Shopping',
      type: 'expense',
      date: `${m0}-13`,
      description: 'Seasonal apparel replacement',
    },
    // Prior month (-1)
    {
      id: 'tx_seed_10',
      title: 'Monthly Product Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: `${m1}-01`,
      description: 'Primary monthly payroll deposit',
    },
    {
      id: 'tx_seed_11',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m1}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_12',
      title: 'Fresh Market Groceries',
      amount: 495,
      category: 'Food',
      type: 'expense',
      date: `${m1}-14`,
      description: 'October household groceries',
    },
    {
      id: 'tx_seed_13',
      title: 'Utilities & Water',
      amount: 172,
      category: 'Utilities',
      type: 'expense',
      date: `${m1}-18`,
      description: 'Electricity, gas, and municipal water',
    },
    {
      id: 'tx_seed_14',
      title: 'Technical Course Renewal',
      amount: 240,
      category: 'Education',
      type: 'expense',
      date: `${m1}-22`,
      description: 'Annual systems architecture membership',
    },
    // -2 months
    {
      id: 'tx_seed_15',
      title: 'Monthly Product Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m2}-01`,
      description: 'Monthly payroll deposit',
    },
    {
      id: 'tx_seed_16',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m2}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_17',
      title: 'Groceries & Dining',
      amount: 530,
      category: 'Food',
      type: 'expense',
      date: `${m2}-15`,
      description: 'Supermarket and team dinners',
    },
    {
      id: 'tx_seed_18',
      title: 'Flight & Rail Booking',
      amount: 420,
      category: 'Transport',
      type: 'expense',
      date: `${m2}-20`,
      description: 'Regional conference travel',
    },
    // -3 months
    {
      id: 'tx_seed_19',
      title: 'Monthly Product Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m3}-01`,
      description: 'Monthly payroll deposit',
    },
    {
      id: 'tx_seed_20',
      title: 'Quarterly Dividend Payout',
      amount: 460,
      category: 'Investments',
      type: 'income',
      date: `${m3}-12`,
      description: 'Index fund distribution',
    },
    {
      id: 'tx_seed_21',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m3}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_22',
      title: 'Home Office Desk Chair',
      amount: 480,
      category: 'Shopping',
      type: 'expense',
      date: `${m3}-16`,
      description: 'Ergonomic workstation upgrade',
    },
    {
      id: 'tx_seed_23',
      title: 'Groceries & Utilities',
      amount: 615,
      category: 'Food',
      type: 'expense',
      date: `${m3}-24`,
      description: 'Monthly supermarket and home supplies',
    },
    // -4 months
    {
      id: 'tx_seed_24',
      title: 'Monthly Product Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m4}-01`,
      description: 'Monthly payroll deposit',
    },
    {
      id: 'tx_seed_25',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m4}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_26',
      title: 'Summer Concert & Cinema',
      amount: 185,
      category: 'Entertainment',
      type: 'expense',
      date: `${m4}-19`,
      description: 'Weekend tickets and streaming',
    },
    {
      id: 'tx_seed_27',
      title: 'Groceries',
      amount: 440,
      category: 'Food',
      type: 'expense',
      date: `${m4}-21`,
      description: 'Monthly food shopping',
    },
    // -5 months
    {
      id: 'tx_seed_28',
      title: 'Monthly Product Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m5}-01`,
      description: 'Monthly payroll deposit',
    },
    {
      id: 'tx_seed_29',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m5}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_30',
      title: 'Groceries & Utilities',
      amount: 580,
      category: 'Food',
      type: 'expense',
      date: `${m5}-15`,
      description: 'Monthly household essentials',
    },
  ];
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

function safeWriteJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function generateUniqueId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `tx_${window.crypto.randomUUID()}`;
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function initializeStorageIfNeeded() {
  const isInitialized = window.localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  const activeMonth = getActiveMonth();

  if (!isInitialized) {
    const seedData = buildSeedTransactions(activeMonth);
    safeWriteJson(STORAGE_KEYS.TRANSACTIONS, seedData);
    safeWriteJson(STORAGE_KEYS.BUDGET, DEFAULT_BUDGET_CONFIG);
    window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
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

export function getTransactions() {
  const list = safeReadJson(STORAGE_KEYS.TRANSACTIONS, []);
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    id: String(item.id || generateUniqueId()),
    title: String(item.title || ''),
    amount: Number(item.amount) || 0,
    category: String(item.category || 'Other'),
    type: item.type === 'income' ? 'income' : 'expense',
    date: String(item.date || ''),
    description: String(item.description || ''),
  }));
}

export function saveTransactions(transactions) {
  return safeWriteJson(STORAGE_KEYS.TRANSACTIONS, transactions);
}

export function addTransaction(transactionInput) {
  const transactions = getTransactions();
  const newTransaction = {
    id: transactionInput.id || generateUniqueId(),
    title: transactionInput.title.trim(),
    amount: Number(Number(transactionInput.amount).toFixed(2)),
    category: transactionInput.category,
    type: transactionInput.type === 'income' ? 'income' : 'expense',
    date: transactionInput.date,
    description: (transactionInput.description || '').trim(),
  };
  transactions.unshift(newTransaction);
  saveTransactions(transactions);
  return newTransaction;
}

export function updateTransaction(id, updatedFields) {
  const transactions = getTransactions();
  const index = transactions.findIndex((tx) => tx.id === id);
  if (index === -1) return null;

  const updated = {
    ...transactions[index],
    title: updatedFields.title.trim(),
    amount: Number(Number(updatedFields.amount).toFixed(2)),
    category: updatedFields.category,
    type: updatedFields.type === 'income' ? 'income' : 'expense',
    date: updatedFields.date,
    description: (updatedFields.description || '').trim(),
  };

  transactions[index] = updated;
  saveTransactions(transactions);
  return updated;
}

export function deleteTransaction(id) {
  const transactions = getTransactions();
  const filtered = transactions.filter((tx) => tx.id !== id);
  if (filtered.length === transactions.length) return false;
  saveTransactions(filtered);
  return true;
}

export function getBudgetConfig() {
  const stored = safeReadJson(STORAGE_KEYS.BUDGET, null);
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_BUDGET_CONFIG, monthlyOverrides: {} };
  }
  return {
    defaultLimit: Number(stored.defaultLimit) >= 0 ? Number(stored.defaultLimit) : 0,
    monthlyOverrides:
      stored.monthlyOverrides && typeof stored.monthlyOverrides === 'object'
        ? { ...stored.monthlyOverrides }
        : {},
  };
}

export function getBudgetForMonth(monthKey) {
  const config = getBudgetConfig();
  if (
    monthKey &&
    Object.prototype.hasOwnProperty.call(config.monthlyOverrides, monthKey)
  ) {
    return Number(config.monthlyOverrides[monthKey]) || 0;
  }
  return config.defaultLimit;
}

export function saveBudget(monthKey, limitAmount, applyAsDefault = true) {
  const config = getBudgetConfig();
  const cleanLimit = Number(Number(limitAmount).toFixed(2));

  if (applyAsDefault) {
    config.defaultLimit = cleanLimit;
    if (monthKey) {
      config.monthlyOverrides[monthKey] = cleanLimit;
    }
  } else if (monthKey) {
    config.monthlyOverrides[monthKey] = cleanLimit;
  }

  safeWriteJson(STORAGE_KEYS.BUDGET, config);
  return cleanLimit;
}

export function loadSampleTransactions(referenceMonthKey) {
  const targetMonth = referenceMonthKey || getActiveMonth();
  const seedData = buildSeedTransactions(targetMonth);
  saveTransactions(seedData);
  safeWriteJson(STORAGE_KEYS.BUDGET, DEFAULT_BUDGET_CONFIG);
  window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  return seedData;
}

export function clearAllStoredData() {
  saveTransactions([]);
  safeWriteJson(STORAGE_KEYS.BUDGET, { defaultLimit: 0, monthlyOverrides: {} });
  window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}
