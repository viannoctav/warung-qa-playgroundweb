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
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS products_seeded BOOLEAN NOT NULL DEFAULT false`;
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

  // Produk (Fase 3): setiap akun punya katalog sendiri
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price BETWEEN 1000 AND 10000000),
      stock INTEGER NOT NULL CHECK (stock BETWEEN 0 AND 9999),
      is_active BOOLEAN NOT NULL DEFAULT true,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (owner_id, sku)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS products_owner ON products (owner_id)`;
  // Gambar produk disimpan sebagai base64 di database (maks 2 MB per gambar)
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data TEXT`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_type TEXT`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ`;

  // Toko (Fase 4): keranjang, pesanan, item pesanan
  await sql`
    CREATE TABLE IF NOT EXISTS cart_items (
      user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, product_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      store_owner_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'diproses',
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      shipping_method TEXT NOT NULL,
      shipping_cost INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      voucher_code TEXT,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS orders_user ON orders (user_id, created_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products (id) ON DELETE SET NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal INTEGER NOT NULL
    )
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
