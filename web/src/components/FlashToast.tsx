import { useEffect, useState } from 'react'
import { clearFlashToast, peekFlashToast } from '../auth'

// Menampilkan pesan toast yang dititipkan dari halaman sebelumnya, selama 3 detik
export default function FlashToast() {
  const [message, setMessage] = useState<string | null>(peekFlashToast)

  useEffect(() => {
    if (!message) return
    clearFlashToast()
    const timer = window.setTimeout(() => setMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="toast toast-success" id="toast-success" data-testid="toast-success" role="status">
      {message}
    </div>
  )
}
