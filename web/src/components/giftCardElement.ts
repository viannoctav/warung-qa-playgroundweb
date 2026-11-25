// <wqa-gift-card>: web component dengan shadow DOM (mode open) untuk latihan locator.
// Isi shadow root punya id/data-testid sendiri. Saat tombol Pakai diklik, elemen mengirim event
// "gift-card-apply" (bubbles + composed) dengan detail { code }. Halaman induk menjawab dengan
// atribut status ("idle" | "loading" | "applied" | "error") dan message.

const TEMPLATE = `
<style>
  :host { display: block; font-family: inherit; color: #e7ebf5; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  input {
    flex: 1 1 200px; height: 44px; padding: 0 14px; box-sizing: border-box;
    border: 1px solid #27324c; border-radius: 8px; background: #1b2439; color: #e7ebf5;
    font: inherit; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;
  }
  input::placeholder { text-transform: none; color: #8e98b3; }
  input:focus-visible, button:focus-visible { outline: 2px solid #ffb15c; outline-offset: 2px; }
  input[aria-invalid="true"] { border-color: #ff6b72; }
  button {
    height: 44px; padding: 0 16px; border: 1px solid #36425f; border-radius: 8px;
    background: transparent; color: #e7ebf5; font: inherit; font-weight: 600; cursor: pointer;
  }
  button:disabled { opacity: 0.6; cursor: wait; }
  p { margin: 6px 0 0; min-height: 20px; font-size: 0.85rem; }
  .error { color: #ff8a90; }
  .applied { color: #42d392; }
</style>
<label for="gift-card-input" style="display:block;margin-bottom:6px;font-size:.9rem;font-weight:500">Gift card</label>
<div class="row">
  <input id="gift-card-input" data-testid="checkout-gift-card-input" name="giftCard" placeholder="Contoh: GIFT-7788-WQA" maxlength="20" autocomplete="off">
  <button type="button" id="gift-card-apply-btn" data-testid="checkout-gift-card-apply-btn">Pakai</button>
</div>
<p id="gift-card-message" data-testid="checkout-gift-card-message" role="status"></p>
`

class GiftCardElement extends HTMLElement {
  static get observedAttributes() {
    return ['status', 'message', 'value']
  }

  private root: ShadowRoot

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })
    this.root.innerHTML = TEMPLATE
    const input = this.root.querySelector('input') as HTMLInputElement
    const button = this.root.querySelector('button') as HTMLButtonElement
    const apply = () => {
      const code = input.value.trim().toUpperCase()
      this.dispatchEvent(new CustomEvent('gift-card-apply', { detail: { code }, bubbles: true, composed: true }))
    }
    button.addEventListener('click', apply)
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        apply()
      }
    })
    input.addEventListener('input', () => {
      this.dispatchEvent(new CustomEvent('gift-card-input', { bubbles: true, composed: true }))
    })
  }

  attributeChangedCallback() {
    const input = this.root.querySelector('input') as HTMLInputElement
    const button = this.root.querySelector('button') as HTMLButtonElement
    const message = this.root.querySelector('p') as HTMLParagraphElement
    const status = this.getAttribute('status') ?? 'idle'
    const value = this.getAttribute('value')
    if (value !== null && value !== input.value) input.value = value
    button.disabled = status === 'loading'
    button.textContent = status === 'loading' ? 'Mengecek…' : 'Pakai'
    message.textContent = this.getAttribute('message') ?? ''
    message.className = status === 'error' ? 'error' : status === 'applied' ? 'applied' : ''
    input.setAttribute('aria-invalid', status === 'error' ? 'true' : 'false')
  }
}

export function defineGiftCardElement() {
  if (!customElements.get('wqa-gift-card')) customElements.define('wqa-gift-card', GiftCardElement)
}
