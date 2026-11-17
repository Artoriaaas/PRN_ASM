import type { Interceptor } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'
import { getApiBase } from './apiBase'
import { getAccessToken } from '../auth/accessToken'

const authInterceptor: Interceptor = (next) => async (request) => {
  const token = await getAccessToken()
  if (token) {
    request.header.set('Authorization', `Bearer ${token}`)
  }
  return next(request)
}

/**
 * Base URL lấy từ `apiBase.ts` (query ?api= / localStorage / meta / VITE_API_URL).
 * Rỗng ⇒ dùng origin hiện tại (web + nginx proxy cùng host).
 */
const baseUrl = getApiBase() || (typeof window === 'undefined' ? '' : window.location.origin)

export const transport = createGrpcWebTransport({
  baseUrl,
  interceptors: [authInterceptor],
})
