/**
 * Nguồn duy nhất quyết định backend base URL của frontend.
 *
 * Mục tiêu: đổi backend (quick tunnel mới, Vercel, local...) chỉ cần sửa CONFIG,
 * không phải sửa code / build lại.
 *
 * Thứ tự ưu tiên:
 *   1. Query string: https://app.vercel.app/?api=https://xxx.trycloudflare.com
 *      → đồng thời lưu vào localStorage để các lần sau không cần thêm query.
 *      Dùng `?api=reset` để xoá override.
 *   2. localStorage["prnasm.apiBase"] (do bước 1 hoặc setApiBase() ghi vào).
 *   3. <meta name="api-base" content="..."> trong index.html.
 *   4. VITE_API_URL (env của Vercel/CI/docker build).
 *   5. Chuỗi rỗng = same-origin (khi web và API cùng host qua nginx proxy).
 */

const STORAGE_KEY = 'prnasm.apiBase'

function normalize(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value || value === '/' || value === '.') return null
  return value.replace(/\/+$/, '')
}

function readStored(): string | null {
  try {
    return normalize(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function persist(value: string | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode / storage bị chặn: bỏ qua, chỉ dùng giá trị trong RAM */
  }
}

let cached: string | null = null

function resolveApiBase(): string {
  if (typeof window === 'undefined') return ''

  const params = new URLSearchParams(window.location.search)
  if (params.has('api')) {
    const raw = params.get('api')
    if (raw && raw.trim().toLowerCase() === 'reset') {
      persist(null)
    } else {
      const fromQuery = normalize(raw)
      if (fromQuery) {
        persist(fromQuery)
        return fromQuery
      }
    }
  }

  const fromStorage = readStored()
  if (fromStorage) return fromStorage

  const metaContent = document.querySelector('meta[name="api-base"]')?.getAttribute('content')
  const fromMeta = normalize(metaContent)
  if (fromMeta) return fromMeta

  return normalize(import.meta.env.VITE_API_URL) ?? ''
}

/** Base URL hiện tại. '' = same-origin. */
export function getApiBase(): string {
  if (cached === null) cached = resolveApiBase()
  return cached
}

/** Ghi đè base URL (dùng cho debug/demo). `null` để quay về config mặc định. */
export function setApiBase(raw: string | null | undefined): void {
  const value = normalize(raw)
  persist(value)
  cached = value ?? resolveApiBase()
}

/** Ghép path với base; base rỗng thì trả path tương đối (same-origin). */
export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getApiBase()}${normalizedPath}`
}

/**
 * URL tuyệt đối — bắt buộc cho WebSocket / SignalR
 * (trình duyệt không nhận URL tương đối cho `new WebSocket(...)`).
 */
export function getAbsoluteApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = getApiBase()
  if (base) return `${base}${normalizedPath}`
  if (typeof window === 'undefined') return normalizedPath
  return `${window.location.origin}${normalizedPath}`
}
