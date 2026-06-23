import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { verifySync as verifyTotpSync } from 'otplib'
import { db } from '../../../db/index.js'
import { adminUsers } from '../../../db/schema/admin.js'
import {
  signAccessTokenAdmin,
  signRefreshTokenAdmin,
  signTotpStepToken,
  verifyAdminRefreshToken,
  verifyTotpStepToken,
} from '../../utils/jwt.js'
import { resolveTabsForAdmin } from '../../config/adminPermissions.js'

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
  return req.socket?.remoteAddress || ''
}

function serializeAdmin(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    teamRolePreset: row.teamRolePreset ?? null,
    totpEnabled: row.totpEnabled,
    tabs: resolveTabsForAdmin(row),
    createdAt: row.createdAt,
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const [row] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, normalizedEmail))
      .limit(1)

    if (!row || !row.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const ok = await bcrypt.compare(String(password), row.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (row.totpEnabled) {
      if (!row.totpSecret) {
        return res.status(500).json({ error: 'TOTP misconfigured' })
      }
      const totpToken = signTotpStepToken(row.id)
      return res.json({ requireTotp: true, totpToken })
    }

    const refreshToken = signRefreshTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    await db
      .update(adminUsers)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: clientIp(req),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, row.id))

    const accessToken = signAccessTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    return res.json({
      accessToken,
      refreshToken,
      admin: serializeAdmin(row),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Login failed' })
  }
}

export async function verifyTotp(req, res) {
  try {
    const { totpToken, code } = req.body || {}
    if (!totpToken || !code) {
      return res.status(400).json({ error: 'totpToken and code required' })
    }

    let payload
    try {
      payload = verifyTotpStepToken(totpToken)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired step token' })
    }

    const staffId = payload.sub
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, staffId)).limit(1)
    if (!row || !row.isActive || !row.totpSecret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const valid = verifyTotpSync({
      secret: row.totpSecret,
      token: String(code).trim(),
    })
    if (!valid) {
      return res.status(401).json({ error: 'Invalid authenticator code' })
    }

    const refreshToken = signRefreshTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    await db
      .update(adminUsers)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: clientIp(req),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, row.id))

    const accessToken = signAccessTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    return res.json({
      accessToken,
      refreshToken,
      admin: serializeAdmin(row),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Verification failed' })
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body || {}
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken required' })
    }

    let payload
    try {
      payload = verifyAdminRefreshToken(refreshToken)
    } catch {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, payload.sub)).limit(1)
    if (!row || !row.isActive) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const accessToken = signAccessTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })
    const nextRefreshToken = signRefreshTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    return res.json({
      accessToken,
      refreshToken: nextRefreshToken,
      admin: serializeAdmin(row),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Refresh failed' })
  }
}

export async function me(req, res) {
  try {
    const [row] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, req.admin.id))
      .limit(1)

    if (!row) {
      return res.status(404).json({ error: 'Not found' })
    }
    return res.json({ admin: serializeAdmin(row) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed' })
  }
}
