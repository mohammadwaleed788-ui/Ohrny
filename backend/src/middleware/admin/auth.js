import { verifyAccessToken } from '../../utils/jwt.js'

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = header.slice('Bearer '.length)
    const payload = verifyAccessToken(token)
    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.admin = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    }
    return next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

export function requireRole(...allowedRoles) {
  const normalized = new Set((allowedRoles || []).map((role) => String(role || '').trim()))
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: 'Unauthorized' })
    if (normalized.size === 0 || normalized.has(req.admin.role)) return next()
    return res.status(403).json({ error: 'Forbidden' })
  }
}
