const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

// Load .env relative to the backend folder
const backendDir = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(backendDir, '.env') });

const dbRelativePath = process.env.DATABASE_PATH || 'database/expense-tracker.db';
const dbFullPath = path.resolve(backendDir, dbRelativePath);

// Ensure the directory for the database file exists
fs.mkdirSync(path.dirname(dbFullPath), { recursive: true });

// Initialize database with better-sqlite3
const db = new Database(dbFullPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema automatically on start
const schemaPath = path.join(backendDir, 'database', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

module.exports = db;
