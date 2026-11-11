const DEV_SECRET = 'sudoku-platform-insecure-dev-jwt-secret-key-2026-minimum-32-chars!'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cachedDevToken: string | null = null
let cachedTime = 0

export async function getDevToken(sub = 'guest-solo-user'): Promise<string> {
  const now = Date.now()
  if (cachedDevToken && now - cachedTime < 3600000) {
    return cachedDevToken
  }

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub,
    email: 'guest@sudoku.local',
    name: 'Guest Solo',
    iss: 'sudoku-dev-auth',
    aud: 'sudoku-platform',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  }

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

  cachedDevToken = `${h64}.${p64}.${s64}`
  cachedTime = now
  return cachedDevToken
}
