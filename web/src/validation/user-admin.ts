// Validasi Kelola User di browser — memakai aturan & pesan Registrasi supaya sama persis dengan API.
import { MESSAGES, validateRegister } from './register'

export type ProfileValues = {
  fullName: string
  username: string
  email: string
  phone: string
  birthDate: string
  gender: string
}

export type ProfileField = keyof ProfileValues
export type ProfileErrors = Partial<Record<ProfileField, string>>

const DUMMY_PASSWORD = 'Dummy123!'

export function validateProfile(values: ProfileValues): ProfileErrors {
  const all = validateRegister({ ...values, password: DUMMY_PASSWORD, confirmPassword: DUMMY_PASSWORD })
  const errors: ProfileErrors = {}
  for (const field of Object.keys(values) as ProfileField[]) {
    if (all[field]) errors[field] = all[field]
  }
  return errors
}

export type PasswordValues = { newPassword: string; confirmPassword: string }
export type PasswordErrors = Partial<Record<keyof PasswordValues, string>>

export const NEW_PASSWORD_REQUIRED = 'Password baru wajib diisi'

export function validatePasswordChange(values: PasswordValues): PasswordErrors {
  const all = validateRegister({
    fullName: 'Nama Contoh',
    username: 'contoh',
    email: 'contoh@contoh.com',
    phone: '081234567890',
    birthDate: '1990-01-01',
    gender: 'female',
    password: values.newPassword,
    confirmPassword: values.confirmPassword,
  })
  const errors: PasswordErrors = {}
  if (all.password) errors.newPassword = all.password === MESSAGES.passwordRequired ? NEW_PASSWORD_REQUIRED : all.password
  if (all.confirmPassword) errors.confirmPassword = all.confirmPassword
  return errors
}

// Nilai yang dikirim ke API: sudah dirapikan dan hanya field yang berubah
export function changedFields(current: ProfileValues, initial: ProfileValues) {
  const clean: ProfileValues = {
    fullName: current.fullName.trim().replace(/\s+/g, ' '),
    username: current.username.trim().toLowerCase(),
    email: current.email.trim().toLowerCase(),
    phone: current.phone.trim(),
    birthDate: current.birthDate,
    gender: current.gender,
  }
  const diff: Partial<ProfileValues> = {}
  for (const field of Object.keys(clean) as ProfileField[]) {
    if (clean[field] !== initial[field]) diff[field] = clean[field]
  }
  return diff
}
