// Semua angka dan teks pesan di satu tempat, sesuai PRD Login.
module.exports = {
  RATE_LIMIT_MAX_FAILURES: 5,
  RATE_LIMIT_WINDOW_MINUTES: 15,
  SLOW_USER_DELAY_MS: 5000,
  TOKEN_TTL_SECONDS: 60 * 60, // 1 jam
  REMEMBER_TTL_SECONDS: 60 * 60 * 24 * 7, // 7 hari
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,

  MESSAGES: {
    requiredBoth: 'Username dan password wajib diisi',
    usernameRequired: 'Username wajib diisi',
    passwordRequired: 'Password wajib diisi',
    usernameLength: 'Username harus 3–30 karakter',
    invalidCredentials: 'Username atau password salah',
    accountLocked: 'Akun ini dikunci. Hubungi admin.',
    tooManyAttempts: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
    serverError: 'Terjadi kesalahan pada server. Coba lagi nanti.',
    unauthorized: 'Sesi tidak valid. Silakan login kembali.',
  },
};
