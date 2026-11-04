import { useCallback, useEffect, useState } from 'react'
import { ConnectError } from '@connectrpc/connect'
import type { UserProfile } from './gen/sudoku/user/v1/user_pb'
import { useAuth } from './auth/useAuth'
import { getCachedProfile, syncUserProfile } from './api/userClient'
import { AuthPage } from './features/auth/AuthPage'
import { ProfilePage } from './features/profile/ProfilePage'
import './App.css'

type AccountPath = '/profile' | '/settings'

function replacePath(path: string) {
  window.history.replaceState({}, '', path)
}

function getLoadErrorMessage(error: unknown) {
  if (error instanceof ConnectError) {
    return error.rawMessage || 'Không thể kết nối User Service qua Envoy.'
  }

  return error instanceof Error ? error.message : 'Không thể tải hồ sơ.'
}

function App() {
  const { user, loading: authLoading } = useAuth()
  const [path, setPath] = useState(window.location.pathname)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const navigate = useCallback((nextPath: AccountPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }, [])

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      // oxlint-disable-next-line react/set-state-in-effect -- Clear the previous account after Firebase signs out.
      setProfile(null)
      if (window.location.pathname !== '/auth') {
        replacePath('/auth')
        setPath('/auth')
      }
      return
    }

    if (!['/profile', '/settings'].includes(window.location.pathname)) {
      replacePath('/profile')
      setPath('/profile')
    }
  }, [authLoading, user])

  useEffect(() => {
    if (!user) {
      return
    }

    const cachedProfile = getCachedProfile(user.uid)
    if (cachedProfile) {
      // oxlint-disable-next-line react/set-state-in-effect -- Hydrate immediately from the required session cache.
      setProfile(cachedProfile)
    }

    const controller = new AbortController()
    setProfileLoading(true)
    setProfileError('')

    syncUserProfile(user, controller.signal)
      .then(setProfile)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProfileError(getLoadErrorMessage(error))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setProfileLoading(false)
        }
      })

    return () => controller.abort()
  }, [user, reloadToken])

  if (authLoading) {
    return (
      <main className="splash-screen" aria-live="polite">
        <div className="brand-mark">9</div>
        <div className="loader" />
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </main>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  const view: AccountPath = path === '/settings' ? '/settings' : '/profile'

  return (
    <ProfilePage
      user={user}
      profile={profile}
      loading={profileLoading}
      loadError={profileError}
      view={view === '/settings' ? 'settings' : 'profile'}
      onNavigate={navigate}
      onRetry={() => setReloadToken((value) => value + 1)}
      onUpdated={setProfile}
    />
  )
}

export default App
