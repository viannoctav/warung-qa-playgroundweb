// Notifikasi: daftar (lonceng & halaman), tandai dibaca.
const LIMITS = [5, 10, 20, 50];

const TEXT = {
  notFound: 'Notifikasi tidak ditemukan',
  page: 'Halaman harus angka 1 atau lebih',
  limit: 'Limit harus 5, 10, 20, atau 50',
  unread: 'unread harus true atau false',
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

function createNotificationService(deps) {
  async function list(user, query = {}) {
    const errors = {};
    const pageRaw = query.page === undefined ? '1' : String(query.page);
    const limitRaw = query.limit === undefined ? '10' : String(query.limit);
    const unreadRaw = query.unread === undefined ? 'false' : String(query.unread);
    if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1) errors.page = TEXT.page;
    if (!LIMITS.includes(Number(limitRaw)) || !/^\d+$/.test(limitRaw)) errors.limit = TEXT.limit;
    if (!['true', 'false'].includes(unreadRaw)) errors.unread = TEXT.unread;
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);

    const page = Number(pageRaw);
    const limit = Number(limitRaw);
    const { total, unread, items } = await deps.listNotifications(user.id, { unreadOnly: unreadRaw === 'true', page, limit });
    return {
      status: 200,
      body: { data: items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), unread } },
    };
  }

  async function markRead(user, rawId) {
    const id = parseId(rawId);
    const item = id ? await deps.markRead(user.id, id) : null;
    if (!item) return fail(404, 'NOT_FOUND', TEXT.notFound);
    return { status: 200, body: { data: item } };
  }

  async function markAllRead(user) {
    const updated = await deps.markAllRead(user.id);
    return { status: 200, body: { data: { updated } } };
  }

  return { list, markRead, markAllRead };
}

// Kirim notifikasi tanpa menggagalkan aksi utama kalau penyimpanan notifikasi bermasalah
async function safeNotify(deps, userId, payload) {
  if (!deps.notify || !userId) return;
  try {
    await deps.notify(userId, payload);
  } catch (err) {
    console.error('Gagal menyimpan notifikasi:', err.message);
  }
}

module.exports = { createNotificationService, safeNotify, NOTIFICATION_LIMITS: LIMITS, NOTIFICATION_TEXT: TEXT };
