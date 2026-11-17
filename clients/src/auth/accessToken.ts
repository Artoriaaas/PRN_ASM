/**
 * Chọn access token để gắn vào request — CHỈ Ở ĐÂY, mọi client khác đều gọi hàm này.
 *
 * Thứ tự:
 *   1. Dev-admin session (sessionStorage "dev-admin-active") → dev token có role=admin.
 *   2. Firebase đang đăng nhập → Firebase ID token.
 *   3. Dev token guest (chỉ khi dev-auth bật — xem `devAuth.ts`).
 *   4. Không có gì → `null` (không gắn header; endpoint public vẫn dùng được,
 *      endpoint protected sẽ trả Unauthenticated thay vì gửi token giả).
 */

import { auth } from './firebase'
import { getAdminDevToken, getDevToken, isDevAuthEnabled } from './devAuth'

const DEV_ADMIN_FLAG = 'dev-admin-active'

export function isDevAdminSession(): boolean {
  if (!isDevAuthEnabled) return false
  try {
    return sessionStorage.getItem(DEV_ADMIN_FLAG) === 'true'
  } catch {
    return false
  }
}

export function startDevAdminSession(): void {
  try {
    sessionStorage.setItem(DEV_ADMIN_FLAG, 'true')
  } catch {
    /* ignore */
  }
}

export function clearDevAdminSession(): void {
  try {
    sessionStorage.removeItem(DEV_ADMIN_FLAG)
  } catch {
    /* ignore */
  }
}

export async function getAccessToken(fallbackSub = 'guest-solo-user'): Promise<string | null> {
  if (isDevAdminSession()) {
    return getAdminDevToken()
  }

  const user = auth.currentUser
  if (user) {
    try {
      return await user.getIdToken()
    } catch {
      return getDevToken(fallbackSub)
    }
  }

  return getDevToken(fallbackSub)
}

/** Headers cho REST JSON (không gắn Authorization nếu không có token). */
export async function getJsonAuthHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  const token = await getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}
