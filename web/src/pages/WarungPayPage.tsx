import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, payWarungPay } from '../api'
import { getToken } from '../auth'
import { formatRupiah } from '../validation/product'

// Halaman "payment gateway" palsu yang dibuka di dalam iframe Checkout.
// Setelah lunas, mengirim postMessage { type: 'warungpay:paid', paymentRef, amount } ke halaman induk.
export default function WarungPayPage() {
  const params = new URLSearchParams(window.location.search)
  const amount = Number(params.get('amount') ?? '0')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [paidRef, setPaidRef] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || paidRef) return
    const token = getToken()
    if (!token) {
      setMessage('Sesi habis. Muat ulang halaman Checkout.')
      return
    }
    setBusy(true)
    setErrors({})
    setMessage(null)
    try {
      const result = await payWarungPay(token, phone.trim(), pin, amount)
      setPaidRef(result.paymentRef)
      window.parent.postMessage({ type: 'warungpay:paid', paymentRef: result.paymentRef, amount: result.amount }, window.location.origin)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {})
        setMessage(err.message)
      } else {
        setMessage('Tidak dapat terhubung ke server.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="warungpay" id="warungpay-page" data-testid="warungpay-page">
      <div className="warungpay-head">
        <strong>WarungPay</strong>
        <span>Tagihan Warung QA</span>
      </div>
      <p className="warungpay-amount" id="warungpay-amount" data-testid="warungpay-amount">
        {formatRupiah(amount)}
      </p>
      {paidRef ? (
        <div className="warungpay-success" role="status" id="warungpay-success" data-testid="warungpay-success">
          Pembayaran berhasil. Ref <b id="warungpay-ref" data-testid="warungpay-ref">{paidRef}</b>
        </div>
      ) : (
        <form onSubmit={submit} noValidate id="warungpay-form" data-testid="warungpay-form">
          <label htmlFor="warungpay-phone-input">Nomor HP e-wallet</label>
          <input
            id="warungpay-phone-input"
            data-testid="warungpay-phone-input"
            type="tel"
            inputMode="tel"
            value={phone}
            placeholder="081234567890"
            aria-invalid={errors.phone ? true : undefined}
            onChange={(e) => setPhone(e.target.value)}
          />
          {errors.phone && (
            <p className="warungpay-error" id="warungpay-phone-error" data-testid="warungpay-phone-error">
              {errors.phone}
            </p>
          )}
          <label htmlFor="warungpay-pin-input">PIN (6 angka)</label>
          <input
            id="warungpay-pin-input"
            data-testid="warungpay-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            aria-invalid={errors.pin ? true : undefined}
            onChange={(e) => setPin(e.target.value)}
          />
          {errors.pin && (
            <p className="warungpay-error" id="warungpay-pin-error" data-testid="warungpay-pin-error">
              {errors.pin}
            </p>
          )}
          <button type="submit" id="warungpay-pay-btn" data-testid="warungpay-pay-btn" disabled={busy}>
            {busy ? 'Memproses…' : `Bayar ${formatRupiah(amount)}`}
          </button>
          {message && !errors.phone && !errors.pin && (
            <p className="warungpay-error" role="alert" id="warungpay-error" data-testid="warungpay-error">
              {message}
            </p>
          )}
          <p className="warungpay-note">Latihan: PIN 123456, saldo Rp 2.000.000.</p>
        </form>
      )}
    </main>
  )
}
