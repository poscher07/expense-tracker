const express = require('express');
const router = express.Router();
const budgetsController = require('../controllers/budgetsController');

router.get('/:year/:month', budgetsController.getBudgetByMonth);
router.post('/', budgetsController.createBudget);
router.put('/:id', budgetsController.updateBudget);

module.exports = router;
