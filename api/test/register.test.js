// Unit test Registrasi: aturan validasi + alur register (tanpa database asli).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRegister, MESSAGES } = require('../src/validation/register');
const { createAuthService } = require('../src/services/auth-service');

// "Hari ini" dikunci ke 24 Nov 2026 jam 12.00 WIB supaya tes umur tidak berubah-ubah
const NOW = new Date('2026-11-24T05:00:00Z');

function validBody(overrides = {}) {
  return {
    fullName: 'Rina Anggraini',
    username: 'rina_qa',
    email: 'rina@contoh.com',
    phone: '081234567890',
    birthDate: '1995-08-17',
    gender: 'female',
    password: 'Rahasia1!',
    confirmPassword: 'Rahasia1!',
    ...overrides,
  };
}

function errorsFor(overrides) {
  return validateRegister(validBody(overrides), NOW).errors;
}

test('data lengkap dan benar lolos validasi', () => {
  assert.deepEqual(errorsFor({}), {});
});

test('field lama yang sudah dihapus (kota, minat, bio, dll.) diabaikan bila dikirim', () => {
  assert.deepEqual(errorsFor({ city: 'xyz', interests: 'bukan-array', bio: 'a'.repeat(500), acceptTerms: false }), {});
});

test('body kosong memunculkan semua error wajib', () => {
  const { errors } = validateRegister(undefined, NOW);
  assert.equal(errors.fullName, MESSAGES.fullNameRequired);
  assert.equal(errors.username, MESSAGES.usernameRequired);
  assert.equal(errors.email, MESSAGES.emailRequired);
  assert.equal(errors.phone, MESSAGES.phoneRequired);
  assert.equal(errors.birthDate, MESSAGES.birthDateRequired);
  assert.equal(errors.gender, MESSAGES.genderRequired);
  assert.equal(errors.password, MESSAGES.passwordRequired);
  assert.equal(errors.confirmPassword, MESSAGES.confirmPasswordRequired);
});

test('nama lengkap: panjang dan karakter', () => {
  assert.equal(errorsFor({ fullName: 'Al' }).fullName, MESSAGES.fullNameLength);
  assert.equal(errorsFor({ fullName: 'A'.repeat(51) }).fullName, MESSAGES.fullNameLength);
  assert.equal(errorsFor({ fullName: 'Rina 123' }).fullName, MESSAGES.fullNameChars);
  assert.equal(errorsFor({ fullName: "Siti Nur'aini A. Putri" }).fullName, undefined);
  assert.equal(errorsFor({ fullName: 'André Émile' }).fullName, undefined);
});

test('username: dirapikan, panjang, karakter', () => {
  const { value } = validateRegister(validBody({ username: '  Rina_QA ' }), NOW);
  assert.equal(value.username, 'rina_qa');
  assert.equal(errorsFor({ username: 'ab' }).username, MESSAGES.usernameLength);
  assert.equal(errorsFor({ username: 'a'.repeat(31) }).username, MESSAGES.usernameLength);
  assert.equal(errorsFor({ username: 'rina-qa' }).username, MESSAGES.usernameChars);
  assert.equal(errorsFor({ username: 'rina qa' }).username, MESSAGES.usernameChars);
});

test('email: format', () => {
  assert.equal(errorsFor({ email: 'budi@gmail' }).email, MESSAGES.emailFormat);
  assert.equal(errorsFor({ email: 'budi.gmail.com' }).email, MESSAGES.emailFormat);
  assert.equal(errorsFor({ email: 'Budi@Gmail.COM' }).email, undefined);
});

test('nomor HP: awalan dan jumlah digit', () => {
  assert.equal(errorsFor({ phone: '0812345678' }).phone, undefined); // 10 digit
  assert.equal(errorsFor({ phone: '08123456789012' }).phone, undefined); // 14 digit
  assert.equal(errorsFor({ phone: '081234567' }).phone, MESSAGES.phoneFormat); // 9 digit
  assert.equal(errorsFor({ phone: '081234567890123' }).phone, MESSAGES.phoneFormat); // 15 digit
  assert.equal(errorsFor({ phone: '+6281234567890' }).phone, undefined);
  assert.equal(errorsFor({ phone: '6281234567890' }).phone, MESSAGES.phoneFormat);
  assert.equal(errorsFor({ phone: '0812-3456-789' }).phone, MESSAGES.phoneFormat);
});

test('tanggal lahir: format, masa depan, umur 17 tahun (batas tepat)', () => {
  assert.equal(errorsFor({ birthDate: '17-08-1995' }).birthDate, MESSAGES.birthDateFormat);
  assert.equal(errorsFor({ birthDate: '2001-02-30' }).birthDate, MESSAGES.birthDateFormat);
  assert.equal(errorsFor({ birthDate: '2026-11-25' }).birthDate, MESSAGES.birthDateFuture);
  assert.equal(errorsFor({ birthDate: '2009-11-24' }).birthDate, undefined); // tepat 17 tahun hari ini
  assert.equal(errorsFor({ birthDate: '2009-11-25' }).birthDate, MESSAGES.birthDateAge); // besok baru 17
});

test('jenis kelamin harus dari daftar', () => {
  assert.equal(errorsFor({ gender: 'other' }).gender, MESSAGES.genderRequired);
});

test('password: panjang dan kombinasi karakter', () => {
  assert.equal(errorsFor({ password: 'Ra1!', confirmPassword: 'Ra1!' }).password, MESSAGES.passwordLength);
  assert.equal(errorsFor({ password: 'rahasia1!', confirmPassword: 'rahasia1!' }).password, MESSAGES.passwordComplexity);
  assert.equal(errorsFor({ password: 'RAHASIA1!', confirmPassword: 'RAHASIA1!' }).password, MESSAGES.passwordComplexity);
  assert.equal(errorsFor({ password: 'Rahasia!!', confirmPassword: 'Rahasia!!' }).password, MESSAGES.passwordComplexity);
  assert.equal(errorsFor({ password: 'Rahasia12', confirmPassword: 'Rahasia12' }).password, MESSAGES.passwordComplexity);
});

test('konfirmasi password harus sama', () => {
  assert.equal(errorsFor({ confirmPassword: 'Rahasia1?' }).confirmPassword, MESSAGES.confirmPasswordMismatch);
});

// ---------- Alur register di service ----------

function createRegisterDeps({ existing = [] } = {}) {
  const users = [...existing];
  const calls = { deleteExpired: 0 };
  return {
    users,
    calls,
    now: () => NOW,
    deleteExpiredUsers: async () => {
      calls.deleteExpired += 1;
    },
    findTakenIdentifiers: async (username, email) => ({
      username: users.some((u) => u.username === username),
      email: users.some((u) => u.email === email),
    }),
    hashPassword: async (password) => `hash:${password}`,
    createUser: async (user) => {
      const created = { id: users.length + 100, ...user, role: 'user' };
      users.push(created);
      return created;
    },
  };
}

test('register berhasil: 201, role selalu user, tanpa password di respons', async () => {
  const deps = createRegisterDeps();
  const auth = createAuthService(deps);
  const res = await auth.register(validBody({ role: 'admin', username: 'Rina_QA', email: 'RINA@Contoh.com' }));
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.data.user, { id: 100, username: 'rina_qa', name: 'Rina Anggraini', role: 'user' });
  assert.equal(deps.users[0].email, 'rina@contoh.com');
  assert.equal(deps.users[0].passwordHash, 'hash:Rahasia1!');
  assert.equal(JSON.stringify(res.body).includes('Rahasia1!'), false);
  assert.equal(deps.calls.deleteExpired, 1);
});

test('register gagal validasi: 400 dengan semua field yang salah sekaligus', async () => {
  const auth = createAuthService(createRegisterDeps());
  const res = await auth.register(validBody({ email: 'salah', phone: '123' }));
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.equal(res.body.error.message, 'Data belum valid. Periksa kembali isian Anda.');
  assert.deepEqual(res.body.error.fields, {
    email: 'Format email tidak valid',
    phone: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
  });
});

test('username atau email yang sudah ada ditolak 409', async () => {
  const deps = createRegisterDeps({
    existing: [{ username: 'standard_user', email: 'standard_user@warungqa.test' }],
  });
  const auth = createAuthService(deps);

  const byUsername = await auth.register(validBody({ username: 'standard_user' }));
  assert.equal(byUsername.status, 409);
  assert.deepEqual(byUsername.body.error.fields, { username: 'Username sudah dipakai' });

  const byEmail = await auth.register(validBody({ email: 'standard_user@warungqa.test' }));
  assert.equal(byEmail.status, 409);
  assert.deepEqual(byEmail.body.error.fields, { email: 'Email sudah terdaftar' });
  assert.equal(byEmail.body.error.message, 'Username atau email sudah terdaftar');
});

test('dua request bersamaan (unique violation dari database) menjadi 409, bukan 500', async () => {
  const deps = createRegisterDeps();
  deps.createUser = async () => {
    deps.users.push({ username: 'rina_qa', email: 'rina@contoh.com' });
    const err = new Error('duplicate key');
    err.code = '23505';
    throw err;
  };
  const auth = createAuthService(deps);
  const res = await auth.register(validBody());
  assert.equal(res.status, 409);
});
