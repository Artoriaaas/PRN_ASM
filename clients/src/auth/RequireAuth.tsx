import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/** Bảo vệ route — chuyển về /auth nếu chưa đăng nhập */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="splash-screen" aria-live="polite">
        <div className="brand-logo-splash" aria-hidden="true">9</div>
        <div className="loader" />
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <>{children}</>
}

/** Bảo vệ route admin — cần claim role=admin (future) */
export function RequireAdmin({ children }: { children: ReactNode }) {
  // TODO: kiểm tra custom claim khi có admin
  return <RequireAuth>{children}</RequireAuth>
}
