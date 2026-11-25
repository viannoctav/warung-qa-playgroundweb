import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiError, createOrder, fetchCart, previewCheckout } from '../api'
import type { Cart, Summary } from '../api'
import AppShell from '../components/AppShell'
import GiftCardField from '../components/GiftCardField'
import ShipDatePicker from '../components/ShipDatePicker'
import { announceCartCount } from '../cart'
import { errorMessage, handleUnauthorized } from '../errors'
import { Link, navigate } from '../router'
import {
  CHECKOUT_MESSAGES,
  COD_MAX_TOTAL,
  EMPTY_ADDRESS,
  PAYMENT_OPTIONS,
  SHIPPING_OPTIONS,
  formatDateLong,
  validateAddress,
  validateShipDate,
} from '../validation/checkout'
import type { AddressField, AddressValues } from '../validation/checkout'
import { formatRupiah } from '../validation/product'

type Step = 1 | 2 | 3
const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Alamat' },
  { step: 2, label: 'Pengiriman' },
  { step: 3, label: 'Pembayaran' },
]

const ADDRESS_FIELDS: { field: AddressField; label: string; type?: string; placeholder: string; multiline?: boolean; optional?: boolean }[] = [
  { field: 'recipientName', label: 'Nama penerima', placeholder: 'Budi Santoso' },
  { field: 'phone', label: 'Nomor HP', type: 'tel', placeholder: '081234567890' },
  { field: 'address', label: 'Alamat lengkap', placeholder: 'Jl. Kenanga No. 5, RT 01/RW 02', multiline: true },
  { field: 'city', label: 'Kota', placeholder: 'Bekasi' },
  { field: 'postalCode', label: 'Kode pos', placeholder: '17111' },
  { field: 'notes', label: 'Catatan untuk kurir', placeholder: 'Titip ke satpam', multiline: true, optional: true },
]

function kebab(field: string) {
  return field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

function FieldMessage({ id, message }: { id: string; message?: string | null }) {
  return (
    <div className="field-message">
      {message && (
        <p className="field-error" id={id} data-testid={id} role="alert">
          {message}
        </p>
      )}
    </div>
  )
}

function CheckoutContent({ token }: { token: string }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>(1)

  const [address, setAddress] = useState<AddressValues>(EMPTY_ADDRESS)
  const [touched, setTouched] = useState<Partial<Record<AddressField, boolean>>>({})
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<AddressField, string>>>({})

  const [shipping, setShipping] = useState('')
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [payment, setPayment] = useState('')
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const [shipDate, setShipDate] = useState('')
  const [shipDateTouched, setShipDateTouched] = useState(false)
  const [shipDateServerError, setShipDateServerError] = useState<string | null>(null)

  const [giftCode, setGiftCode] = useState('')
  const [giftStatus, setGiftStatus] = useState<'idle' | 'loading' | 'applied' | 'error'>('idle')
  const [giftMessage, setGiftMessage] = useState('')

  // WarungPay: hasil pembayaran dari iframe (postMessage)
  const [paid, setPaid] = useState<{ ref: string; amount: number } | null>(null)

  const [voucherInput, setVoucherInput] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState('')
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchCart(token)
      .then((data) => {
        if (cancelled) return
        setCart(data)
        announceCartCount(data.itemCount)
      })
      .catch((err: unknown) => {
        if (!cancelled && !handleUnauthorized(err)) setLoadError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Ringkasan dihitung server setiap metode pengiriman atau voucher berubah
  useEffect(() => {
    if (!cart || cart.items.length === 0) return
    let cancelled = false
    previewCheckout(token, shipping || 'reguler', appliedVoucher, giftCode)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch((err: unknown) => {
        if (cancelled || handleUnauthorized(err)) return
        if (err instanceof ApiError && err.fields?.voucherCode) {
          setAppliedVoucher('')
          setVoucherError(err.fields.voucherCode)
        } else if (err instanceof ApiError && err.fields?.giftCardCode) {
          setGiftCode('')
          setGiftStatus('error')
          setGiftMessage(err.fields.giftCardCode)
        } else {
          setSubmitError(errorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, cart, shipping, appliedVoucher, giftCode])

  // Terima pesan dari iframe WarungPay (hanya dari asal yang sama)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; paymentRef?: string; amount?: number }
      if (data?.type === 'warungpay:paid' && data.paymentRef && typeof data.amount === 'number') {
        setPaid({ ref: data.paymentRef, amount: data.amount })
        setPaymentError(null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  async function applyGiftCard(code: string) {
    if (!code) {
      setGiftStatus('error')
      setGiftMessage(CHECKOUT_MESSAGES.giftCardRequired)
      return
    }
    setGiftStatus('loading')
    setGiftMessage('')
    try {
      const data = await previewCheckout(token, shipping || 'reguler', appliedVoucher, code)
      setSummary(data)
      setGiftCode(data.giftCardCode ?? '')
      setGiftStatus('applied')
      setGiftMessage(`Gift card ${data.giftCardCode} dipakai: potongan ${formatRupiah(data.giftCardDiscount)}`)
    } catch (err) {
      if (handleUnauthorized(err)) return
      setGiftStatus('error')
      setGiftMessage(err instanceof ApiError && err.fields?.giftCardCode ? err.fields.giftCardCode : errorMessage(err))
    }
  }

  const addressErrors = validateAddress(address)
  const addressError = (field: AddressField) =>
    serverFieldErrors[field] ?? (touched[field] ? addressErrors[field] : undefined)

  function setField(field: AddressField, value: string) {
    setAddress((current) => ({ ...current, [field]: value }))
    setServerFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function goToShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ recipientName: true, phone: true, address: true, city: true, postalCode: true, notes: true })
    if (Object.keys(addressErrors).length > 0) {
      const first = Object.keys(addressErrors)[0]
      document.getElementById(`checkout-${kebab(first)}-input`)?.focus()
      return
    }
    setStep(2)
  }

  const shipDateError = shipDateServerError ?? (shipDateTouched ? validateShipDate(shipDate) : undefined)

  function goToPayment() {
    setShipDateTouched(true)
    const dateError = validateShipDate(shipDate)
    if (!shipping) setShippingError(CHECKOUT_MESSAGES.shippingMethod)
    if (!shipping || dateError) {
      if (!shipping) document.getElementById('checkout-shipping-reguler-radio')?.focus()
      else document.getElementById('checkout-ship-date-input')?.focus()
      return
    }
    setStep(3)
  }

  async function applyVoucher() {
    const code = voucherInput.trim()
    if (!code) {
      setVoucherError(CHECKOUT_MESSAGES.voucherRequired)
      return
    }
    setApplying(true)
    setVoucherError(null)
    try {
      const data = await previewCheckout(token, shipping || 'reguler', code)
      setSummary(data)
      setAppliedVoucher(data.voucherCode ?? '')
      setVoucherInput(data.voucherCode ?? code)
    } catch (err) {
      if (handleUnauthorized(err)) return
      setVoucherError(err instanceof ApiError && err.fields?.voucherCode ? err.fields.voucherCode : errorMessage(err))
    } finally {
      setApplying(false)
    }
  }

  function removeVoucher() {
    setAppliedVoucher('')
    setVoucherInput('')
    setVoucherError(null)
  }

  async function placeOrder() {
    if (submitLock.current) return
    setSubmitError(null)
    if (!payment) {
      setPaymentError(CHECKOUT_MESSAGES.paymentMethod)
      return
    }
    if (payment === 'cod' && summary && summary.total > COD_MAX_TOTAL) {
      setPaymentError(CHECKOUT_MESSAGES.codLimit)
      return
    }
    if (payment === 'ewallet' && (!paid || (summary && paid.amount !== summary.total))) {
      setPaymentError(CHECKOUT_MESSAGES.paymentRefRequired)
      return
    }

    submitLock.current = true
    setSubmitting(true)
    try {
      const order = await createOrder(token, {
        ...address,
        shippingMethod: shipping,
        paymentMethod: payment,
        voucherCode: appliedVoucher,
        giftCardCode: giftCode,
        shipDate,
        paymentRef: payment === 'ewallet' && paid ? paid.ref : '',
      })
      announceCartCount(0)
      navigate(`/checkout/success/${order.orderNumber}`, true)
    } catch (err) {
      submitLock.current = false
      setSubmitting(false)
      if (handleUnauthorized(err)) return
      const fields = err instanceof ApiError ? err.fields ?? {} : {}
      const addressFields = Object.keys(fields).filter((f) => ADDRESS_FIELDS.some((a) => a.field === f))
      if (addressFields.length > 0) {
        setServerFieldErrors(fields as Partial<Record<AddressField, string>>)
        setStep(1)
      }
      if (fields.shippingMethod) {
        setShippingError(fields.shippingMethod)
        setStep(2)
      }
      if (fields.shipDate) {
        setShipDateServerError(fields.shipDate)
        setStep(2)
      }
      if (fields.paymentMethod) setPaymentError(fields.paymentMethod)
      if (fields.paymentRef) {
        setPaymentError(fields.paymentRef)
        setPaid(null)
      }
      if (fields.giftCardCode) {
        setGiftCode('')
        setGiftStatus('error')
        setGiftMessage(fields.giftCardCode)
      }
      if (fields.voucherCode) {
        setVoucherError(fields.voucherCode)
        setAppliedVoucher('')
      }
      setSubmitError(errorMessage(err))
    }
  }

  if (loadError) {
    return (
      <main className="page" id="checkout-page" data-testid="checkout-page">
        <div className="alert alert-error" id="checkout-error-alert" data-testid="checkout-error-alert" role="alert">
          {loadError}
        </div>
      </main>
    )
  }

  if (!cart) {
    return (
      <main className="page" id="checkout-page" data-testid="checkout-page">
        <p className="empty-panel">Memuat keranjang…</p>
      </main>
    )
  }

  if (cart.items.length === 0) {
    return (
      <main className="page" id="checkout-page" data-testid="checkout-page">
        <div className="empty-panel" id="checkout-empty" data-testid="checkout-empty">
          <p>Keranjang masih kosong, belum ada yang bisa di-checkout.</p>
          <Link to="/shop" className="btn btn-primary" id="checkout-shop-link" data-testid="checkout-shop-link">
            Mulai belanja
          </Link>
        </div>
      </main>
    )
  }

  const shippingCost = shipping && summary ? summary.shippingCost : null
  const discount = summary?.discount ?? 0
  const giftDiscount = summary?.giftCardDiscount ?? 0
  const total = summary ? (shipping ? summary.total : summary.subtotal - discount - giftDiscount) : cart.subtotal
  // Pembayaran WarungPay hanya berlaku untuk nominal yang dibayar; kalau total berubah harus bayar ulang
  const paidForTotal = paid !== null && summary !== null && paid.amount === summary.total

  let panel: ReactNode
  if (step === 1) {
    panel = (
      <form className="form" id="checkout-address-form" data-testid="checkout-address-form" onSubmit={goToShipping} noValidate>
        <h2>Alamat pengiriman</h2>
        <div className="form-grid">
          {ADDRESS_FIELDS.map(({ field, label, type, placeholder, multiline, optional }) => {
            const id = `checkout-${kebab(field)}`
            const message = addressError(field)
            const common = {
              id: `${id}-input`,
              'data-testid': `${id}-input`,
              name: field,
              placeholder,
              value: address[field],
              'aria-invalid': message ? true : undefined,
              'aria-describedby': message ? `${id}-error` : undefined,
              onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
            }
            return (
              <div className={`field${multiline ? ' field-wide' : ''}`} key={field}>
                <label htmlFor={`${id}-input`}>
                  {label}
                  {optional && <span className="muted"> (opsional)</span>}
                </label>
                {multiline ? (
                  <textarea {...common} rows={3} onChange={(e) => setField(field, e.target.value)} />
                ) : (
                  <input {...common} type={type ?? 'text'} onChange={(e) => setField(field, e.target.value)} />
                )}
                <FieldMessage id={`${id}-error`} message={message} />
              </div>
            )
          })}
        </div>
        <div className="form-actions">
          <Link to="/cart" className="btn btn-ghost" id="checkout-back-cart-link" data-testid="checkout-back-cart-link">
            Kembali ke keranjang
          </Link>
          <button type="submit" className="btn btn-primary" id="checkout-address-next-btn" data-testid="checkout-address-next-btn">
            Lanjut ke pengiriman
          </button>
        </div>
      </form>
    )
  } else if (step === 2) {
    panel = (
      <div className="form" id="checkout-shipping-step" data-testid="checkout-shipping-step">
        <h2 id="checkout-shipping-legend">Metode pengiriman</h2>
        <div className="option-list" role="radiogroup" aria-labelledby="checkout-shipping-legend">
          {SHIPPING_OPTIONS.map((option) => (
            <label className={`option-card${shipping === option.value ? ' is-checked' : ''}`} key={option.value}>
              <input
                type="radio"
                name="shippingMethod"
                value={option.value}
                id={`checkout-shipping-${option.value}-radio`}
                data-testid={`checkout-shipping-${option.value}-radio`}
                checked={shipping === option.value}
                onChange={() => {
                  setShipping(option.value)
                  setShippingError(null)
                }}
              />
              <span className="option-card-text">
                <strong>{option.label}</strong>
                <span className="muted">{option.eta}</span>
              </span>
              <span className="option-card-price">{formatRupiah(option.cost)}</span>
            </label>
          ))}
        </div>
        <FieldMessage id="checkout-shipping-error" message={shippingError} />
        <ShipDatePicker
          value={shipDate}
          error={shipDateError}
          onChange={(value) => {
            setShipDate(value)
            setShipDateServerError(null)
            setShipDateTouched(value.length >= 10)
          }}
        />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" id="checkout-shipping-back-btn" data-testid="checkout-shipping-back-btn" onClick={() => setStep(1)}>
            Kembali
          </button>
          <button type="button" className="btn btn-primary" id="checkout-shipping-next-btn" data-testid="checkout-shipping-next-btn" onClick={goToPayment}>
            Lanjut ke pembayaran
          </button>
        </div>
      </div>
    )
  } else {
    panel = (
      <div className="form" id="checkout-payment-step" data-testid="checkout-payment-step">
        <h2 id="checkout-payment-legend">Metode pembayaran</h2>
        <div className="option-list" role="radiogroup" aria-labelledby="checkout-payment-legend">
          {PAYMENT_OPTIONS.map((option) => (
            <label className={`option-card${payment === option.value ? ' is-checked' : ''}`} key={option.value}>
              <input
                type="radio"
                name="paymentMethod"
                value={option.value}
                id={`checkout-payment-${option.value}-radio`}
                data-testid={`checkout-payment-${option.value}-radio`}
                checked={payment === option.value}
                onChange={() => {
                  setPayment(option.value)
                  setPaymentError(null)
                }}
              />
              <span className="option-card-text">
                <strong>{option.label}</strong>
                <span className="muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldMessage id="checkout-payment-error" message={paymentError} />

        {payment === 'ewallet' && summary && (
          <div className="warungpay-box" id="checkout-warungpay" data-testid="checkout-warungpay">
            {paidForTotal ? (
              <p className="field-success" role="status" id="checkout-warungpay-paid" data-testid="checkout-warungpay-paid">
                Lunas lewat WarungPay ({paid?.ref}). Lanjutkan dengan Buat pesanan.
              </p>
            ) : (
              <>
                {paid && (
                  <p className="field-error" role="alert" id="checkout-warungpay-stale" data-testid="checkout-warungpay-stale">
                    Total berubah setelah dibayar. Bayar ulang dengan nominal baru.
                  </p>
                )}
                <iframe
                  key={summary.total}
                  title="Pembayaran WarungPay"
                  src={`/warungpay?amount=${summary.total}`}
                  id="checkout-warungpay-iframe"
                  data-testid="checkout-warungpay-iframe"
                  className="warungpay-frame"
                />
              </>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="checkout-voucher-input">Kode voucher</label>
          <div className="input-action">
            <input
              type="text"
              id="checkout-voucher-input"
              data-testid="checkout-voucher-input"
              name="voucherCode"
              placeholder="Contoh: HEMAT10"
              autoComplete="off"
              value={voucherInput}
              disabled={appliedVoucher !== ''}
              maxLength={20}
              aria-invalid={voucherError ? true : undefined}
              onChange={(e) => {
                setVoucherInput(e.target.value)
                setVoucherError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyVoucher()
                }
              }}
            />
            {appliedVoucher ? (
              <button type="button" className="btn btn-secondary" id="checkout-voucher-remove-btn" data-testid="checkout-voucher-remove-btn" onClick={removeVoucher}>
                Hapus
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                id="checkout-voucher-apply-btn"
                data-testid="checkout-voucher-apply-btn"
                disabled={applying}
                onClick={applyVoucher}
              >
                {applying ? 'Mengecek…' : 'Pakai'}
              </button>
            )}
          </div>
          <div className="field-message">
            {voucherError && (
              <p className="field-error" id="checkout-voucher-error" data-testid="checkout-voucher-error" role="alert">
                {voucherError}
              </p>
            )}
            {appliedVoucher && !voucherError && (
              <p className="field-success" id="checkout-voucher-success" data-testid="checkout-voucher-success">
                Voucher {appliedVoucher} dipakai
              </p>
            )}
          </div>
        </div>

        <GiftCardField
          status={giftStatus}
          message={giftMessage}
          onApply={applyGiftCard}
          onInput={() => {
            if (giftStatus === 'error') {
              setGiftStatus('idle')
              setGiftMessage('')
            }
          }}
        />

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" id="checkout-payment-back-btn" data-testid="checkout-payment-back-btn" onClick={() => setStep(2)}>
            Kembali
          </button>
          <button
            type="button"
            className="btn btn-primary"
            id="checkout-place-order-btn"
            data-testid="checkout-place-order-btn"
            disabled={submitting}
            onClick={placeOrder}
          >
            {submitting ? 'Memproses pesanan…' : `Buat pesanan (${formatRupiah(total)})`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="page" id="checkout-page" data-testid="checkout-page">
      <div className="page-head">
        <h1 id="checkout-title" data-testid="checkout-title">
          Checkout
        </h1>
      </div>

      <ol className="wizard-steps" id="checkout-steps" data-testid="checkout-steps">
        {STEPS.map(({ step: s, label }) => (
          <li
            key={s}
            className={s === step ? 'is-current' : s < step ? 'is-done' : undefined}
            id={`checkout-step-${s}`}
            data-testid={`checkout-step-${s}`}
            aria-current={s === step ? 'step' : undefined}
          >
            <span className="wizard-step-number">{s}</span>
            {label}
          </li>
        ))}
      </ol>

      {submitError && (
        <div className="alert alert-error" id="checkout-error-alert" data-testid="checkout-error-alert" role="alert">
          {submitError}{' '}
          {(submitError.includes('keranjang') || submitError.includes('Keranjang')) && (
            <Link to="/cart" id="checkout-error-cart-link" data-testid="checkout-error-cart-link">
              Buka keranjang
            </Link>
          )}
        </div>
      )}
      {cart.hasProblem && !submitError && (
        <div className="alert alert-error" id="checkout-problem-alert" data-testid="checkout-problem-alert" role="alert">
          Ada produk di keranjang yang stoknya tidak cukup atau sudah tidak dijual.{' '}
          <Link to="/cart">Buka keranjang</Link>
        </div>
      )}

      <div className="cart-layout">
        <section className="panel">{panel}</section>

        <aside className="summary-card" id="checkout-summary" data-testid="checkout-summary">
          <h2>Ringkasan pesanan</h2>
          <ul className="summary-items">
            {cart.items.map((item) => (
              <li key={item.product.id} id={`checkout-summary-item-${item.product.id}`} data-testid={`checkout-summary-item-${item.product.id}`}>
                <span>
                  {item.quantity} × {item.product.name}
                </span>
                <span>{formatRupiah(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="summary-list">
            <div>
              <dt>Subtotal</dt>
              <dd id="checkout-summary-subtotal" data-testid="checkout-summary-subtotal">
                {formatRupiah(summary?.subtotal ?? cart.subtotal)}
              </dd>
            </div>
            <div>
              <dt>Ongkir</dt>
              <dd id="checkout-summary-shipping" data-testid="checkout-summary-shipping">
                {shippingCost === null ? 'Pilih pengiriman' : shippingCost === 0 ? 'Gratis' : formatRupiah(shippingCost)}
              </dd>
            </div>
            {discount > 0 && (
              <div>
                <dt>Diskon {summary?.voucherCode}</dt>
                <dd id="checkout-summary-discount" data-testid="checkout-summary-discount">
                  −{formatRupiah(discount)}
                </dd>
              </div>
            )}
            {giftDiscount > 0 && (
              <div>
                <dt>Gift card</dt>
                <dd id="checkout-summary-gift-card" data-testid="checkout-summary-gift-card">
                  −{formatRupiah(giftDiscount)}
                </dd>
              </div>
            )}
            {shipDate && !validateShipDate(shipDate) && (
              <div>
                <dt>Tanggal kirim</dt>
                <dd id="checkout-summary-ship-date" data-testid="checkout-summary-ship-date">
                  {formatDateLong(shipDate)}
                </dd>
              </div>
            )}
            <div className="summary-total">
              <dt>Total</dt>
              <dd id="checkout-summary-total" data-testid="checkout-summary-total">
                {formatRupiah(total)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  )
}

export default function CheckoutPage() {
  return <AppShell>{({ token }) => <CheckoutContent token={token} />}</AppShell>
}
