// Akun demo sesuai PRD Login. Semua memakai password yang sama.
// Email demo dipakai untuk skenario "Email sudah terdaftar" di Registrasi.
const DEMO_PASSWORD = 'Warung123!';

const DEMO_USERS = [
  { username: 'standard_user', name: 'Standard User', role: 'user', behavior: 'normal' },
  { username: 'admin_user', name: 'Admin User', role: 'admin', behavior: 'normal' },
  { username: 'locked_user', name: 'Locked User', role: 'user', behavior: 'locked' },
  { username: 'slow_user', name: 'Slow User', role: 'user', behavior: 'slow' },
  { username: 'error_user', name: 'Error User', role: 'user', behavior: 'error' },
].map((user) => ({ ...user, email: `${user.username}@warungqa.test` }));

module.exports = { DEMO_PASSWORD, DEMO_USERS };
