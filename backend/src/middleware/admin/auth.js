import { eq } from 'drizzle-orm'
import { verifyAccessToken } from '../../utils/jwt.js'
import { db } from '../../../db/index.js'
import { adminUsers } from '../../../db/schema/admin.js'
import { adminHasTab, isSuperAdmin, resolveTabsForAdmin } from '../../config/adminPermissions.js'

async function attachAdminFromDb(adminId, base = {}) {
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1)

  if (!row || !row.isActive) return null

  return {
    ...base,
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    teamRolePreset: row.teamRolePreset ?? null,
    tabs: resolveTabsForAdmin(row),
  }
}

export function requireAuth(req, res, next) {
  ;(async () => {
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

      const admin = await attachAdminFromDb(payload.sub, {
        email: payload.email,
        role: payload.role,
      })
      if (!admin) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      req.admin = admin
      return next()
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  })()
}

export function requireRole(...allowedRoles) {
  const normalized = new Set((allowedRoles || []).map((role) => String(role || '').trim()))
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: 'Unauthorized' })
    if (normalized.size === 0 || normalized.has(req.admin.role)) return next()
    return res.status(403).json({ error: 'Forbidden' })
  }
}

export function requireTab(...tabIds) {
  const required = [...new Set((tabIds || []).map((tab) => String(tab || '').trim()).filter(Boolean))]
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: 'Unauthorized' })
    if (isSuperAdmin(req.admin)) return next()
    if (required.length === 0) return next()
    if (required.some((tabId) => adminHasTab(req.admin, tabId))) return next()
    return res.status(403).json({ error: 'Forbidden' })
  }
}
