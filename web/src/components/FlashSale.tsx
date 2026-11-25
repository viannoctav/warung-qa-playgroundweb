import { useEffect, useState } from 'react'

const CLAIM_KEY = 'wqa_flash_claimed'
const VISIBLE_MS = 15000

type Phase = 'waiting' | 'ready' | 'expired' | 'claimed'

function randomDelay() {
  return 3000 + Math.floor(Math.random() * 5001) // 3–8 detik
}

// Latihan "wait": tombol Klaim muncul setelah 3–8 detik acak, lalu hilang lagi setelah 15 detik.
export default function FlashSale() {
  const [phase, setPhase] = useState<Phase>(() => (sessionStorage.getItem(CLAIM_KEY) ? 'claimed' : 'waiting'))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (phase === 'waiting') {
      const timer = window.setTimeout(() => setPhase('ready'), randomDelay())
      return () => window.clearTimeout(timer)
    }
    if (phase === 'ready') {
      const timer = window.setTimeout(() => setPhase('expired'), VISIBLE_MS)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [phase])

  function claim() {
    sessionStorage.setItem(CLAIM_KEY, '1')
    setPhase('claimed')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText('FLASH15')
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="flash-sale" id="flash-sale-banner" data-testid="flash-sale-banner" aria-label="Flash sale" aria-live="polite">
      <div className="flash-sale-text">
        <strong>Flash sale:</strong> diskon 15% (maks Rp 30.000) untuk belanja minimal Rp 75.000.
      </div>
      {phase === 'waiting' && (
        <span className="flash-sale-wait" id="flash-sale-loading" data-testid="flash-sale-loading">
          <span className="spinner-dot" aria-hidden="true" />
          Menyiapkan voucher…
        </span>
      )}
      {phase === 'ready' && (
        <button type="button" className="btn btn-primary btn-sm" id="flash-sale-claim-btn" data-testid="flash-sale-claim-btn" onClick={claim}>
          Klaim voucher
        </button>
      )}
      {phase === 'expired' && (
        <span className="flash-sale-wait" id="flash-sale-expired" data-testid="flash-sale-expired">
          Waktu klaim habis.{' '}
          <button type="button" className="link-btn" id="flash-sale-retry-btn" data-testid="flash-sale-retry-btn" onClick={() => setPhase('waiting')}>
            Coba lagi
          </button>
        </span>
      )}
      {phase === 'claimed' && (
        <span className="flash-sale-code">
          Kode kamu:{' '}
          <code id="flash-sale-code" data-testid="flash-sale-code">
            FLASH15
          </code>
          <button type="button" className="btn btn-secondary btn-sm" id="flash-sale-copy-btn" data-testid="flash-sale-copy-btn" onClick={copy}>
            {copied ? 'Tersalin' : 'Salin'}
          </button>
        </span>
      )}
    </section>
  )
}
