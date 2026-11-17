import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type IdTokenResult,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { AuthContext, type AuthContextValue } from './authContextValue'
import {
  getAdminDevToken,
  DEV_ADMIN_UID,
  DEV_ADMIN_EMAIL,
  DEV_ADMIN_PASSWORD,
  isDevAuthEnabled,
} from './devAuth'
import {
  clearDevAdminSession,
  isDevAdminSession,
  startDevAdminSession,
} from './accessToken'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// ---------------------------------------------------------------------------
// Dev-admin mock user: giả lập Firebase User object cho tài khoản admin local
// ---------------------------------------------------------------------------
function buildDevAdminUser(token: string): User {
  const claims = { role: 'admin' }
  const tokenResult: IdTokenResult = {
    token,
    claims,
    authTime: new Date().toISOString(),
    issuedAtTime: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 3600_000).toISOString(),
    signInProvider: 'password',
    signInSecondFactor: null,
  }
  return {
    uid: DEV_ADMIN_UID,
    email: DEV_ADMIN_EMAIL,
    emailVerified: true,
    displayName: 'Sudoku Admin',
    photoURL: null,
    phoneNumber: null,
    isAnonymous: false,
    metadata: { creationTime: undefined, lastSignInTime: undefined },
    providerData: [],
    refreshToken: '',
    tenantId: null,
    providerId: 'password',
    delete: async () => {},
    getIdToken: async () => token,
    getIdTokenResult: async (_forceRefresh?: boolean) => tokenResult,
    reload: async () => {},
    toJSON: () => ({ uid: DEV_ADMIN_UID }),
  } as unknown as User
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Nếu đã lưu dev-admin session, khôi phục ngay (chỉ khi dev-auth còn bật)
    if (isDevAdminSession()) {
      getAdminDevToken().then((token) => {
        if (!token) {
          clearDevAdminSession()
          setUser(null)
          setLoading(false)
          return
        }
        setUser(buildDevAdminUser(token))
        setLoading(false)
      })
      return
    }
    return onIdTokenChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Dev-admin shortcut: sudokuadmin@gmail.com / Admin@123 (chỉ khi dev-auth bật)
    if (isDevAuthEnabled && email.trim() === DEV_ADMIN_EMAIL && password === DEV_ADMIN_PASSWORD) {
      const token = await getAdminDevToken()
      if (token) {
        startDevAdminSession()
        setUser(buildDevAdminUser(token))
        return
      }
    }
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const register = useCallback(
    async (displayName: string, email: string, password: string) => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )
      await updateProfile(credential.user, { displayName: displayName.trim() })
      await sendEmailVerification(credential.user)
    },
    [],
  )

  const loginWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim())
  }, [])

  const resendVerification = useCallback(async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser)
    }
  }, [])

  const logout = useCallback(async () => {
    clearDevAdminSession()
    setUser(null)
    await signOut(auth)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      register,
      loginWithGoogle,
      resetPassword,
      resendVerification,
      logout,
    }),
    [
      user,
      loading,
      login,
      register,
      loginWithGoogle,
      resetPassword,
      resendVerification,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
