// Membuat/memperbarui tabel dan mengisi akun demo di database Neon.
// Aman dijalankan berulang kali. Jalankan dari folder api: npm run db:setup
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

  // Kolom tambahan untuk Registrasi (Fase 2)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`;
  await sql`CREATE INDEX IF NOT EXISTS users_created_at ON users (created_at) WHERE NOT is_demo`;

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
      INSERT INTO users (username, name, password_hash, role, behavior, is_demo, email)
      VALUES (${user.username}, ${user.name}, ${hash}, ${user.role}, ${user.behavior}, true, ${user.email})
      ON CONFLICT (username) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        behavior = EXCLUDED.behavior,
        is_demo = true,
        email = EXCLUDED.email
    `;
  }

  await sql`DELETE FROM login_attempts`;

  console.log(`Database siap: ${DEMO_USERS.length} akun demo dibuat (password: ${DEMO_PASSWORD}).`);
}

main().catch((err) => {
  console.error('Gagal menyiapkan database:', err.message);
  process.exit(1);
});
