import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <section className="page">
      <h1 className="page-title">404</h1>
      <p className="page-description">The page you requested was not found.</p>
      <Link className="link" to="/">
        Go to Home
      </Link>
    </section>
  )
}
