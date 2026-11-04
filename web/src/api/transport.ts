import type { Interceptor } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'
import { auth } from '../auth/firebase'

const firebaseAuthInterceptor: Interceptor = (next) => async (request) => {
  const user = auth.currentUser
  if (user) {
    request.header.set('Authorization', `Bearer ${await user.getIdToken()}`)
  }

  return next(request)
}

export const transport = createGrpcWebTransport({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  interceptors: [firebaseAuthInterceptor],
})
