const {
  validateUserUpdate,
  validatePasswordChange,
  validateUserListQuery,
  USER_MESSAGES,
} = require('../validation/user-admin');

const TEXT = {
  forbidden: 'Hanya akun admin yang bisa mengelola user.',
  notFound: 'User tidak ditemukan',
  demoProtected: 'Akun demo tidak bisa diubah atau dihapus',
  bulkDemo: 'Daftar berisi akun demo. Akun demo tidak bisa dihapus.',
  idsInvalid: 'ids harus berisi 1–50 id user',
  passwordChanged: 'Password berhasil diubah',
};

function fail(status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return { status, body: { error } };
}

function parseId(raw) {
  const text = String(raw);
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

/**
 * Kelola User untuk admin: daftar, detail, ubah data, ganti password, hapus.
 * Akun demo (standard_user, admin_user, dll.) bisa dilihat tapi tidak bisa diubah/dihapus.
 * Urutan cek: 403 bukan admin → 404 tidak ada → 403 akun demo → 400 validasi → 409 bentrok.
 */
function createUserAdminService(deps) {
  const now = () => (deps.now ? deps.now() : new Date());
  const isAdmin = (user) => user && user.role === 'admin';
  const forbidden = () => fail(403, 'FORBIDDEN', TEXT.forbidden);
  const notFound = () => fail(404, 'NOT_FOUND', TEXT.notFound);
  const demoProtected = () => fail(403, 'DEMO_PROTECTED', TEXT.demoProtected);

  async function findTarget(rawId) {
    const id = parseId(rawId);
    return id ? deps.getUserForAdmin(id) : null;
  }

  async function list(admin, query) {
    if (!isAdmin(admin)) return forbidden();
    const { errors, value } = validateUserListQuery(query);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', 'Parameter tidak valid', errors);
    const { total, items } = await deps.listUsersForAdmin(value);
    return {
      status: 200,
      body: {
        data: items,
        meta: { page: value.page, limit: value.limit, total, totalPages: Math.max(1, Math.ceil(total / value.limit)) },
      },
    };
  }

  async function get(admin, rawId) {
    if (!isAdmin(admin)) return forbidden();
    const target = await findTarget(rawId);
    if (!target) return notFound();
    return { status: 200, body: { data: target } };
  }

  async function update(admin, rawId, body) {
    if (!isAdmin(admin)) return forbidden();
    const target = await findTarget(rawId);
    if (!target) return notFound();
    if (target.isDemo) return demoProtected();

    const { errors, value, readOnly, empty } = validateUserUpdate(body, target, now());
    if (readOnly) {
      const message = USER_MESSAGES.readOnlyField(readOnly);
      return fail(400, 'VALIDATION_ERROR', message, Object.fromEntries(readOnly.map((f) => [f, message])));
    }
    if (empty) return fail(400, 'VALIDATION_ERROR', USER_MESSAGES.noChanges);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', USER_MESSAGES.formInvalid, errors);

    const username = value.username ?? target.username;
    const email = value.email ?? target.email;
    const taken = await deps.findTakenByOther(target.id, username, email);
    const conflicts = {};
    if (taken.username && value.username !== undefined) conflicts.username = USER_MESSAGES.usernameTaken;
    if (taken.email && value.email !== undefined) conflicts.email = USER_MESSAGES.emailTaken;
    if (Object.keys(conflicts).length > 0) {
      return fail(409, 'ALREADY_EXISTS', USER_MESSAGES.alreadyExists, conflicts);
    }

    try {
      const updated = await deps.updateUserProfile(target.id, value);
      if (!updated) return notFound();
      return { status: 200, body: { data: updated } };
    } catch (err) {
      // Dua admin menyimpan username/email yang sama di waktu bersamaan
      if (err && err.code === '23505') return fail(409, 'ALREADY_EXISTS', USER_MESSAGES.alreadyExists);
      throw err;
    }
  }

  async function changePassword(admin, rawId, body) {
    if (!isAdmin(admin)) return forbidden();
    const target = await findTarget(rawId);
    if (!target) return notFound();
    if (target.isDemo) return demoProtected();

    const { errors, value } = validatePasswordChange(body);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', USER_MESSAGES.formInvalid, errors);

    const hash = await deps.hashPassword(value.newPassword);
    if (!(await deps.updateUserPassword(target.id, hash))) return notFound();
    return { status: 200, body: { data: { message: TEXT.passwordChanged } } };
  }

  async function remove(admin, rawId) {
    if (!isAdmin(admin)) return forbidden();
    const target = await findTarget(rawId);
    if (!target) return notFound();
    if (target.isDemo) return demoProtected();
    if (!(await deps.deleteUserById(target.id))) return notFound();
    return { status: 204 };
  }

  async function bulkDelete(admin, body) {
    if (!isAdmin(admin)) return forbidden();
    const ids = body && Array.isArray(body.ids) ? body.ids : null;
    const valid = ids && ids.length >= 1 && ids.length <= 50 && ids.every((id) => Number.isInteger(id) && id > 0);
    if (!valid) return fail(400, 'VALIDATION_ERROR', TEXT.idsInvalid, { ids: TEXT.idsInvalid });

    const unique = [...new Set(ids)];
    const targets = await Promise.all(unique.map((id) => deps.getUserForAdmin(id)));
    if (targets.some((t) => t && t.isDemo)) return fail(403, 'DEMO_PROTECTED', TEXT.bulkDemo);

    const deleted = await deps.deleteUsersByIds(unique);
    return { status: 200, body: { data: { deleted } } };
  }

  return { list, get, update, changePassword, remove, bulkDelete };
}

module.exports = { createUserAdminService, TEXT };
