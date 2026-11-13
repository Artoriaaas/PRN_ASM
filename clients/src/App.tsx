import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import type { UserProfile } from './gen/sudoku/user/v1/user_pb'
import { useAuth } from './auth/useAuth'
import { getCachedProfile, syncUserProfile, clearCachedProfile } from './api/userClient'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { AuthPage } from './features/auth/AuthPage'
import { LandingPage } from './features/landing/LandingPage'
import { NotFoundPage } from './features/error/NotFoundPage'
import './styles/tokens.css'
import './styles/global.css'
import './index.css'
import './App.css'

// Lazy load các màn hình — bundle chính chỉ có Auth + Landing + Board
const HomePage = lazy(() => import('./features/home/HomePage').then((m) => ({ default: m.HomePage })))
const SoloSetupPage = lazy(() => import('./features/solo/SoloSetupPage').then((m) => ({ default: m.SoloSetupPage })))
const SoloPlayPage = lazy(() => import('./features/solo/SoloPlayPage').then((m) => ({ default: m.SoloPlayPage })))
const SoloResultPage = lazy(() => import('./features/solo/SoloResultPage').then((m) => ({ default: m.SoloResultPage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const MultiplayerLobbyPage = lazy(() =>
  import('./features/multiplayer/MultiplayerLobbyPage').then((m) => ({
    default: m.MultiplayerLobbyPage,
  })),
)
const MultiplayerQueuePage = lazy(() =>
  import('./features/multiplayer/MultiplayerQueuePage').then((m) => ({
    default: m.MultiplayerQueuePage,
  })),
)
const MultiplayerMatchPage = lazy(() =>
  import('./features/multiplayer/MultiplayerMatchPage').then((m) => ({
    default: m.MultiplayerMatchPage,
  })),
)
const MultiplayerResultPage = lazy(() =>
  import('./features/multiplayer/MultiplayerResultPage').then((m) => ({
    default: m.MultiplayerResultPage,
  })),
)
const LearnPage = lazy(() => import('./features/learn/LearnPage').then((m) => ({ default: m.LearnPage })))
const LessonPage = lazy(() => import('./features/learn/LessonPage').then((m) => ({ default: m.LessonPage })))

function PageLoader() {
  return (
    <div className="splash-screen" aria-live="polite">
      <div className="loader" />
    </div>
  )
}

function getProfileSyncError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Không thể đồng bộ hồ sơ. Vui lòng thử lại.'
  }

  if (/unauthenticated|401/i.test(error.message)) {
    return 'Không thể xác thực với User Service. Vui lòng đăng nhập lại hoặc thử lại.'
  }

  return error.message || 'Không thể đồng bộ hồ sơ. Vui lòng thử lại.'
}

function AppRoutes() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState('')
  const [profileSyncAttempt, setProfileSyncAttempt] = useState(0)

  // Hydrate profile từ cache + sync
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      setProfileLoadError('')
      return
    }

    const cached = getCachedProfile(user.uid)
    setProfile(cached)
    setProfileLoading(!cached)
    setProfileLoadError('')

    const controller = new AbortController()
    syncUserProfile(user, controller.signal)
      .then((syncedProfile) => {
        if (!controller.signal.aborted) {
          setProfile(syncedProfile)
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProfileLoadError(getProfileSyncError(error))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setProfileLoading(false)
        }
      })

    return () => controller.abort()
  }, [user, profileSyncAttempt])

  const handleProfileRetry = useCallback(() => {
    if (user) {
      clearCachedProfile(user.uid)
    }
    setProfileSyncAttempt((attempt) => attempt + 1)
  }, [user])

  const handleProfileUpdated = useCallback((p: UserProfile) => {
    setProfile(p)
    setProfileLoadError('')
    setProfileLoading(false)
  }, [])

  if (authLoading && !window.location.pathname.startsWith('/preview')) {
    return (
      <div className="splash-screen" aria-live="polite">
        <div className="brand-logo-splash" aria-hidden="true">
          <img src="/logo.png" alt="Sudoku Online" />
        </div>
        <div className="loader" />
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </div>
    )
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <AuthPage />} />
        {import.meta.env.DEV && (
          <>
            <Route
              path="/preview"
              element={
                <AppShell
                  profile={
                    {
                      displayName: 'Khoa Nguyen',
                      email: 'khoanguyen@example.com',
                      avatarUrl: '',
                      totalGames: 42,
                      wins: 35,
                      totalExp: 3850,
                      playerLevel: 4,
                      trophies: 12,
                    } as unknown as UserProfile
                  }
                >
                  <HomePage
                    profile={
                      {
                        displayName: 'Khoa Nguyen',
                        email: 'khoanguyen@example.com',
                        avatarUrl: '',
                        totalGames: 42,
                        wins: 35,
                        totalExp: 3850,
                        playerLevel: 4,
                        trophies: 12,
                      } as unknown as UserProfile
                    }
                    loading={false}
                  />
                </AppShell>
              }
            />
            <Route
              path="/preview/play"
              element={
                <AppShell
                  profile={
                    {
                      displayName: 'Khoa Nguyen',
                      email: 'khoanguyen@example.com',
                      avatarUrl: '',
                      totalGames: 42,
                      wins: 35,
                      totalExp: 3850,
                      playerLevel: 4,
                      trophies: 12,
                    } as unknown as UserProfile
                  }
                >
                  <MultiplayerLobbyPage
                    profile={
                      {
                        displayName: 'Khoa Nguyen',
                        email: 'khoanguyen@example.com',
                        avatarUrl: '',
                        totalGames: 42,
                        wins: 35,
                        totalExp: 3850,
                        playerLevel: 4,
                        trophies: 12,
                      } as unknown as UserProfile
                    }
                  />
                </AppShell>
              }
            />
            <Route
              path="/preview/learn"
              element={
                <AppShell
                  profile={
                    {
                      displayName: 'Khoa Nguyen',
                      email: 'khoanguyen@example.com',
                      avatarUrl: '',
                      totalGames: 42,
                      wins: 35,
                      totalExp: 3850,
                      playerLevel: 4,
                      trophies: 12,
                    } as unknown as UserProfile
                  }
                >
                  <LearnPage />
                </AppShell>
              }
            />
            <Route
              path="/preview/learn/:lessonCode"
              element={
                <AppShell
                  profile={
                    {
                      displayName: 'Khoa Nguyen',
                      email: 'khoanguyen@example.com',
                      avatarUrl: '',
                      totalGames: 42,
                      wins: 35,
                      totalExp: 3850,
                      playerLevel: 4,
                      trophies: 12,
                    } as unknown as UserProfile
                  }
                >
                  <LessonPage />
                </AppShell>
              }
            />
          </>
        )}

        {/* Private — bọc AppShell */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell profile={profile}>
                <Routes>
                  <Route path="/home" element={<HomePage profile={profile} loading={profileLoading} />} />
                  <Route path="/solo/new" element={<SoloSetupPage />} />
                  <Route path="/solo/:sessionId" element={<SoloPlayPage />} />
                  <Route path="/solo/:sessionId/result" element={<SoloResultPage />} />
                  <Route
                    path="/profile/:userId?"
                    element={
                      user ? (
                        <ProfilePage
                          user={user}
                          profile={profile}
                          loading={profileLoading}
                          loadError={profileLoadError}
                          view="profile"
                          onNavigate={(path) => navigate(path)}
                          onRetry={handleProfileRetry}
                          onUpdated={handleProfileUpdated}
                        />
                      ) : null
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      user ? (
                        <ProfilePage
                          user={user}
                          profile={profile}
                          loading={profileLoading}
                          loadError={profileLoadError}
                          view="settings"
                          onNavigate={(path) => navigate(path)}
                          onRetry={handleProfileRetry}
                          onUpdated={handleProfileUpdated}
                        />
                      ) : null
                    }
                  />
                  {/* Multiplayer Screens */}
                  <Route path="/play" element={<MultiplayerLobbyPage profile={profile} />} />
                  <Route path="/play/queue" element={<MultiplayerQueuePage profile={profile} />} />
                  <Route path="/match/:matchId" element={<MultiplayerMatchPage profile={profile} />} />
                  <Route path="/match/:matchId/result" element={<MultiplayerResultPage profile={profile} />} />
                  <Route path="/leaderboard" element={<ComingSoon title="Bảng xếp hạng" />} />
                  <Route path="/history" element={<ComingSoon title="Lịch sử đấu" />} />
                  <Route path="/quests" element={<ComingSoon title="Nhiệm vụ" />} />
                  <Route path="/learn" element={<LearnPage />} />
                  <Route path="/learn/:lessonCode" element={<LessonPage />} />
                  <Route path="/hoc" element={<Navigate to="/learn" replace />} />
                  <Route path="/hoc/:lessonCode" element={<LessonPage />} />
                  <Route path="/notices" element={<ComingSoon title="Thông báo hệ thống" />} />
                  <Route path="/tournaments" element={<ComingSoon title="Giải đấu" />} />
                  <Route path="/tournaments/new" element={<ComingSoon title="Tạo giải đấu" />} />
                  <Route path="/tournaments/:id" element={<ComingSoon title="Chi tiết giải đấu" />} />
                  <Route path="/admin/*" element={<ComingSoon title="Admin" />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="coming-soon">
      <p className="eyebrow">SẮP RA MẮT</p>
      <h2>{title}</h2>
      <p>Màn hình này đang được phát triển.</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  )
}
