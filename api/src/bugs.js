// Akun latihan bug_user (behavior 'buggy') sengaja berperilaku salah di beberapa tempat.
// Semua pengecekan memakai fungsi ini, jadi akun lain tidak pernah terpengaruh.
function isBuggy(user) {
  return Boolean(user && user.behavior === 'buggy');
}

module.exports = { isBuggy };
