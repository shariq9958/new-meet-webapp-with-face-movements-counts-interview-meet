const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'shariq',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'interviewmeet_db',
  password: process.env.DB_PASSWORD || 'shariq12',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, done) => {
  if (err) {
    console.error('Error connecting to database', err);
  } else {
    console.log('Successfully connected to PostgreSQL database');
    done();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
}; 