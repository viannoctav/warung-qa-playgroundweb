import { createElement, useEffect, useRef } from 'react'
import { defineGiftCardElement } from './giftCardElement'

type Props = {
  status: 'idle' | 'loading' | 'applied' | 'error'
  message: string
  onApply: (code: string) => void
  onInput: () => void
}

defineGiftCardElement()

// Pembungkus React untuk <wqa-gift-card> (isinya ada di shadow DOM)
export default function GiftCardField({ status, message, onApply, onInput }: Props) {
  const ref = useRef<HTMLElement>(null)
  const handlers = useRef({ onApply, onInput })
  handlers.current = { onApply, onInput }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = (event: Event) => handlers.current.onApply((event as CustomEvent<{ code: string }>).detail.code)
    const input = () => handlers.current.onInput()
    el.addEventListener('gift-card-apply', apply)
    el.addEventListener('gift-card-input', input)
    return () => {
      el.removeEventListener('gift-card-apply', apply)
      el.removeEventListener('gift-card-input', input)
    }
  }, [])

  return createElement('wqa-gift-card', {
    ref,
    id: 'checkout-gift-card',
    'data-testid': 'checkout-gift-card',
    status,
    message,
  })
}
