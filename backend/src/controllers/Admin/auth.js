import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { verifySync as verifyTotpSync } from 'otplib'
import { db } from '../../../db/index.js'
import { REFRESH_TOKEN_TTL_MS } from '../../config/constants.js'
import { adminUsers, adminSessions, adminAuditLogs } from '../../../db/schema/admin.js'
import { generateOpaqueRefreshToken, hashToken } from '../../utils/crypto.js'
import {
  signAccessTokenAdmin,
  signTotpStepToken,
  verifyTotpStepToken,
} from '../../utils/jwt.js'

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
  return req.socket?.remoteAddress || ''
}

async function insertAudit(staffId, action, req, extra = {}) {
  await db.insert(adminAuditLogs).values({
    adminId: staffId,
    action,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'] || null,
    ...extra,
  })
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

    const refreshToken = generateOpaqueRefreshToken()
    const tokenHash = hashToken(refreshToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

    await db.insert(adminSessions).values({
      adminId: row.id,
      tokenHash,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'] || null,
      expiresAt,
    })

    await db
      .update(adminUsers)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: clientIp(req),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, row.id))

    await insertAudit(row.id, 'admin_login', req)

    const accessToken = signAccessTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    return res.json({
      accessToken,
      refreshToken,
      admin: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
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

    const refreshToken = generateOpaqueRefreshToken()
    const tokenHash = hashToken(refreshToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

    await db.insert(adminSessions).values({
      adminId: row.id,
      tokenHash,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'] || null,
      expiresAt,
    })

    await db
      .update(adminUsers)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: clientIp(req),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, row.id))

    await insertAudit(row.id, 'admin_login_totp', req)

    const accessToken = signAccessTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    return res.json({
      accessToken,
      refreshToken,
      admin: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
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

    const tokenHash = hashToken(refreshToken)
    const [session] = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.tokenHash, tokenHash))
      .limit(1)

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.adminId)).limit(1)
    if (!row || !row.isActive) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const newRt = generateOpaqueRefreshToken()
    const newHash = hashToken(newRt)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

    await db
      .update(adminSessions)
      .set({
        tokenHash: newHash,
        expiresAt,
      })
      .where(eq(adminSessions.id, session.id))

    const accessToken = signAccessTokenAdmin({
      id: row.id,
      email: row.email,
      role: row.role,
    })

    return res.json({
      accessToken,
      refreshToken: newRt,
      admin: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Refresh failed' })
  }
}

export async function logout(req, res) {
  try {
    const { refreshToken } = req.body || {}
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken required' })
    }
    if (!req.admin?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const tokenHash = hashToken(refreshToken)
    const [session] = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.tokenHash, tokenHash))
      .limit(1)

    if (!session || session.adminId !== req.admin.id) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    await db
      .update(adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(adminSessions.id, session.id))

    await insertAudit(req.admin.id, 'admin_logout', req)

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Logout failed' })
  }
}

export async function me(req, res) {
  try {
    const [row] = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        name: adminUsers.name,
        role: adminUsers.role,
        totpEnabled: adminUsers.totpEnabled,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, req.admin.id))
      .limit(1)

    if (!row) {
      return res.status(404).json({ error: 'Not found' })
    }
    return res.json({ admin: row })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed' })
  }
}
