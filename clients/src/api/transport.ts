import type { Interceptor } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'
import { auth } from '../auth/firebase'
import { getDevToken } from '../auth/devAuth'

const authInterceptor: Interceptor = (next) => async (request) => {
  const user = auth.currentUser
  if (user) {
    try {
      const token = await user.getIdToken()
      request.header.set('Authorization', `Bearer ${token}`)
    } catch {
      const devToken = await getDevToken()
      request.header.set('Authorization', `Bearer ${devToken}`)
    }
  } else {
    const devToken = await getDevToken()
    request.header.set('Authorization', `Bearer ${devToken}`)
  }

  return next(request)
}

export const transport = createGrpcWebTransport({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  interceptors: [authInterceptor],
})
