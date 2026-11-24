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

module.exports = {
  findUserByUsername,
  findUserById,
  countRecentFailedAttempts,
  recordFailedAttempt,
  clearFailedAttempts,
  deleteExpiredUsers,
  findTakenIdentifiers,
  createUser,
};
