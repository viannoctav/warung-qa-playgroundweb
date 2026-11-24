let sql;

// Koneksi ke Neon lewat HTTP, cocok untuk serverless function di Vercel
function getSql() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL belum diatur (cek file api/.env atau Environment Variables di Vercel)');
    }
    // Library dimuat di sini supaya unit test yang tidak butuh database tetap bisa jalan
    const { neon } = require('@neondatabase/serverless');
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

module.exports = { getSql };
