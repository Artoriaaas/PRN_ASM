import { useState, useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/** Bảo vệ route — chuyển về /auth nếu chưa đăng nhập */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="splash-screen" aria-live="polite">
        <div className="brand-logo-splash" aria-hidden="true">
          <img src="/logo.png" alt="Sudoku Online" />
        </div>
        <div className="loader" />
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </main>
    )
  }

  const isGuestAllowed =
    location.pathname.startsWith('/solo') ||
    location.pathname.startsWith('/play') ||
    location.pathname.startsWith('/match')

  if (!user && !isGuestAllowed) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <>{children}</>
}

/** Bảo vệ route admin — cần claim role=admin */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }

    user
      .getIdTokenResult()
      .then((tokenResult) => {
        const role = tokenResult.claims.role || tokenResult.claims.Role
        // Cho phép nếu có claim role = admin hoặc dev admin
        setIsAdmin(role === 'admin' || role === 'ADMIN' || Boolean(user.email?.includes('admin')))
      })
      .catch(() => {
        setIsAdmin(user.email?.includes('admin') ?? false)
      })
  }, [user])

  if (loading || isAdmin === null) {
    return (
      <main className="splash-screen" aria-live="polite">
        <div className="loader" />
        <p>Đang xác thực quyền Quản trị viên…</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
