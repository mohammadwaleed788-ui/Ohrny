import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { eq, and, desc, gte, lt } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { REFRESH_TOKEN_TTL_MS } from '../../config/constants.js'
import { users, userSessions } from '../../../db/schema/users.js'
import { phoneVerifications } from '../../../db/schema/safety.js'
import { generateOpaqueRefreshToken, hashToken } from '../../utils/crypto.js'
import { signAccessTokenUser } from '../../utils/jwt.js'

function normalizePhone(country, nationalDigits) {
  const c = String(country || '+1').trim() || '+1'
  const digits = String(nationalDigits || '').replace(/\D/g, '')
  return { phoneCountry: c.startsWith('+') ? c : `+${c}`, phone: digits }
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
  return req.socket?.remoteAddress || ''
}

async function issueTokens(accountId, req) {
  const refreshToken = generateOpaqueRefreshToken()
  const tokenHash = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

  await db.insert(userSessions).values({
    userId: accountId,
    tokenHash,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'] || null,
    expiresAt,
  })

  const [account] = await db.select().from(users).where(eq(users.id, accountId)).limit(1)
  const accessToken = signAccessTokenUser({ id: account.id, handle: account.handle })
  return { accessToken, refreshToken, user: account }
}

export async function sendOtp(req, res) {
  try {
    const { phone, phoneCountry } = req.body || {}
    const { phone: digits, phoneCountry: country } = normalizePhone(phoneCountry, phone)
    if (digits.length < 8) {
      return res.status(400).json({ error: 'Invalid phone number' })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = await bcrypt.hash(code, 10)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

    await db.delete(phoneVerifications).where(lt(phoneVerifications.expiresAt, now))

    await db
      .update(phoneVerifications)
      .set({ expiresAt: now })
      .where(
        and(
          eq(phoneVerifications.phone, digits),
          eq(phoneVerifications.phoneCountry, country),
          eq(phoneVerifications.verified, false),
        ),
      )

    await db.insert(phoneVerifications).values({
      phone: digits,
      phoneCountry: country,
      codeHash,
      expiresAt,
    })

    console.info(`[mock SMS] OTP for ${country}${digits}: ${code}`)

    return res.json({ ok: true, expiresIn: 600 })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to send code' })
  }
}

async function findOrCreateAccount(country, digits) {
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, digits), eq(users.phoneCountry, country)))
    .limit(1)

  if (existing) {
    await db
      .update(users)
      .set({ phoneVerified: true, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
    const [u] = await db.select().from(users).where(eq(users.id, existing.id)).limit(1)
    return { user: u, isNewUser: false }
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = crypto.randomBytes(4).toString('hex').slice(0, 7)
    const handle = `u${suffix}`
    try {
      await db.insert(users).values({
        handle,
        phone: digits,
        phoneCountry: country,
        phoneVerified: true,
        age: 18,
        iam: 'other',
        iamOther: 'Onboarding',
      })
      const [created] = await db
        .select()
        .from(users)
        .where(and(eq(users.phone, digits), eq(users.phoneCountry, country)))
        .limit(1)
      return { user: created, isNewUser: true }
    } catch (e) {
      if (e.code !== '23505') throw e
    }
  }
  throw new Error('Could not allocate handle')
}

export async function verifyOtp(req, res) {
  try {
    const { phone, phoneCountry, code } = req.body || {}
    const { phone: digits, phoneCountry: country } = normalizePhone(phoneCountry, phone)
    if (!code || String(code).length !== 6) {
      return res.status(400).json({ error: 'Invalid code' })
    }

    const attemptsWindowStart = new Date(Date.now() - 30 * 60 * 1000)
    const recentAttempts = await db
      .select({ attempts: phoneVerifications.attempts })
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.phone, digits),
          eq(phoneVerifications.phoneCountry, country),
          gte(phoneVerifications.createdAt, attemptsWindowStart),
        ),
      )

    const totalAttempts = recentAttempts.reduce((sum, row) => sum + row.attempts, 0)
    if (totalAttempts > 20) {
      return res.status(429).json({ error: 'Too many attempts, try later' })
    }

    const [row] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(eq(phoneVerifications.phone, digits), eq(phoneVerifications.phoneCountry, country)),
      )
      .orderBy(desc(phoneVerifications.createdAt))
      .limit(1)

    if (!row || row.verified) {
      return res.status(401).json({ error: 'No active verification' })
    }
    if (row.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Code expired' })
    }
    if (row.attempts >= 5) {
      return res.status(429).json({ error: 'Too many attempts' })
    }

    const match = await bcrypt.compare(String(code).trim(), row.codeHash)
    if (!match) {
      await db
        .update(phoneVerifications)
        .set({ attempts: row.attempts + 1 })
        .where(eq(phoneVerifications.id, row.id))
      return res.status(401).json({ error: 'Invalid code' })
    }

    await db
      .update(phoneVerifications)
      .set({ verified: true })
      .where(eq(phoneVerifications.id, row.id))

    const { user, isNewUser } = await findOrCreateAccount(country, digits)

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account suspended' })
    }
    if (user.deletedAt) {
      return res.status(403).json({ error: 'Account not available' })
    }

    const tokens = await issueTokens(user.id, req)
    return res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser,
      user: {
        id: tokens.user.id,
        handle: tokens.user.handle,
        phoneVerified: tokens.user.phoneVerified,
        plan: tokens.user.plan,
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
      .from(userSessions)
      .where(eq(userSessions.tokenHash, tokenHash))
      .limit(1)

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const [account] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
    if (!account || account.isBanned || account.deletedAt) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const newRt = generateOpaqueRefreshToken()
    const newHash = hashToken(newRt)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

    await db
      .update(userSessions)
      .set({
        tokenHash: newHash,
        expiresAt,
      })
      .where(eq(userSessions.id, session.id))

    const accessToken = signAccessTokenUser({ id: account.id, handle: account.handle })

    return res.json({
      accessToken,
      refreshToken: newRt,
      user: {
        id: account.id,
        handle: account.handle,
        plan: account.plan,
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
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const tokenHash = hashToken(refreshToken)
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.tokenHash, tokenHash))
      .limit(1)

    if (!session || session.userId !== req.user.id) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, session.id))

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Logout failed' })
  }
}

export async function logoutAll(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.userId, req.user.id))

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Logout all failed' })
  }
}

export async function me(req, res) {
  try {
    const [account] = await db
      .select({
        id: users.id,
        handle: users.handle,
        plan: users.plan,
        phoneVerified: users.phoneVerified,
        profileCompletePct: users.profileCompletePct,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1)

    if (!account) {
      return res.status(404).json({ error: 'Not found' })
    }
    return res.json({ user: account })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed' })
  }
}
