const db = require('../config/database');

function validateMonthAndYear(month, year) {
  const numMonth = Number(month);
  const numYear = Number(year);

  if (!Number.isInteger(numYear) || numYear < 1970 || numYear > 2200) {
    return 'Year must be a valid integer year (e.g. 2026).';
  }
  if (!Number.isInteger(numMonth) || numMonth < 1 || numMonth > 12) {
    return 'Month must be an integer between 1 and 12.';
  }
  return null;
}

// GET /api/budgets/:year/:month
function getBudgetByMonth(req, res, next) {
  try {
    const { year, month } = req.params;
    const validationError = validateMonthAndYear(month, year);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const stmt = db.prepare('SELECT * FROM monthly_budgets WHERE year = ? AND month = ?');
    const budget = stmt.get(Number(year), Number(month));

    if (!budget) {
      return res.status(404).json({
        success: false,
        error: `No budget set for ${year}-${String(month).padStart(2, '0')}.`
      });
    }

    res.status(200).json({
      success: true,
      data: budget
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/budgets
function createBudget(req, res, next) {
  try {
    const { year, month, amount } = req.body || {};

    const validationError = validateMonthAndYear(month, year);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const numAmount = Number(amount);
    if (amount === undefined || amount === null || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be a number greater than 0.'
      });
    }

    const cleanYear = Number(year);
    const cleanMonth = Number(month);
    const cleanAmount = Number(numAmount.toFixed(2));

    // Check if budget for that month and year already exists
    const existing = db.prepare('SELECT * FROM monthly_budgets WHERE year = ? AND month = ?').get(cleanYear, cleanMonth);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Budget for ${cleanYear}-${String(cleanMonth).padStart(2, '0')} already exists. Use PUT /api/budgets/:id to update it.`,
        data: existing
      });
    }

    const insertStmt = db.prepare(`
      INSERT INTO monthly_budgets (year, month, amount)
      VALUES (?, ?, ?)
    `);

    const info = insertStmt.run(cleanYear, cleanMonth, cleanAmount);
    const createdBudget = db.prepare('SELECT * FROM monthly_budgets WHERE id = ?').get(info.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: createdBudget
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/budgets/:id
function updateBudget(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID. ID must be a positive integer.'
      });
    }

    const existing = db.prepare('SELECT * FROM monthly_budgets WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Budget with ID ${id} not found.`
      });
    }

    const { amount } = req.body || {};
    const numAmount = Number(amount);
    if (amount === undefined || amount === null || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be a number greater than 0.'
      });
    }

    const cleanAmount = Number(numAmount.toFixed(2));
    const updateStmt = db.prepare('UPDATE monthly_budgets SET amount = ? WHERE id = ?');
    updateStmt.run(cleanAmount, id);

    const updatedBudget = db.prepare('SELECT * FROM monthly_budgets WHERE id = ?').get(id);

    res.status(200).json({
      success: true,
      data: updatedBudget
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBudgetByMonth,
  createBudget,
  updateBudget
};
