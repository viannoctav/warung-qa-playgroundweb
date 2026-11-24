const config = require('../config');
const { validateRegister, MESSAGES: REGISTER_MESSAGES } = require('../validation/register');

const { MESSAGES } = config;

function fail(status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return { status, body: { error } };
}

function publicUser(user) {
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

/**
 * Logika login dipisah dari Express dan database supaya bisa di-unit test.
 * `deps` berisi fungsi database, hash password, token, dan sleep.
 */
function createAuthService(deps) {
  async function authenticate(authorizationHeader) {
    const match = /^Bearer (.+)$/.exec(authorizationHeader || '');
    if (!match) return null;

    let payload;
    try {
      payload = deps.verifyToken(match[1]);
    } catch {
      return null;
    }

    const id = Number(payload && payload.sub);
    if (!Number.isInteger(id)) return null;
    return deps.findUserById(id);
  }

  async function login(body) {
    const rawUsername = body && typeof body.username === 'string' ? body.username : '';
    const password = body && typeof body.password === 'string' ? body.password : '';
    const remember = Boolean(body && body.remember === true);
    const username = rawUsername.trim().toLowerCase();

    if (!username || !password) {
      const fields = {};
      if (!username) fields.username = MESSAGES.usernameRequired;
      if (!password) fields.password = MESSAGES.passwordRequired;
      return fail(400, 'VALIDATION_ERROR', MESSAGES.requiredBoth, fields);
    }

    if (username.length < config.USERNAME_MIN || username.length > config.USERNAME_MAX) {
      return fail(400, 'VALIDATION_ERROR', MESSAGES.usernameLength, {
        username: MESSAGES.usernameLength,
      });
    }

    const failures = await deps.countRecentFailedAttempts(username, config.RATE_LIMIT_WINDOW_MINUTES);
    if (failures >= config.RATE_LIMIT_MAX_FAILURES) {
      return fail(429, 'TOO_MANY_ATTEMPTS', MESSAGES.tooManyAttempts);
    }

    const user = await deps.findUserByUsername(username);
    const passwordOk = user ? await deps.comparePassword(password, user.password_hash) : false;
    if (!user || !passwordOk) {
      await deps.recordFailedAttempt(username);
      return fail(401, 'INVALID_CREDENTIALS', MESSAGES.invalidCredentials);
    }

    await deps.clearFailedAttempts(username);

    if (user.behavior === 'locked') {
      return fail(423, 'ACCOUNT_LOCKED', MESSAGES.accountLocked);
    }
    if (user.behavior === 'error') {
      return fail(500, 'INTERNAL_ERROR', MESSAGES.serverError);
    }
    if (user.behavior === 'slow') {
      await deps.sleep(config.SLOW_USER_DELAY_MS);
    }

    const expiresIn = remember ? config.REMEMBER_TTL_SECONDS : config.TOKEN_TTL_SECONDS;
    const token = deps.signToken(
      { sub: String(user.id), username: user.username, role: user.role },
      expiresIn,
    );

    return { status: 200, body: { data: { token, expiresIn, user: publicUser(user) } } };
  }

  async function me(authorizationHeader) {
    const user = await authenticate(authorizationHeader);
    if (!user) return fail(401, 'UNAUTHORIZED', MESSAGES.unauthorized);
    return { status: 200, body: { data: publicUser(user) } };
  }

  // Reset Data: kosongkan hitungan gagal login + kembalikan katalog produk ke 24 produk awal
  async function reset(authorizationHeader) {
    const user = await authenticate(authorizationHeader);
    if (!user) return fail(401, 'UNAUTHORIZED', MESSAGES.unauthorized);
    await deps.clearFailedAttempts(user.username);
    // Keranjang & pesanan akun ini dikosongkan; katalog hanya untuk akun admin (pemilik toko)
    if (deps.resetShopping) await deps.resetShopping(user.id);
    if (deps.resetCatalog && user.role === 'admin') await deps.resetCatalog(user.id);
    return { status: 204 };
  }

  function conflict(taken) {
    const fields = {};
    if (taken.username) fields.username = REGISTER_MESSAGES.usernameTaken;
    if (taken.email) fields.email = REGISTER_MESSAGES.emailTaken;
    return fail(409, 'ALREADY_EXISTS', REGISTER_MESSAGES.alreadyExists, fields);
  }

  async function register(body) {
    const now = deps.now ? deps.now() : new Date();
    const { errors, value } = validateRegister(body, now);
    if (Object.keys(errors).length > 0) {
      return fail(400, 'VALIDATION_ERROR', REGISTER_MESSAGES.formInvalid, errors);
    }

    // Akun registrasi berumur > 24 jam dihapus dulu, supaya username/email-nya bisa dipakai lagi
    await deps.deleteExpiredUsers();

    const taken = await deps.findTakenIdentifiers(value.username, value.email);
    if (taken.username || taken.email) return conflict(taken);

    const passwordHash = await deps.hashPassword(value.password);
    const newUser = {
      username: value.username,
      name: value.fullName,
      passwordHash,
      email: value.email,
      phone: value.phone,
      birthDate: value.birthDate,
      gender: value.gender,
    };

    let created;
    try {
      created = await deps.createUser(newUser);
    } catch (err) {
      // Dua request bersamaan dengan data yang sama: yang kedua ditolak database (unique)
      if (err && err.code === '23505') {
        const again = await deps.findTakenIdentifiers(value.username, value.email);
        return conflict(again.username || again.email ? again : { username: true });
      }
      throw err;
    }

    return { status: 201, body: { data: { user: publicUser(created) } } };
  }

  return { login, me, reset, register, authenticate };
}

module.exports = { createAuthService, publicUser };
