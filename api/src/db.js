const { neon } = require('@neondatabase/serverless');

let sql;

// Koneksi ke Neon lewat HTTP, cocok untuk serverless function di Vercel
function getSql() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL belum diatur (cek file api/.env atau Environment Variables di Vercel)');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

module.exports = { getSql };
