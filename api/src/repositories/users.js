const { getSql } = require('../db');

// Akun hasil registrasi hanya aktif 24 jam. Akun demo selalu aktif.
const ACCOUNT_TTL = '24 hours';

async function findUserByUsername(username) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, username, name, password_hash, role, behavior
    FROM users
    WHERE username = ${username}
      AND (is_demo OR created_at > now() - ${ACCOUNT_TTL}::interval)
  `;
  return rows[0] || null;
}

async function findUserById(id) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, username, name, password_hash, role, behavior
    FROM users
    WHERE id = ${id}
      AND (is_demo OR created_at > now() - ${ACCOUNT_TTL}::interval)
  `;
  return rows[0] || null;
}

async function countRecentFailedAttempts(username, windowMinutes) {
  const sql = getSql();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM login_attempts
    WHERE username = ${username} AND attempted_at > ${since}
  `;
  return rows[0].count;
}

async function recordFailedAttempt(username) {
  const sql = getSql();
  await sql`INSERT INTO login_attempts (username) VALUES (${username})`;
}

async function clearFailedAttempts(username) {
  const sql = getSql();
  await sql`DELETE FROM login_attempts WHERE username = ${username}`;
}

// Hapus akun non-demo yang umurnya lebih dari 24 jam, plus catatan gagal login lama
async function deleteExpiredUsers() {
  const sql = getSql();
  await sql`DELETE FROM users WHERE NOT is_demo AND created_at <= now() - ${ACCOUNT_TTL}::interval`;
  await sql`DELETE FROM login_attempts WHERE attempted_at <= now() - interval '1 day'`;
}

// Mengembalikan { username: boolean, email: boolean } untuk data yang sudah dipakai
async function findTakenIdentifiers(username, email) {
  const sql = getSql();
  const rows = await sql`
    SELECT username, email
    FROM users
    WHERE username = ${username} OR email = ${email}
  `;
  return {
    username: rows.some((row) => row.username === username),
    email: rows.some((row) => row.email === email),
  };
}

// Akun hasil registrasi selalu role user (pembeli di toko admin_user). Admin hanya admin_user.
async function createUser(user) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO users (
      username, name, password_hash, role, behavior, is_demo,
      email, phone, birth_date, gender
    ) VALUES (
      ${user.username}, ${user.name}, ${user.passwordHash}, 'user', 'normal', false,
      ${user.email}, ${user.phone}, ${user.birthDate}, ${user.gender}
    )
    RETURNING id, username, name, role
  `;
  return rows[0];
}

// ---------- Kelola User (admin) ----------

const ADMIN_COLUMNS = `id, username, name, email, phone, birth_date, gender, role, is_demo, created_at`;
const ACTIVE = `(is_demo OR created_at > now() - interval '24 hours')`;
const SORT_COLUMNS = { username: 'username', fullName: 'name', createdAt: 'created_at' };

// Kolom DATE bisa datang sebagai string atau Date (dibaca driver sebagai tengah malam waktu lokal)
function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toAdminUser(row) {
  const created = new Date(row.created_at);
  return {
    id: row.id,
    username: row.username,
    fullName: row.name,
    email: row.email,
    phone: row.phone,
    // DATE dari Postgres bisa berupa string atau Date; ambil bagian tanggalnya saja
    birthDate: dateOnly(row.birth_date),
    gender: row.gender,
    role: row.role,
    isDemo: row.is_demo,
    createdAt: created.toISOString(),
    expiresAt: row.is_demo ? null : new Date(created.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function listUsersForAdmin({ search, role, type, sort, order, page, limit }) {
  const sql = getSql();
  const where = [ACTIVE];
  const params = [];
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(username ILIKE $${params.length} OR name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (role) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  if (type) where.push(type === 'demo' ? 'is_demo' : 'NOT is_demo');
  const whereSql = where.join(' AND ');
  const column = SORT_COLUMNS[sort] || 'created_at';
  const direction = order === 'asc' ? 'ASC' : 'DESC';

  const countRows = await sql.query(`SELECT COUNT(*)::int AS total FROM users WHERE ${whereSql}`, params);
  const rows = await sql.query(
    `SELECT ${ADMIN_COLUMNS} FROM users WHERE ${whereSql}
     ORDER BY ${column} ${direction}, id ${direction}
     LIMIT ${Number(limit)} OFFSET ${(Number(page) - 1) * Number(limit)}`,
    params,
  );
  return { total: countRows[0].total, items: rows.map(toAdminUser) };
}

async function getUserForAdmin(id) {
  const sql = getSql();
  const rows = await sql.query(`SELECT ${ADMIN_COLUMNS} FROM users WHERE id = $1 AND ${ACTIVE}`, [id]);
  return rows[0] ? toAdminUser(rows[0]) : null;
}

// Username/email dipakai akun LAIN (selain id ini)?
async function findTakenByOther(id, username, email) {
  const sql = getSql();
  const rows = await sql`
    SELECT username, email FROM users
    WHERE id <> ${id} AND (username = ${username} OR email = ${email})
  `;
  return {
    username: rows.some((row) => row.username === username),
    email: rows.some((row) => row.email === email),
  };
}

const PROFILE_COLUMNS = { fullName: 'name', username: 'username', email: 'email', phone: 'phone', birthDate: 'birth_date', gender: 'gender' };

async function updateUserProfile(id, fields) {
  const sql = getSql();
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    params.push(value);
    sets.push(`${PROFILE_COLUMNS[key]} = $${params.length}`);
  }
  params.push(id);
  const rows = await sql.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} AND NOT is_demo RETURNING ${ADMIN_COLUMNS}`,
    params,
  );
  return rows[0] ? toAdminUser(rows[0]) : null;
}

async function updateUserPassword(id, passwordHash) {
  const sql = getSql();
  const rows = await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${id} AND NOT is_demo RETURNING username`;
  if (rows[0]) await sql`DELETE FROM login_attempts WHERE username = ${rows[0].username}`;
  return rows.length > 0;
}

async function deleteUserById(id) {
  const sql = getSql();
  const rows = await sql`DELETE FROM users WHERE id = ${id} AND NOT is_demo RETURNING id`;
  return rows.length > 0;
}

async function deleteUsersByIds(ids) {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM users
    WHERE NOT is_demo AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::int)
    RETURNING id
  `;
  return rows.length;
}

module.exports = {
  listUsersForAdmin,
  getUserForAdmin,
  findTakenByOther,
  updateUserProfile,
  updateUserPassword,
  deleteUserById,
  deleteUsersByIds,
  findUserByUsername,
  findUserById,
  countRecentFailedAttempts,
  recordFailedAttempt,
  clearFailedAttempts,
  deleteExpiredUsers,
  findTakenIdentifiers,
  createUser,
};
