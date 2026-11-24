import { Link } from '../router'

type Props = {
  title: string
  pageId: string
}

// Halaman sementara untuk fitur yang belum dibuat (Registrasi, Lupa password)
export default function ComingSoonPage({ title, pageId }: Props) {
  return (
    <main className="auth-page" id={`${pageId}-page`} data-testid={`${pageId}-page`}>
      <div className="auth-card">
        <p className="brand">Warung QA</p>
        <h1 id={`${pageId}-title`} data-testid={`${pageId}-title`}>
          {title}
        </h1>
        <p className="muted" id="coming-soon-message" data-testid="coming-soon-message">
          Fitur segera hadir.
        </p>
        <Link to="/login" id="coming-soon-back-link" data-testid="coming-soon-back-link">
          Kembali ke halaman login
        </Link>
      </div>
    </main>
  )
}
