// Membuat tabel dan mengisi akun demo di database Neon.
// Jalankan dari folder api: npm run db:setup
require('dotenv').config({ quiet: true });

const bcrypt = require('bcryptjs');
const { getSql } = require('../src/db');
const { DEMO_PASSWORD, DEMO_USERS } = require('../src/seed-data');

async function main() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      behavior TEXT NOT NULL DEFAULT 'normal' CHECK (behavior IN ('normal', 'locked', 'slow', 'error')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS login_attempts_username_time
    ON login_attempts (username, attempted_at)
  `;

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const user of DEMO_USERS) {
    await sql`
      INSERT INTO users (username, name, password_hash, role, behavior)
      VALUES (${user.username}, ${user.name}, ${hash}, ${user.role}, ${user.behavior})
      ON CONFLICT (username) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        behavior = EXCLUDED.behavior
    `;
  }

  await sql`DELETE FROM login_attempts`;

  console.log(`Database siap: ${DEMO_USERS.length} akun demo dibuat (password: ${DEMO_PASSWORD}).`);
}

main().catch((err) => {
  console.error('Gagal menyiapkan database:', err.message);
  process.exit(1);
});
