import { useEffect, useState } from 'react'
import type { AnchorHTMLAttributes, MouseEvent } from 'react'

// Router kecil tanpa library: cukup untuk beberapa halaman Warung QA.
const NAVIGATE_EVENT = 'wqa:navigate'

export function navigate(to: string, replace = false) {
  if (replace) {
    window.history.replaceState(null, '', to)
  } else {
    window.history.pushState(null, '', to)
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

function currentPath() {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '' ? '/' : path
}

export function usePath() {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const update = () => setPath(currentPath())
    window.addEventListener('popstate', update)
    window.addEventListener(NAVIGATE_EVENT, update)
    // Navigasi bisa terjadi sebelum listener terpasang (misalnya Redirect saat halaman pertama dibuka)
    update()
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(NAVIGATE_EVENT, update)
    }
  }, [])

  return path
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

export function Link({ to, onClick, ...rest }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    if (event.defaultPrevented || event.button !== 0 || modified) return
    event.preventDefault()
    navigate(to)
  }

  return <a href={to} onClick={handleClick} {...rest} />
}

export function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to, true)
  }, [to])
  return null
}
