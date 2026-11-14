const db = require('../config/database');

function isValidDateString(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validateTransactionData({ title, amount, category, type, date }) {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return 'Title is required and must be non-empty.';
  }
  const numAmount = Number(amount);
  if (amount === undefined || amount === null || !Number.isFinite(numAmount) || numAmount <= 0) {
    return 'Amount is required and must be a number greater than 0.';
  }
  if (!category || typeof category !== 'string' || category.trim() === '') {
    return 'Category is required and must be non-empty.';
  }
  if (type !== 'income' && type !== 'expense') {
    return 'Type must be either "income" or "expense".';
  }
  if (!isValidDateString(date)) {
    return 'Date is required and must be a valid date in YYYY-MM-DD format.';
  }
  return null;
}

// GET /api/transactions
function getAllTransactions(req, res, next) {
  try {
    const stmt = db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC');
    const transactions = stmt.all();
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/transactions/:id
function getTransactionById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID. ID must be a positive integer.'
      });
    }

    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const tx = stmt.get(id);

    if (!tx) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found.`
      });
    }

    res.status(200).json({
      success: true,
      data: tx
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/transactions
function createTransaction(req, res, next) {
  try {
    const { title, amount, category, type, date, description } = req.body || {};

    const validationError = validateTransactionData({ title, amount, category, type, date });
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const cleanTitle = title.trim();
    const cleanAmount = Number(Number(amount).toFixed(2));
    const cleanCategory = category.trim();
    const cleanDate = date.trim();
    const cleanDescription = description && typeof description === 'string' ? description.trim() : null;

    const insertStmt = db.prepare(`
      INSERT INTO transactions (title, amount, category, type, date, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = insertStmt.run(cleanTitle, cleanAmount, cleanCategory, type, cleanDate, cleanDescription);
    const createdTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: createdTx
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/transactions/:id
function updateTransaction(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID. ID must be a positive integer.'
      });
    }

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found.`
      });
    }

    const { title, amount, category, type, date, description } = req.body || {};
    const validationError = validateTransactionData({ title, amount, category, type, date });
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const cleanTitle = title.trim();
    const cleanAmount = Number(Number(amount).toFixed(2));
    const cleanCategory = category.trim();
    const cleanDate = date.trim();
    const cleanDescription = description && typeof description === 'string' ? description.trim() : null;

    const updateStmt = db.prepare(`
      UPDATE transactions
      SET title = ?, amount = ?, category = ?, type = ?, date = ?, description = ?
      WHERE id = ?
    `);

    updateStmt.run(cleanTitle, cleanAmount, cleanCategory, type, cleanDate, cleanDescription, id);
    const updatedTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

    res.status(200).json({
      success: true,
      data: updatedTx
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/transactions/:id
function deleteTransaction(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID. ID must be a positive integer.'
      });
    }

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found.`
      });
    }

    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

    res.status(200).json({
      success: true,
      data: { id, message: `Transaction ${id} deleted successfully.` }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
};
