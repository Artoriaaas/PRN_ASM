/**
 * Dev JWT (HS256) — cho phép chạy local/demo nhanh mà không cần đăng nhập Firebase.
 *
 * ⚠️ Đây là đường tắt CHỈ DÙNG CHO DEV/DEMO: secret nằm trong bundle nên ai đọc JS cũng
 * ký được token (kể cả claim role=admin). Vì vậy:
 *   - Build DEV (`vite dev`): luôn bật, dùng secret mặc định bên dưới.
 *   - Build PROD (Vercel/nginx): CHỈ bật khi set env `VITE_DEV_AUTH_SECRET` (>= 32 ký tự),
 *     và giá trị đó phải TRÙNG với `Auth:DevSecret` của backend (`Auth__DevSecret` trong compose).
 *   - Không set env ⇒ `isDevAuthEnabled === false`, mọi hàm trả `null` và FE không gắn
 *     Authorization header giả ⇒ buộc đăng nhập Firebase thật.
 */

const DEV_SECRET_FALLBACK = 'sudoku-platform-insecure-dev-jwt-secret-key-2026-minimum-32-chars!'

const configuredSecret = (import.meta.env.VITE_DEV_AUTH_SECRET as string | undefined)?.trim()

/** Secret đang dùng để ký dev token (rỗng = dev-auth bị tắt). */
export const DEV_AUTH_SECRET =
  configuredSecret && configuredSecret.length >= 32
    ? configuredSecret
    : import.meta.env.DEV
      ? DEV_SECRET_FALLBACK
      : ''

/** Dev-auth có đang bật không. */
export const isDevAuthEnabled = DEV_AUTH_SECRET.length >= 32

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

async function buildDevToken(
  sub: string,
  email: string,
  name: string,
  role?: string,
): Promise<string | null> {
  if (!isDevAuthEnabled) return null

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
    new TextEncoder().encode(DEV_AUTH_SECRET),
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

/** Token guest (không có role). Trả `null` khi dev-auth bị tắt. */
export async function getDevToken(sub = 'guest-solo-user'): Promise<string | null> {
  if (!isDevAuthEnabled) return null

  const now = Date.now()
  if (cachedDevToken && now - cachedTime < 3600000) {
    return cachedDevToken
  }
  const token = await buildDevToken(sub, 'guest@sudoku.local', 'Guest Solo')
  if (!token) return null
  cachedDevToken = token
  cachedTime = now
  return token
}

let cachedAdminToken: string | null = null
let cachedAdminTime = 0

/** Dev-token mang claim role=admin cho tài khoản dev-admin. Trả `null` khi dev-auth bị tắt. */
export async function getAdminDevToken(): Promise<string | null> {
  if (!isDevAuthEnabled) return null

  const now = Date.now()
  if (cachedAdminToken && now - cachedAdminTime < 3600000) {
    return cachedAdminToken
  }
  const token = await buildDevToken(DEV_ADMIN_UID, DEV_ADMIN_EMAIL, 'Sudoku Admin', 'admin')
  if (!token) return null
  cachedAdminToken = token
  cachedAdminTime = now
  return token
}
