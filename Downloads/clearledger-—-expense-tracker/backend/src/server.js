const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables relative to backend directory
const backendDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendDir, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = path.resolve(__dirname, '../../');

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const healthRoutes = require('./routes/healthRoutes');
const transactionsRoutes = require('./routes/transactionsRoutes');
const budgetsRoutes = require('./routes/budgetsRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

app.use('/api/health', healthRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets', budgetsRoutes);

// 404 handler for unknown API routes
app.use(notFoundHandler);

// Serve static frontend from the project root directory
app.use(express.static(rootDir));

// Global central error handler
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Expense Tracker server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
