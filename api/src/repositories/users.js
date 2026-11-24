const { getSql } = require('../db');

async function findUserByUsername(username) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, username, name, password_hash, role, behavior
    FROM users
    WHERE username = ${username}
  `;
  return rows[0] || null;
}

async function findUserById(id) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, username, name, password_hash, role, behavior
    FROM users
    WHERE id = ${id}
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

module.exports = {
  findUserByUsername,
  findUserById,
  countRecentFailedAttempts,
  recordFailedAttempt,
  clearFailedAttempts,
};
