import { verifyAccessToken } from '../../utils/jwt.js'

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = header.slice('Bearer '.length)
    const payload = verifyAccessToken(token)
    if (payload.type !== 'user') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.user = {
      id: payload.sub,
      handle: payload.handle,
    }
    return next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
