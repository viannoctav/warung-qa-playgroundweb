// Unit test logika login tanpa database asli (memakai data palsu di memori).
// Jalankan dari folder api: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAuthService } = require('../src/services/auth-service');

const PASSWORD = 'Warung123!';

function createFakeDeps() {
  const users = [
    { id: 1, username: 'standard_user', name: 'Standard User', role: 'user', behavior: 'normal' },
    { id: 2, username: 'admin_user', name: 'Admin User', role: 'admin', behavior: 'normal' },
    { id: 3, username: 'locked_user', name: 'Locked User', role: 'user', behavior: 'locked' },
    { id: 4, username: 'slow_user', name: 'Slow User', role: 'user', behavior: 'slow' },
    { id: 5, username: 'error_user', name: 'Error User', role: 'user', behavior: 'error' },
  ].map((u) => ({ ...u, password_hash: `hash:${PASSWORD}` }));

  const attempts = new Map();
  const sleeps = [];

  return {
    sleeps,
    attempts,
    findUserByUsername: async (username) => users.find((u) => u.username === username) || null,
    findUserById: async (id) => users.find((u) => u.id === id) || null,
    countRecentFailedAttempts: async (username) => attempts.get(username) || 0,
    recordFailedAttempt: async (username) => attempts.set(username, (attempts.get(username) || 0) + 1),
    clearFailedAttempts: async (username) => attempts.delete(username),
    comparePassword: async (password, hash) => hash === `hash:${password}`,
    signToken: (payload, ttl) => `token:${payload.sub}:${ttl}`,
    verifyToken: (token) => {
      const [prefix, sub] = token.split(':');
      if (prefix !== 'token') throw new Error('invalid');
      return { sub };
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
}

test('standard_user berhasil login, token 1 jam, tanpa password di respons', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: 'standard_user', password: PASSWORD });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.expiresIn, 3600);
  assert.deepEqual(res.body.data.user, { id: 1, username: 'standard_user', name: 'Standard User', role: 'user' });
  assert.equal(JSON.stringify(res.body).includes('hash'), false);
});

test('remember: true membuat token 7 hari', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: 'standard_user', password: PASSWORD, remember: true });
  assert.equal(res.body.data.expiresIn, 604800);
});

test('username di-trim dan tidak membedakan huruf besar/kecil', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: '  Standard_User ', password: PASSWORD });
  assert.equal(res.status, 200);
});

test('password membedakan huruf besar/kecil', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: 'standard_user', password: 'warung123!' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(res.body.error.message, 'Username atau password salah');
});

test('field kosong mengembalikan 400 dengan detail per field', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: '  ', password: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Username dan password wajib diisi');
  assert.deepEqual(res.body.error.fields, { username: 'Username wajib diisi', password: 'Password wajib diisi' });
});

test('body kosong (undefined) tetap 400, tidak crash', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login(undefined);
  assert.equal(res.status, 400);
});

test('username kurang dari 3 karakter ditolak 400', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: 'ab', password: PASSWORD });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Username harus 3–30 karakter');
});

test('username tidak terdaftar memberi pesan yang sama dengan password salah', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: 'tidak_ada', password: PASSWORD });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, 'Username atau password salah');
});

test('locked_user dengan password benar mendapat 423', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: 'locked_user', password: PASSWORD });
  assert.equal(res.status, 423);
  assert.equal(res.body.error.message, 'Akun ini dikunci. Hubungi admin.');
});

test('error_user mendapat 500', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.login({ username: 'error_user', password: PASSWORD });
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
});

test('slow_user berhasil setelah jeda 5 detik', async () => {
  const deps = createFakeDeps();
  const auth = createAuthService(deps);
  const res = await auth.login({ username: 'slow_user', password: PASSWORD });
  assert.equal(res.status, 200);
  assert.deepEqual(deps.sleeps, [5000]);
});

test('5 kali gagal membuat percobaan ke-6 ditolak 429, walau password benar', async () => {
  const auth = createAuthService(createFakeDeps());
  for (let i = 0; i < 5; i += 1) {
    const res = await auth.login({ username: 'standard_user', password: 'salah' });
    assert.equal(res.status, 401);
  }
  const res = await auth.login({ username: 'standard_user', password: PASSWORD });
  assert.equal(res.status, 429);
  assert.equal(res.body.error.message, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
});

test('login berhasil mengosongkan hitungan gagal', async () => {
  const deps = createFakeDeps();
  const auth = createAuthService(deps);
  await auth.login({ username: 'standard_user', password: 'salah' });
  await auth.login({ username: 'standard_user', password: PASSWORD });
  assert.equal(deps.attempts.has('standard_user'), false);
});

test('/me dengan token valid mengembalikan profil', async () => {
  const auth = createAuthService(createFakeDeps());
  const res = await auth.me('Bearer token:2');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'admin');
});

test('/me tanpa token atau token rusak mengembalikan 401', async () => {
  const auth = createAuthService(createFakeDeps());
  for (const header of [undefined, '', 'token:1', 'Bearer rusak', 'Bearer token:abc', 'Bearer token:999']) {
    const res = await auth.me(header);
    assert.equal(res.status, 401, `header: ${header}`);
    assert.equal(res.body.error.message, 'Sesi tidak valid. Silakan login kembali.');
  }
});

test('/reset mengosongkan hitungan gagal milik user yang login', async () => {
  const deps = createFakeDeps();
  const auth = createAuthService(deps);
  deps.attempts.set('standard_user', 3);
  const res = await auth.reset('Bearer token:1');
  assert.equal(res.status, 204);
  assert.equal(deps.attempts.has('standard_user'), false);
});
