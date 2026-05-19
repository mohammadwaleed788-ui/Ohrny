import { verifyAccessToken } from '../utils/jwt.js'

export function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) return next(new Error('Authentication required'))

    const payload = verifyAccessToken(token)
    if (payload.type !== 'user') return next(new Error('Forbidden'))

    socket.userId = payload.sub
    socket.userHandle = payload.handle
    next()
  } catch {
    next(new Error('Invalid or expired token'))
  }
}
