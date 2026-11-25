// Aturan validasi Registrasi, sesuai PRD Registrasi.
// Teks pesan di sini harus sama persis dengan yang tampil di browser.

const GENDERS = ['female', 'male', 'unspecified'];

const MESSAGES = {
  fullNameRequired: 'Nama lengkap wajib diisi',
  fullNameLength: 'Nama lengkap harus 3–50 karakter',
  fullNameChars: 'Nama lengkap hanya boleh berisi huruf, spasi, titik, dan apostrof',
  usernameRequired: 'Username wajib diisi',
  usernameLength: 'Username harus 3–30 karakter',
  usernameChars: 'Username hanya boleh berisi huruf, angka, dan garis bawah',
  usernameTaken: 'Username sudah dipakai',
  emailRequired: 'Email wajib diisi',
  emailFormat: 'Format email tidak valid',
  emailTaken: 'Email sudah terdaftar',
  phoneRequired: 'Nomor HP wajib diisi',
  phoneFormat: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
  birthDateRequired: 'Tanggal lahir wajib diisi',
  birthDateFormat: 'Format tanggal lahir harus YYYY-MM-DD',
  birthDateFuture: 'Tanggal lahir tidak boleh di masa depan',
  birthDateAge: 'Umur minimal 17 tahun',
  genderRequired: 'Pilih jenis kelamin',
  passwordRequired: 'Password wajib diisi',
  passwordLength: 'Password minimal 8 karakter',
  passwordComplexity: 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol',
  confirmPasswordRequired: 'Konfirmasi password wajib diisi',
  confirmPasswordMismatch: 'Konfirmasi password tidak sama',
  formInvalid: 'Data belum valid. Periksa kembali isian Anda.',
  alreadyExists: 'Username atau email sudah terdaftar',
};

const FULL_NAME_PATTERN = /^[\p{L} .']+$/u;
const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^(08\d{8,12}|\+628\d{7,11})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asString(value) {
  return typeof value === 'string' ? value : '';
}

// Tanggal hari ini (WIB) dalam format YYYY-MM-DD
function todayInJakarta(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isRealDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function validateBirthDate(value, now) {
  if (!value) return MESSAGES.birthDateRequired;
  if (!DATE_PATTERN.test(value) || !isRealDate(value)) return MESSAGES.birthDateFormat;
  const today = todayInJakarta(now);
  if (value > today) return MESSAGES.birthDateFuture;
  const [y, m, d] = today.split('-').map(Number);
  const cutoff = new Date(Date.UTC(y - 17, m - 1, d)).toISOString().slice(0, 10);
  if (value > cutoff) return MESSAGES.birthDateAge;
  return null;
}

function validatePassword(value) {
  if (!value) return MESSAGES.passwordRequired;
  if (value.length < 8) return MESSAGES.passwordLength;
  const complete = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
  if (!complete) return MESSAGES.passwordComplexity;
  return null;
}

/**
 * Memvalidasi body registrasi.
 * Mengembalikan { errors } (objek kosong kalau valid) dan { value } yang sudah dirapikan.
 */
function validateRegister(body, now = new Date()) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};

  const fullName = asString(input.fullName).trim().replace(/\s+/g, ' ');
  if (!fullName) errors.fullName = MESSAGES.fullNameRequired;
  else if (fullName.length < 3 || fullName.length > 50) errors.fullName = MESSAGES.fullNameLength;
  else if (!FULL_NAME_PATTERN.test(fullName)) errors.fullName = MESSAGES.fullNameChars;

  const username = asString(input.username).trim().toLowerCase();
  if (!username) errors.username = MESSAGES.usernameRequired;
  else if (username.length < 3 || username.length > 30) errors.username = MESSAGES.usernameLength;
  else if (!USERNAME_PATTERN.test(username)) errors.username = MESSAGES.usernameChars;

  const email = asString(input.email).trim().toLowerCase();
  if (!email) errors.email = MESSAGES.emailRequired;
  else if (!EMAIL_PATTERN.test(email)) errors.email = MESSAGES.emailFormat;

  const phone = asString(input.phone).trim();
  if (!phone) errors.phone = MESSAGES.phoneRequired;
  else if (!PHONE_PATTERN.test(phone)) errors.phone = MESSAGES.phoneFormat;

  const birthDate = asString(input.birthDate).trim();
  const birthDateError = validateBirthDate(birthDate, now);
  if (birthDateError) errors.birthDate = birthDateError;

  const gender = asString(input.gender);
  if (!GENDERS.includes(gender)) errors.gender = MESSAGES.genderRequired;

  const password = asString(input.password);
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  const confirmPassword = asString(input.confirmPassword);
  if (!confirmPassword) errors.confirmPassword = MESSAGES.confirmPasswordRequired;
  else if (confirmPassword !== password) errors.confirmPassword = MESSAGES.confirmPasswordMismatch;

  return {
    errors,
    value: {
      fullName,
      username,
      email,
      phone,
      birthDate,
      gender,
      password,
    },
  };
}

module.exports = { validateRegister, validatePassword, MESSAGES, GENDERS, todayInJakarta };
