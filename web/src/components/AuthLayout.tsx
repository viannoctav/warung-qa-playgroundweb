import type { ReactNode } from 'react'

type Props = {
  pageId: string
  children: ReactNode
}

// Tata letak split: kiri logo Warung QA, kanan form
export default function AuthLayout({ pageId, children }: Props) {
  return (
    <main className="auth-split" id={pageId} data-testid={pageId}>
      <aside className="brand-panel">
        <img
          src="/logo-warung-qa-dark.png"
          alt="Warung QA"
          className="brand-logo"
          id="brand-logo"
          data-testid="brand-logo"
          width={640}
          height={570}
        />
      </aside>

      <section className="form-panel">
        <div className="form-panel-inner">{children}</div>
      </section>
    </main>
  )
}
