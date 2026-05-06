import bcrypt from 'bcrypt'
import { eq, and, desc, gte, lt } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import {
  users,
  userPhotos,
  userPrompts,
  userInterests,
  userLifestyle,
} from '../../../db/schema/users.js'
import { phoneVerifications } from '../../../db/schema/safety.js'
import { userPrivacySettings, userDiscoverPreferences } from '../../../db/schema/settings.js'
import {
  signAccessTokenUser,
  signRefreshTokenUser,
  signUserSignupToken,
  verifyUserRefreshToken,
  verifyUserSignupToken,
} from '../../utils/jwt.js'

function normalizePhone(country, nationalDigits) {
  const c = String(country || '+1').trim() || '+1'
  const digits = String(nationalDigits || '').replace(/\D/g, '')
  return { phoneCountry: c.startsWith('+') ? c : `+${c}`, phone: digits }
}

async function loadUserDetails(userId) {
  const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!account) return null

  const [lifestyle, privacySettings, discoverPreferences, photos, prompts, interests] = await Promise.all([
    db.select().from(userLifestyle).where(eq(userLifestyle.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userPrivacySettings).where(eq(userPrivacySettings.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userDiscoverPreferences).where(eq(userDiscoverPreferences.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userPhotos).where(eq(userPhotos.userId, userId)),
    db.select().from(userPrompts).where(eq(userPrompts.userId, userId)),
    db.select().from(userInterests).where(eq(userInterests.userId, userId)),
  ])

  return {
    ...account,
    lifestyle,
    privacySettings,
    discoverPreferences,
    photos: photos.sort((a, b) => a.position - b.position),
    prompts: prompts.sort((a, b) => a.position - b.position),
    interests: interests.sort((a, b) => a.position - b.position),
  }
}

async function issueTokens(accountId) {
  const account = await loadUserDetails(accountId)
  if (!account) {
    throw new Error('Account not found')
  }
  const accessToken = signAccessTokenUser({ id: account.id, handle: account.handle })
  const refreshToken = signRefreshTokenUser({ id: account.id, handle: account.handle })
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

function mapRelationshipGoal(value) {
  const map = {
    casual: 'casual',
    dating: 'dating',
    serious: 'serious',
    enm: 'non_monogamy',
    non_monogamy: 'non_monogamy',
    friends: 'friends',
    unsure: 'figuring_out',
    figuring_out: 'figuring_out',
  }
  return map[value] || null
}

function mapRelStatus(value) {
  const map = {
    single: 'single',
    partnered: 'in_relationship',
    in_relationship: 'in_relationship',
    married: 'married',
    enm: 'non_monogamous',
    non_monogamous: 'non_monogamous',
    complicated: 'complicated',
    private: 'prefer_not_say',
    prefer_not_say: 'prefer_not_say',
  }
  return map[value] || null
}

function mapTwoFaMethod(value) {
  return value === 'sms' ? 'sms' : 'skipped'
}

function isValidHandle(value) {
  const handle = String(value || '').trim()
  if (handle.length < 2 || handle.length > 24) return false
  return /^[a-zA-Z0-9_-]+$/.test(handle)
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

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, digits), eq(users.phoneCountry, country)))
      .limit(1)

    if (existing) {
      if (existing.isBanned) {
        return res.status(403).json({ error: 'Account suspended' })
      }
      if (existing.deletedAt) {
        return res.status(403).json({ error: 'Account not available' })
      }

      await db
        .update(users)
        .set({ phoneVerified: true, updatedAt: new Date() })
        .where(eq(users.id, existing.id))

      const tokens = await issueTokens(existing.id)
      return res.json({
        flow: 'login',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: tokens.user,
      })
    }

    const signupToken = signUserSignupToken({
      phone: digits,
      phoneCountry: country,
      verificationId: row.id,
    })
    return res.json({
      flow: 'signup',
      signupToken,
      expiresIn: 900,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Verification failed' })
  }
}

export async function completeOnboarding(req, res) {
  try {
    const {
      signupToken,
      handle,
      age,
      iam,
      iamOther,
      relationshipGoal,
      relStatus,
      orientation,
      city,
      locationGranted,
      searchRadius,
      minRadius,
      twoFaMethod,
      privacy,
      myBlur,
      photos,
    } = req.body || {}

    if (!signupToken) {
      return res.status(400).json({ error: 'signupToken required' })
    }
    if (!isValidHandle(handle)) {
      return res.status(400).json({ error: 'Invalid handle' })
    }
    const safeAge = Number(age)
    if (!Number.isInteger(safeAge) || safeAge < 18 || safeAge > 99) {
      return res.status(400).json({ error: 'Invalid age' })
    }
    if (!iam || !['woman', 'man', 'nonbinary', 'other'].includes(iam)) {
      return res.status(400).json({ error: 'Invalid iam value' })
    }
    const mappedGoal = mapRelationshipGoal(relationshipGoal)
    if (!mappedGoal) {
      return res.status(400).json({ error: 'Invalid relationshipGoal' })
    }
    const mappedStatus = mapRelStatus(relStatus)
    if (!mappedStatus) {
      return res.status(400).json({ error: 'Invalid relStatus' })
    }
    if (!Array.isArray(orientation) || orientation.length === 0) {
      return res.status(400).json({ error: 'orientation required' })
    }
    if (!Array.isArray(photos) || photos.length < 3 || photos.length > 6) {
      return res.status(400).json({ error: '3-6 photos required' })
    }
    for (const photo of photos) {
      if (!photo?.storageKey || !photo?.position) {
        return res.status(400).json({ error: 'Invalid photos payload' })
      }
    }

    let payload
    try {
      payload = verifyUserSignupToken(signupToken)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired signup token' })
    }

    const [verification] = await db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.id, payload.verificationId))
      .limit(1)
    if (!verification || !verification.verified) {
      return res.status(401).json({ error: 'Phone verification required' })
    }
    if (
      verification.phone !== payload.phone ||
      verification.phoneCountry !== payload.phoneCountry
    ) {
      return res.status(401).json({ error: 'Signup token mismatch' })
    }

    const [existingByPhone] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, payload.phone), eq(users.phoneCountry, payload.phoneCountry)))
      .limit(1)
    if (existingByPhone) {
      return res.status(409).json({ error: 'Account already exists for this phone' })
    }

    const [existingByHandle] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, String(handle).trim()))
      .limit(1)
    if (existingByHandle) {
      return res.status(409).json({ error: 'Handle is already taken' })
    }

    const normalizedPhotos = photos
      .map((p) => ({
        position: Number(p.position),
        storageKey: String(p.storageKey),
        isBlurred: p.isBlurred !== false,
        blurAmount: Number.isInteger(Number(p.blurAmount)) ? Number(p.blurAmount) : 70,
      }))
      .sort((a, b) => a.position - b.position)

    const privacySafe = privacy || {}
    const [created] = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          handle: String(handle).trim(),
          phone: payload.phone,
          phoneCountry: payload.phoneCountry,
          phoneVerified: true,
          age: safeAge,
          iam,
          iamOther: iam === 'other' ? String(iamOther || '').trim() : null,
          relationshipGoal: mappedGoal,
          relStatus: mappedStatus,
          orientation: orientation.map((x) => String(x)),
          city: city ? String(city).trim() : null,
          locationGranted: Boolean(locationGranted),
          searchRadius: Number.isInteger(Number(searchRadius)) ? Number(searchRadius) : 25,
          minRadius: Number.isInteger(Number(minRadius)) ? Number(minRadius) : 0,
          myBlur: Number.isInteger(Number(myBlur)) ? Number(myBlur) : 70,
          twoFaMethod: mapTwoFaMethod(twoFaMethod),
          profileCompletePct: 100,
        })
        .returning({ id: users.id })

      await tx.insert(userPhotos).values(
        normalizedPhotos.map((p) => ({
          userId: inserted.id,
          position: p.position,
          storageKey: p.storageKey,
          blurAmount: Math.max(0, Math.min(100, p.blurAmount)),
          isBlurred: p.isBlurred,
          isMain: p.position === 1,
        })),
      )

      await tx.insert(userPrivacySettings).values({
        userId: inserted.id,
        blurPhotos: privacySafe.blur !== false,
        anonymousHandle: privacySafe.anon !== false,
        ephemeralMessages: privacySafe.ephem !== false,
        screenshotShield: privacySafe.screenshot !== false,
        incognitoMode: Boolean(privacySafe.incognito),
      })

      await tx.insert(userDiscoverPreferences).values({
        userId: inserted.id,
        maxDistance: Number.isInteger(Number(searchRadius)) ? Number(searchRadius) : 25,
        minDistance: Number.isInteger(Number(minRadius)) ? Number(minRadius) : 0,
        photoBlurVisibility: Number.isInteger(Number(myBlur)) ? Number(myBlur) : 70,
      })

      return [inserted]
    })

    const tokens = await issueTokens(created.id)
    return res.status(201).json({
      flow: 'signup_completed',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Onboarding failed' })
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
      payload = verifyUserRefreshToken(refreshToken)
    } catch {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const [account] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!account || account.isBanned || account.deletedAt) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const accessToken = signAccessTokenUser({ id: account.id, handle: account.handle })
    const nextRefreshToken = signRefreshTokenUser({ id: account.id, handle: account.handle })
    const fullUser = await loadUserDetails(account.id)

    return res.json({
      accessToken,
      refreshToken: nextRefreshToken,
      user: fullUser,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Refresh failed' })
  }
}

export async function me(req, res) {
  try {
    const account = await loadUserDetails(req.user.id)

    if (!account) {
      return res.status(404).json({ error: 'Not found' })
    }
    return res.json({ user: account })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed' })
  }
}
