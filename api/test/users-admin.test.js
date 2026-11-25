// Unit test Kelola User (admin) dengan database palsu.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUserAdminService } = require('../src/services/user-admin-service');

const ADMIN = { id: 2, username: 'admin_user', role: 'admin' };
const BUYER = { id: 1, username: 'standard_user', role: 'user' };

function setup() {
  const rows = [
    { id: 1, username: 'standard_user', fullName: 'Standard User', email: 'standard_user@warungqa.test', phone: null, birthDate: null, gender: null, role: 'user', isDemo: true },
    { id: 2, username: 'admin_user', fullName: 'Admin User', email: 'admin_user@warungqa.test', phone: null, birthDate: null, gender: null, role: 'admin', isDemo: true },
    { id: 10, username: 'rina_qa', fullName: 'Rina Anggraini', email: 'rina@contoh.com', phone: '081234567890', birthDate: '1995-08-17', gender: 'female', role: 'user', isDemo: false },
    { id: 11, username: 'budi_qa', fullName: 'Budi Santoso', email: 'budi@contoh.com', phone: '081298765432', birthDate: '1990-01-01', gender: 'male', role: 'user', isDemo: false },
  ];
  const passwords = new Map();
  const deps = {
    now: () => new Date('2026-11-24T05:00:00Z'),
    listUsersForAdmin: async (q) => {
      let items = rows.filter((r) => (!q.role || r.role === q.role) && (!q.type || (q.type === 'demo') === r.isDemo));
      if (q.search) items = items.filter((r) => `${r.username} ${r.fullName} ${r.email}`.toLowerCase().includes(q.search.toLowerCase()));
      return { total: items.length, items: items.slice((q.page - 1) * q.limit, q.page * q.limit) };
    },
    getUserForAdmin: async (id) => rows.find((r) => r.id === id) || null,
    findTakenByOther: async (id, username, email) => ({
      username: rows.some((r) => r.id !== id && r.username === username),
      email: rows.some((r) => r.id !== id && r.email === email),
    }),
    updateUserProfile: async (id, fields) => {
      const row = rows.find((r) => r.id === id && !r.isDemo);
      if (!row) return null;
      Object.assign(row, fields);
      return { ...row };
    },
    hashPassword: async (pw) => `hash:${pw}`,
    updateUserPassword: async (id, hash) => {
      passwords.set(id, hash);
      return true;
    },
    deleteUserById: async (id) => {
      const i = rows.findIndex((r) => r.id === id && !r.isDemo);
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
    deleteUsersByIds: async (ids) => {
      let n = 0;
      for (const id of ids) if (await deps.deleteUserById(id)) n += 1;
      return n;
    },
  };
  return { svc: createUserAdminService(deps), rows, passwords };
}

test('role user tidak bisa memakai semua endpoint Kelola User (403)', async () => {
  const { svc } = setup();
  for (const res of [
    await svc.list(BUYER, {}),
    await svc.get(BUYER, '10'),
    await svc.update(BUYER, '10', { fullName: 'X Y Z' }),
    await svc.changePassword(BUYER, '10', { newPassword: 'Baru123!', confirmPassword: 'Baru123!' }),
    await svc.remove(BUYER, '10'),
    await svc.bulkDelete(BUYER, { ids: [10] }),
  ]) {
    assert.equal(res.status, 403);
    assert.equal(res.body.error.message, 'Hanya akun admin yang bisa mengelola user.');
  }
});

test('daftar user: filter, cari, validasi query', async () => {
  const { svc } = setup();
  const all = await svc.list(ADMIN, {});
  assert.equal(all.status, 200);
  assert.equal(all.body.meta.total, 4);
  assert.equal((await svc.list(ADMIN, { type: 'registered' })).body.meta.total, 2);
  assert.equal((await svc.list(ADMIN, { role: 'admin' })).body.data[0].username, 'admin_user');
  assert.equal((await svc.list(ADMIN, { search: 'RINA' })).body.data[0].username, 'rina_qa');
  const bad = await svc.list(ADMIN, { limit: '7', sort: 'password', role: 'owner', type: 'x' });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['limit', 'role', 'sort', 'type']);
});

test('detail user: ada, tidak ada, id bukan angka', async () => {
  const { svc } = setup();
  assert.equal((await svc.get(ADMIN, '10')).body.data.fullName, 'Rina Anggraini');
  assert.equal((await svc.get(ADMIN, '999')).body.error.message, 'User tidak ditemukan');
  assert.equal((await svc.get(ADMIN, 'abc')).status, 404);
});

test('ubah data: sebagian field, dirapikan, pesan sama dengan registrasi', async () => {
  const { svc } = setup();
  const res = await svc.update(ADMIN, '10', { fullName: '  Rina   Wijaya ', email: 'RINA.W@Contoh.com' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.fullName, 'Rina Wijaya');
  assert.equal(res.body.data.email, 'rina.w@contoh.com');
  assert.equal(res.body.data.phone, '081234567890');

  const bad = await svc.update(ADMIN, '10', { phone: '123', birthDate: '2015-01-01', gender: 'x', username: 'A B' });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.error.fields, {
    phone: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
    birthDate: 'Umur minimal 17 tahun',
    gender: 'Pilih jenis kelamin',
    username: 'Username hanya boleh berisi huruf, angka, dan garis bawah',
  });
});

test('ubah data ditolak: field terlarang, body kosong, bentrok username/email, akun demo', async () => {
  const { svc } = setup();
  const role = await svc.update(ADMIN, '10', { role: 'admin', password: 'x' });
  assert.equal(role.status, 400);
  assert.equal(role.body.error.message, 'Field tidak bisa diubah: role, password');
  assert.equal((await svc.update(ADMIN, '10', {})).body.error.message, 'Tidak ada data yang diubah');

  const dup = await svc.update(ADMIN, '10', { username: 'budi_qa', email: 'standard_user@warungqa.test' });
  assert.equal(dup.status, 409);
  assert.deepEqual(dup.body.error.fields, { username: 'Username sudah dipakai', email: 'Email sudah terdaftar' });
  // memakai username sendiri tidak dianggap bentrok
  assert.equal((await svc.update(ADMIN, '10', { username: 'rina_qa' })).status, 200);

  const demo = await svc.update(ADMIN, '1', { fullName: 'Ganti Nama' });
  assert.equal(demo.status, 403);
  assert.equal(demo.body.error.message, 'Akun demo tidak bisa diubah atau dihapus');
});

test('ganti password: aturan sama dengan registrasi, tersimpan ter-hash', async () => {
  const { svc, passwords } = setup();
  const empty = await svc.changePassword(ADMIN, '10', {});
  assert.deepEqual(empty.body.error.fields, {
    newPassword: 'Password baru wajib diisi',
    confirmPassword: 'Konfirmasi password wajib diisi',
  });
  const weak = await svc.changePassword(ADMIN, '10', { newPassword: 'abcdefgh', confirmPassword: 'abcdefgx' });
  assert.deepEqual(weak.body.error.fields, {
    newPassword: 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol',
    confirmPassword: 'Konfirmasi password tidak sama',
  });
  const ok = await svc.changePassword(ADMIN, '10', { newPassword: 'Baru123!', confirmPassword: 'Baru123!' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.message, 'Password berhasil diubah');
  assert.equal(passwords.get(10), 'hash:Baru123!');
  assert.equal((await svc.changePassword(ADMIN, '2', { newPassword: 'Baru123!', confirmPassword: 'Baru123!' })).status, 403);
});

test('hapus user & hapus banyak; akun demo dilindungi', async () => {
  const { svc, rows } = setup();
  assert.equal((await svc.remove(ADMIN, '1')).status, 403);
  assert.equal((await svc.remove(ADMIN, '10')).status, 204);
  assert.equal((await svc.remove(ADMIN, '10')).status, 404);

  assert.equal((await svc.bulkDelete(ADMIN, { ids: [] })).body.error.message, 'ids harus berisi 1–50 id user');
  assert.equal((await svc.bulkDelete(ADMIN, { ids: ['11'] })).status, 400);
  const withDemo = await svc.bulkDelete(ADMIN, { ids: [11, 2] });
  assert.equal(withDemo.status, 403);
  assert.equal(rows.some((r) => r.id === 11), true);
  const ok = await svc.bulkDelete(ADMIN, { ids: [11, 11, 999] });
  assert.deepEqual(ok.body.data, { deleted: 1 });
});

test('dokumentasi OpenAPI memuat endpoint Kelola User', () => {
  const { spec } = require('../src/openapi');
  for (const path of ['/api/v1/users', '/api/v1/users/bulk-delete', '/api/v1/users/{id}', '/api/v1/users/{id}/password']) {
    assert.ok(spec.paths[path], path);
  }
});
