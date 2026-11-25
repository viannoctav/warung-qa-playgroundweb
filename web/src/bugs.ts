import { getStoredUser } from './auth'

// Akun latihan bug_user sengaja berperilaku salah di beberapa tempat.
// Semua pengecekan di web memakai fungsi ini, jadi akun lain tidak pernah terpengaruh.
export function isBugUser(): boolean {
  return getStoredUser()?.username === 'bug_user'
}
