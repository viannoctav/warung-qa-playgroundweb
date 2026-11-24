import { useEffect, useState } from 'react'
import { clearFlashToast, peekFlashToast } from '../auth'
import { TOAST_EVENT } from '../toast'

type Toast = { text: string; id: number }

let nextId = 1

// Menampilkan toast dari halaman sebelumnya (flash) atau dari showToast(), selama 3 detik
export default function FlashToast() {
  const [toast, setToast] = useState<Toast | null>(() => {
    const text = peekFlashToast()
    return text ? { text, id: nextId++ } : null
  })

  useEffect(() => {
    const onToast = (event: Event) => setToast({ text: (event as CustomEvent<string>).detail, id: nextId++ })
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  useEffect(() => {
    if (!toast) return
    clearFlashToast()
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div className="toast toast-success" id="toast-success" data-testid="toast-success" role="status" key={toast.id}>
      {toast.text}
    </div>
  )
}
