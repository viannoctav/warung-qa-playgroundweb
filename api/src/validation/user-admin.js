// Validasi Kelola User (admin). Aturan & pesan sama persis dengan Registrasi.
const { validateRegister, validatePassword, MESSAGES } = require('./register');

const EDITABLE_FIELDS = ['fullName', 'username', 'email', 'phone', 'birthDate', 'gender'];
const SORTS = ['username', 'fullName', 'createdAt'];
const LIMITS = [5, 10, 20, 50];

const USER_MESSAGES = {
  ...MESSAGES,
  newPasswordRequired: 'Password baru wajib diisi',
  noChanges: 'Tidak ada data yang diubah',
  readOnlyField: (fields) => `Field tidak bisa diubah: ${fields.join(', ')}`,
};

const DUMMY_PASSWORD = 'Dummy123!';

/**
 * PATCH /users/{id}: hanya field yang dikirim yang divalidasi.
 * current = data user sekarang (dipakai untuk mengisi field yang tidak dikirim).
 */
function validateUserUpdate(body, current, now = new Date()) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const sent = Object.keys(input);
  const readOnly = sent.filter((key) => !EDITABLE_FIELDS.includes(key));
  if (readOnly.length > 0) {
    return { errors: {}, readOnly, value: null };
  }
  const fields = sent.filter((key) => EDITABLE_FIELDS.includes(key));
  if (fields.length === 0) return { errors: {}, empty: true, value: null };

  const merged = {
    fullName: current.fullName,
    username: current.username,
    email: current.email,
    phone: current.phone,
    birthDate: current.birthDate,
    gender: current.gender,
    ...input,
    password: DUMMY_PASSWORD,
    confirmPassword: DUMMY_PASSWORD,
  };
  const result = validateRegister(merged, now);
  const errors = {};
  for (const field of fields) if (result.errors[field]) errors[field] = result.errors[field];
  const value = {};
  for (const field of fields) value[field] = result.value[field];
  return { errors, value };
}

function validatePasswordChange(body) {
  const input = body && typeof body === 'object' ? body : {};
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : '';
  const confirmPassword = typeof input.confirmPassword === 'string' ? input.confirmPassword : '';
  const errors = {};
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    errors.newPassword = passwordError === MESSAGES.passwordRequired ? USER_MESSAGES.newPasswordRequired : passwordError;
  }
  if (!confirmPassword) errors.confirmPassword = MESSAGES.confirmPasswordRequired;
  else if (confirmPassword !== newPassword) errors.confirmPassword = MESSAGES.confirmPasswordMismatch;
  return { errors, value: { newPassword } };
}

function validateUserListQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const read = (key) => (typeof q[key] === 'string' ? q[key] : '');
  const errors = {};

  const search = read('search').trim();
  if (search.length > 100) errors.search = 'Kata kunci maksimal 100 karakter';
  const role = read('role');
  if (role && !['user', 'admin'].includes(role)) errors.role = 'Role harus user atau admin';
  const type = read('type');
  if (type && !['demo', 'registered'].includes(type)) errors.type = 'Tipe harus demo atau registered';
  const sort = read('sort') || 'createdAt';
  if (!SORTS.includes(sort)) errors.sort = 'Sort harus username, fullName, atau createdAt';
  const order = read('order') || (sort === 'createdAt' ? 'desc' : 'asc');
  if (!['asc', 'desc'].includes(order)) errors.order = 'Order harus asc atau desc';
  const pageRaw = read('page') || '1';
  const page = Number(pageRaw);
  if (!/^\d+$/.test(pageRaw) || page < 1) errors.page = 'Page harus angka mulai dari 1';
  const limitRaw = read('limit') || '10';
  const limit = Number(limitRaw);
  if (!/^\d+$/.test(limitRaw) || !LIMITS.includes(limit)) errors.limit = 'Limit harus 5, 10, 20, atau 50';

  return { errors, value: { search, role, type, sort, order, page, limit } };
}

module.exports = {
  validateUserUpdate,
  validatePasswordChange,
  validateUserListQuery,
  USER_MESSAGES,
  EDITABLE_FIELDS,
};
