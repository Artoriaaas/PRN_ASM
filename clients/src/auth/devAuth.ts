const DEV_SECRET = 'sudoku-platform-insecure-dev-jwt-secret-key-2026-minimum-32-chars!'

/** UID cố định của tài khoản dev-admin được seed sẵn vào user_db */
export const DEV_ADMIN_UID = 'dev-admin-sudoku-fixed-uid-0001'
export const DEV_ADMIN_EMAIL = 'sudokuadmin@gmail.com'
export const DEV_ADMIN_PASSWORD = 'Admin@123'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function buildDevToken(sub: string, email: string, name: string, role?: string): Promise<string> {
  const now = Date.now()
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload: Record<string, unknown> = {
    sub,
    email,
    name,
    iss: 'sudoku-dev-auth',
    aud: 'sudoku-platform',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  }
  if (role) payload.role = role

  const h64 = toBase64Url(new TextEncoder().encode(JSON.stringify(header)))
  const p64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const data = new TextEncoder().encode(`${h64}.${p64}`)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(DEV_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, data)
  const s64 = toBase64Url(new Uint8Array(signature))
  return `${h64}.${p64}.${s64}`
}

let cachedDevToken: string | null = null
let cachedTime = 0

export async function getDevToken(sub = 'guest-solo-user'): Promise<string> {
  const now = Date.now()
  if (cachedDevToken && now - cachedTime < 3600000) {
    return cachedDevToken
  }
  const token = await buildDevToken(sub, 'guest@sudoku.local', 'Guest Solo')
  cachedDevToken = token
  cachedTime = now
  return token
}

let cachedAdminToken: string | null = null
let cachedAdminTime = 0

/** Trả về dev-token HS256 mang claim role=admin cho tài khoản dev-admin */
export async function getAdminDevToken(): Promise<string> {
  const now = Date.now()
  if (cachedAdminToken && now - cachedAdminTime < 3600000) {
    return cachedAdminToken
  }
  const token = await buildDevToken(DEV_ADMIN_UID, DEV_ADMIN_EMAIL, 'Sudoku Admin', 'admin')
  cachedAdminToken = token
  cachedAdminTime = now
  return token
}
