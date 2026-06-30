import { verifyAccessToken } from '../utils/jwt.js'

export function adminSocketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) return next(new Error('Authentication required'))

    const payload = verifyAccessToken(token)
    if (payload.type !== 'admin') return next(new Error('Forbidden'))

    socket.adminId = payload.sub
    socket.adminRole = payload.role
    next()
  } catch {
    next(new Error('Invalid or expired token'))
  }
}
