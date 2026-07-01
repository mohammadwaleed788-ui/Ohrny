import bcrypt from 'bcrypt'
import { eq, and, or, desc, gte, lt, isNull, inArray, count } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import {
  users,
  userPhotos,
  userPrompts,
  userInterests,
  userLifestyle,
} from '../../../db/schema/users.js'
import { phoneVerifications } from '../../../db/schema/safety.js'
import { supportTickets } from '../../../db/schema/support.js'
import { userPrivacySettings, userDiscoverPreferences } from '../../../db/schema/settings.js'
import { userDevices } from '../../../db/schema/userDevices.js'
import { likes, matches } from '../../../db/schema/matching.js'
import { messages } from '../../../db/schema/messaging.js'
import {
  signAccessTokenUser,
  signRefreshTokenUser,
  signUserSignupToken,
  verifyUserRefreshToken,
  verifyUserSignupToken,
} from '../../utils/jwt.js'
import { normalizePhoneE164 } from '../../utils/phone.js'
import { resolveOtpProvider, sendOtpWithProvider, verifyOtpWithProvider } from '../../services/otp/provider.js'
import { getIO } from '../../socket/index.js'
import { assertFeature, getEffectiveEntitlements } from '../../services/entitlementService.js'
import { recomputeProfileCompletion } from '../../services/profileCompletion.js'

async function loadUserDetails(userId) {
  const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!account) return null

  const entitlements = await getEffectiveEntitlements(userId)

  const [lifestyle, privacySettings, discoverPreferences, photos, prompts, interests, devices, matchesCount] = await Promise.all([
    db.select().from(userLifestyle).where(eq(userLifestyle.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userPrivacySettings).where(eq(userPrivacySettings.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userDiscoverPreferences).where(eq(userDiscoverPreferences.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userPhotos).where(eq(userPhotos.userId, userId)),
    db.select().from(userPrompts).where(eq(userPrompts.userId, userId)),
    db.select().from(userInterests).where(eq(userInterests.userId, userId)),
    db.select().from(userDevices).where(eq(userDevices.userId, userId)),
    // Real count of active matches (both directions) so the profile can show it
    // immediately from /me — without waiting for the match list to be fetched.
    db
      .select({ value: count() })
      .from(matches)
      .where(and(eq(matches.isActive, true), or(eq(matches.userAId, userId), eq(matches.userBId, userId))))
      .then((rows) => Number(rows[0]?.value || 0)),
  ])

  return {
    ...account,
    lifestyle,
    privacySettings,
    discoverPreferences,
    photos: photos.sort((a, b) => a.position - b.position),
    prompts: prompts.sort((a, b) => a.position - b.position),
    interests: interests.sort((a, b) => a.position - b.position),
    devices: devices.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    // Live active-match count (not the `matchesStarted` paywall counter).
    matchesCount,
    // Single source of truth for plan / active subscription / balances /
    // limits / feature flags — the client reads everything from here.
    entitlements: entitlements || null,
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

// Store-review / test bypass: phone numbers listed in REVIEW_PHONES (comma-
// separated E.164, e.g. "+15550000123,+923137426256") skip the real SMS and
// accept the fixed REVIEW_OTP code. This lets App Store / Play reviewers — who
// can't receive our SMS — sign in. Empty by default (bypass off in prod unless
// configured).
const REVIEW_OTP = process.env.REVIEW_OTP || '000000'
const REVIEW_PHONES = (process.env.REVIEW_PHONES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
function isReviewPhone(phoneE164) {
  return REVIEW_PHONES.includes(phoneE164)
}

// Normalize a phone for OTP. Real numbers go through strict validation; an
// allowlisted REVIEW_PHONES number is accepted as-is even if it isn't a real,
// dialable number (so reviewers/testers can use a fixed test number).
function resolvePhone(phoneCountry, phone) {
  const normalized = normalizePhoneE164(phoneCountry, phone)
  if (normalized) return normalized
  const country = String(phoneCountry || '+1').trim()
  const withPlus = country.startsWith('+') ? country : `+${country}`
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  const candidate = { phoneE164: `${withPlus}${digits}`, phoneCountry: withPlus, phone: digits }
  return isReviewPhone(candidate.phoneE164) ? candidate : null
}

export async function sendOtp(req, res) {
  try {
    const { phone, phoneCountry, flow } = req.body || {}
    const normalized = resolvePhone(phoneCountry, phone)
    if (!normalized) {
      return res.status(400).json({ error: 'invalid_phone', message: 'Invalid phone number' })
    }
    const { phone: digits, phoneCountry: country, phoneE164 } = normalized
    const provider = resolveOtpProvider()

    const [existing] = await db
      .select({ id: users.id, isBanned: users.isBanned, deletedAt: users.deletedAt })
      .from(users)
      .where(and(eq(users.phone, digits), eq(users.phoneCountry, country)))
      .limit(1)

    if (flow === 'login') {
      if (!existing) {
        return res.status(404).json({ error: 'no_account', message: 'No account found with this number. New here? Create a profile.' })
      }
      if (existing.isBanned) {
        return res.status(403).json({ error: 'account_suspended', message: 'Account suspended' })
      }
      if (existing.deletedAt) {
        return res.status(403).json({ error: 'account_unavailable', message: 'Account not available' })
      }
    } else {
      // signup flow
      if (existing && !existing.deletedAt) {
        return res.status(409).json({ error: 'phone_exists', message: 'An account already exists for this number. Please sign in instead.' })
      }
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)
    let codeHash = await bcrypt.hash(`otp:${provider}:${Date.now()}:${Math.random()}`, 10)

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

    if (isReviewPhone(phoneE164)) {
      // Review/test number: no real SMS — store the fixed OTP hash so verifyOtp
      // accepts REVIEW_OTP regardless of the SMS provider.
      codeHash = await bcrypt.hash(REVIEW_OTP, 10)
    } else if (provider === 'twilio') {
      await sendOtpWithProvider(provider, phoneE164)
    } else {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      codeHash = await bcrypt.hash(code, 10)
      console.info(`[mock SMS] OTP for ${phoneE164}: ${code}`)
    }

    await db.insert(phoneVerifications).values({
      phone: digits,
      phoneCountry: country,
      codeHash,
      expiresAt,
    })

    return res.json({ ok: true, expiresIn: 600 })
  } catch (err) {
    if (err?.status && err?.error) {
      return res.status(err.status).json({ error: err.error })
    }
    console.error(err)
    return res.status(500).json({ error: 'send_code_failed', message: 'Failed to send code' })
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
    open: 'open',
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

export async function checkHandle(req, res) {
  try {
    const handle = String(req.query.handle || '').trim()
    if (!isValidHandle(handle)) {
      return res.status(400).json({ error: 'handle_format', message: 'Handle must be 2–24 characters: letters, numbers, _ or - only' })
    }
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1)
    if (existing) {
      return res.status(409).json({ error: 'handle_taken', message: 'That name is already taken' })
    }
    return res.json({ available: true })
  } catch {
    return res.status(500).json({ error: 'something_went_wrong', message: 'Something went wrong' })
  }
}

export async function verifyOtp(req, res) {
  try {
    const { phone, phoneCountry, code } = req.body || {}
    const normalized = resolvePhone(phoneCountry, phone)
    if (!normalized) {
      return res.status(400).json({ error: 'invalid_phone', message: 'Invalid phone number' })
    }
    const { phone: digits, phoneCountry: country, phoneE164 } = normalized
    const provider = resolveOtpProvider()
    if (!code || String(code).length !== 6) {
      return res.status(400).json({ error: 'invalid_code', message: 'Invalid code' })
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
      return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts, try later' })
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
      return res.status(401).json({ error: 'invalid_code', message: 'No active verification' })
    }
    if (row.expiresAt < new Date()) {
      return res.status(401).json({ error: 'code_expired', message: 'Code expired' })
    }
    if (row.attempts >= 5) {
      return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts' })
    }

    if (isReviewPhone(phoneE164)) {
      // Review/test number: match against the fixed OTP hash stored by sendOtp.
      const match = await bcrypt.compare(String(code).trim(), row.codeHash)
      if (!match) {
        await db
          .update(phoneVerifications)
          .set({ attempts: row.attempts + 1 })
          .where(eq(phoneVerifications.id, row.id))
        return res.status(401).json({ error: 'invalid_code', message: 'Invalid code' })
      }
    } else if (provider === 'twilio') {
      try {
        await verifyOtpWithProvider(provider, phoneE164, String(code).trim())
      } catch (error) {
        if (error?.status === 401) {
          await db
            .update(phoneVerifications)
            .set({ attempts: row.attempts + 1 })
            .where(eq(phoneVerifications.id, row.id))
        }
        if (error?.status && error?.error) {
          return res.status(error.status).json({ error: error.error })
        }
        throw error
      }
    } else {
      const match = await bcrypt.compare(String(code).trim(), row.codeHash)
      if (!match) {
        await db
          .update(phoneVerifications)
          .set({ attempts: row.attempts + 1 })
          .where(eq(phoneVerifications.id, row.id))
        return res.status(401).json({ error: 'invalid_code', message: 'Invalid code' })
      }
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
        return res.status(403).json({ error: 'account_suspended', message: 'Account suspended' })
      }
      if (existing.deletedAt) {
        return res.status(403).json({ error: 'account_unavailable', message: 'Account not available' })
      }

      // Instagram-style: logging back in automatically resumes a paused account.
      const reactivate = existing.isPaused
        ? { isPaused: false, pausedUntil: null }
        : {}

      await db
        .update(users)
        .set({ phoneVerified: true, ...reactivate, updatedAt: new Date() })
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
    if (err?.status && err?.error) {
      return res.status(err.status).json({ error: err.error })
    }
    console.error(err)
    return res.status(500).json({ error: 'verification_failed', message: 'Verification failed' })
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
      countryCode,
      lat,
      lng,
      locationGranted,
      searchRadius,
      minRadius,
      twoFaMethod,
      privacy,
      myBlur,
      photos,
      language,
    } = req.body || {}

    if (!signupToken) {
      return res.status(400).json({ error: 'signup_token_required', message: 'signupToken required' })
    }
    if (!isValidHandle(handle)) {
      return res.status(400).json({ error: 'invalid_handle', message: 'Invalid handle' })
    }
    const safeAge = Number(age)
    if (!Number.isInteger(safeAge) || safeAge < 18 || safeAge > 99) {
      return res.status(400).json({ error: 'invalid_age_value', message: 'Invalid age' })
    }
    if (!iam || !['woman', 'man', 'nonbinary', 'other'].includes(iam)) {
      return res.status(400).json({ error: 'invalid_iam_value', message: 'Invalid iam value' })
    }
    const mappedGoal = mapRelationshipGoal(relationshipGoal)
    if (!mappedGoal) {
      return res.status(400).json({ error: 'invalid_relationship_goal', message: 'Invalid relationshipGoal' })
    }
    const mappedStatus = mapRelStatus(relStatus)
    if (!mappedStatus) {
      return res.status(400).json({ error: 'invalid_rel_status', message: 'Invalid relStatus' })
    }
    if (!Array.isArray(orientation) || orientation.length === 0) {
      return res.status(400).json({ error: 'orientation_required', message: 'orientation required' })
    }
    if (!Array.isArray(photos) || photos.length < 3 || photos.length > 6) {
      return res.status(400).json({ error: 'photos_required', message: '3-6 photos required' })
    }
    for (const photo of photos) {
      if (!photo?.storageKey || !photo?.position) {
        return res.status(400).json({ error: 'invalid_photos_payload', message: 'Invalid photos payload' })
      }
    }

    let payload
    try {
      payload = verifyUserSignupToken(signupToken)
    } catch {
      return res.status(401).json({ error: 'invalid_signup_token', message: 'Invalid or expired signup token' })
    }

    const [verification] = await db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.id, payload.verificationId))
      .limit(1)
    if (!verification || !verification.verified) {
      return res.status(401).json({ error: 'unauthorized', message: 'Phone verification required' })
    }
    if (
      verification.phone !== payload.phone ||
      verification.phoneCountry !== payload.phoneCountry
    ) {
      return res.status(401).json({ error: 'unauthorized', message: 'Signup token mismatch' })
    }

    const [existingByPhone] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, payload.phone), eq(users.phoneCountry, payload.phoneCountry)))
      .limit(1)
    if (existingByPhone) {
      return res.status(409).json({ error: 'phone_exists', message: 'Account already exists for this phone' })
    }

    const [existingByHandle] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, String(handle).trim()))
      .limit(1)
    if (existingByHandle) {
      return res.status(409).json({ error: 'handle_taken', message: 'Handle is already taken' })
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
          countryCode: countryCode ? String(countryCode).trim().slice(0, 4) : null,
          latApprox: lat != null && !Number.isNaN(Number(lat))
            ? String(Math.round(Number(lat) * 100) / 100)
            : null,
          lngApprox: lng != null && !Number.isNaN(Number(lng))
            ? String(Math.round(Number(lng) * 100) / 100)
            : null,
          locationGranted: Boolean(locationGranted),
          searchRadius: Number.isInteger(Number(searchRadius)) ? Number(searchRadius) : 25,
          minRadius: Number.isInteger(Number(minRadius)) ? Number(minRadius) : 0,
          myBlur: Number.isInteger(Number(myBlur)) ? Number(myBlur) : 70,
          twoFaMethod: mapTwoFaMethod(twoFaMethod),
          profileCompletePct: 100,
          language: language ? String(language).trim().slice(0, 10) : 'en',
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
        // Default OFF — only anonymous when the user explicitly opts in.
        anonymousHandle: privacySafe.anon === true,
        ephemeralMessages: privacySafe.ephem !== false,
        screenshotShield: privacySafe.screenshot !== false,
        incognitoMode: false,
      })

      await tx.insert(userDiscoverPreferences).values({
        userId: inserted.id,
        maxDistance: Number.isInteger(Number(searchRadius)) ? Number(searchRadius) : 25,
        minDistance: Number.isInteger(Number(minRadius)) ? Number(minRadius) : 0,
        photoBlurVisibility: Number.isInteger(Number(myBlur)) ? Number(myBlur) : 70,
      })

      return [inserted]
    })

    // Replace the optimistic 100 with the real completion of what they filled.
    await recomputeProfileCompletion(created.id)
    const tokens = await issueTokens(created.id)
    return res.status(201).json({
      flow: 'signup_completed',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'onboarding_failed', message: 'Onboarding failed' })
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body || {}
    if (!refreshToken) {
      return res.status(400).json({ error: 'refresh_token_required', message: 'refreshToken required' })
    }

    let payload
    try {
      payload = verifyUserRefreshToken(refreshToken)
    } catch {
      return res.status(401).json({ error: 'invalid_session', message: 'Invalid session' })
    }

    const [account] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!account || account.isBanned || account.deletedAt) {
      return res.status(401).json({ error: 'invalid_session', message: 'Invalid session' })
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
    return res.status(500).json({ error: 'refresh_failed', message: 'Refresh failed' })
  }
}

export async function me(req, res) {
  try {
    const account = await loadUserDetails(req.user.id)

    if (!account) {
      return res.status(404).json({ error: 'account_not_found', message: 'Not found' })
    }
    return res.json({ user: account })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'request_failed', message: 'Failed' })
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id
    const {
      bio,
      pronouns,
      looking,
      work,
      iam,
      iamOther,
      orientation,
      relStatus,
      relationshipGoal,
      lifestyle,
      interests,
      prompts,
      photos,
      lat,
      lng,
      city,
      language,
    } = req.body || {}

    const userUpdates = {}
    if (bio !== undefined) userUpdates.bio = bio ? String(bio).trim().slice(0, 500) : null
    if (pronouns !== undefined) userUpdates.pronouns = pronouns ? String(pronouns).trim().slice(0, 40) : null
    if (looking !== undefined) userUpdates.looking = looking ? String(looking).trim().slice(0, 120) : null
    if (work !== undefined) userUpdates.work = work ? String(work).trim().slice(0, 120) : null
    if (iam !== undefined && ['woman', 'man', 'nonbinary', 'other'].includes(String(iam))) {
      userUpdates.iam = String(iam)
      userUpdates.iamOther = iam === 'other' ? String(iamOther || '').trim().slice(0, 60) : null
    }
    if (Array.isArray(orientation) && orientation.length > 0) {
      userUpdates.orientation = orientation.map((x) => String(x))
    }
    if (relStatus !== undefined) {
      const mapped = mapRelStatus(relStatus)
      if (mapped) userUpdates.relStatus = mapped
    }
    if (relationshipGoal !== undefined) {
      const mapped = mapRelationshipGoal(relationshipGoal)
      if (mapped) userUpdates.relationshipGoal = mapped
    }
    if (lat != null && !Number.isNaN(Number(lat))) {
      userUpdates.latApprox = String(Math.round(Number(lat) * 100) / 100)
      userUpdates.locationGranted = true
    }
    if (lng != null && !Number.isNaN(Number(lng))) {
      userUpdates.lngApprox = String(Math.round(Number(lng) * 100) / 100)
    }
    if (city !== undefined) {
      userUpdates.city = city ? String(city).trim().slice(0, 100) : null
    }
    if (language !== undefined) {
      userUpdates.language = language ? String(language).trim().slice(0, 10) : 'en'
    }

    await db.transaction(async (tx) => {
      if (Object.keys(userUpdates).length > 0) {
        await tx.update(users).set({ ...userUpdates, updatedAt: new Date() }).where(eq(users.id, userId))
      }

      if (lifestyle && typeof lifestyle === 'object') {
        const ls = {
          userId,
          height: lifestyle.height ? String(lifestyle.height).slice(0, 20) : null,
          drinks: lifestyle.drinks ? String(lifestyle.drinks).slice(0, 40) : null,
          smokes: lifestyle.smokes ? String(lifestyle.smokes).slice(0, 40) : null,
          kids: lifestyle.kids ? String(lifestyle.kids).slice(0, 60) : null,
          pets: lifestyle.pets ? String(lifestyle.pets).slice(0, 60) : null,
          diet: lifestyle.diet ? String(lifestyle.diet).slice(0, 60) : null,
          exercise: lifestyle.exercise ? String(lifestyle.exercise).slice(0, 60) : null,
          religion: lifestyle.religion ? String(lifestyle.religion).slice(0, 60) : null,
          education: lifestyle.education ? String(lifestyle.education).slice(0, 60) : null,
          zodiac: lifestyle.zodiac ? String(lifestyle.zodiac).slice(0, 20) : null,
        }
        await tx
          .insert(userLifestyle)
          .values(ls)
          .onConflictDoUpdate({ target: userLifestyle.userId, set: { ...ls, updatedAt: new Date() } })
      }

      if (Array.isArray(interests)) {
        await tx.delete(userInterests).where(eq(userInterests.userId, userId))
        if (interests.length > 0) {
          await tx.insert(userInterests).values(
            interests.slice(0, 6).map((interest, i) => ({
              userId,
              interest: String(interest).slice(0, 60),
              position: i,
            })),
          )
        }
      }

      if (Array.isArray(prompts)) {
        for (const p of prompts.slice(0, 3)) {
          if (!p?.title || !p?.answer) continue
          const position = Math.max(1, Math.min(3, Number(p.position) || 1))
          await tx
            .insert(userPrompts)
            .values({
              userId,
              position,
              title: String(p.title).slice(0, 80),
              answer: String(p.answer).slice(0, 160),
            })
            .onConflictDoUpdate({
              target: [userPrompts.userId, userPrompts.position],
              set: {
                title: String(p.title).slice(0, 80),
                answer: String(p.answer).slice(0, 160),
                updatedAt: new Date(),
              },
            })
        }
      }

      if (Array.isArray(photos) && photos.length > 0) {
        const validPhotos = photos
          .filter((p) => p?.storageKey && typeof p.storageKey === 'string')
          .slice(0, 6)
        if (validPhotos.length > 0) {
          await tx.delete(userPhotos).where(eq(userPhotos.userId, userId))
          await tx.insert(userPhotos).values(
            validPhotos.map((p, i) => ({
              userId,
              position: Number(p.position) || i + 1,
              storageKey: p.storageKey,
              isBlurred: p.isBlurred ?? false,
              blurAmount: p.isBlurred ? (Number(p.blurAmount) || 70) : 0,
              isMain: (Number(p.position) || i + 1) === 1,
            })),
          )
        }
      }

      // Recompute completion from the freshly-written profile (drives the
      // "verified"/complete badge + the verified-only discovery filter).
      await recomputeProfileCompletion(userId, tx)
    })

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'profile_update_failed', message: 'Profile update failed' })
  }
}

export async function logout(req, res) {
  // No server-side token store yet — client clears device storage.
  // This endpoint exists as a hook for future: push token removal, audit log, etc.
  return res.json({ ok: true })
}

export async function updatePrivacy(req, res) {
  try {
    const userId = req.user.id
    const {
      blurPhotos,
      anonymousHandle,
      ephemeralMessages,
      screenshotShield,
      incognitoMode,
      hideAge,
      hideDistance,
      analyticsConsent,
      personalizationConsent,
      marketingEmails,
      campaignNotificationsEnabled,
      thirdPartyMeasurement,
    } = req.body || {}

    const updates = {}
    if (blurPhotos !== undefined) updates.blurPhotos = Boolean(blurPhotos)
    if (anonymousHandle !== undefined) updates.anonymousHandle = Boolean(anonymousHandle)
    if (ephemeralMessages !== undefined) updates.ephemeralMessages = Boolean(ephemeralMessages)
    if (screenshotShield !== undefined) updates.screenshotShield = Boolean(screenshotShield)
    if (incognitoMode !== undefined) {
      if (Boolean(incognitoMode)) {
        const access = await assertFeature(userId, 'incognitoMode')
        if (!access.ok) return res.status(access.status).json(access.body)
      }
      updates.incognitoMode = Boolean(incognitoMode)
    }
    // Hide age / distance — Plus+ only; coerce OFF for non-entitled users
    // (the client re-sends stored flags, so don't fail the whole save).
    if (hideAge !== undefined) {
      let on = Boolean(hideAge)
      if (on && !(await assertFeature(userId, 'hideAge')).ok) on = false
      updates.hideAge = on
    }
    if (hideDistance !== undefined) {
      let on = Boolean(hideDistance)
      if (on && !(await assertFeature(userId, 'hideDistance')).ok) on = false
      updates.hideDistance = on
    }
    if (analyticsConsent !== undefined) updates.analyticsConsent = Boolean(analyticsConsent)
    if (personalizationConsent !== undefined) updates.personalizationConsent = Boolean(personalizationConsent)
    if (marketingEmails !== undefined) updates.marketingEmails = Boolean(marketingEmails)
    if (campaignNotificationsEnabled !== undefined) {
      updates.campaignNotificationsEnabled = Boolean(campaignNotificationsEnabled)
    }
    if (thirdPartyMeasurement !== undefined) updates.thirdPartyMeasurement = Boolean(thirdPartyMeasurement)

    if (Object.keys(updates).length > 0) {
      await db
        .update(userPrivacySettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userPrivacySettings.userId, userId))
    }

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'privacy_update_failed', message: 'Privacy update failed' })
  }
}

export async function updatePreferences(req, res) {
  try {
    const userId = req.user.id
    const premiumAccess = await assertFeature(userId, 'advancedCompatibility')
    const hasPremium = premiumAccess.ok

    const {
      maxDistance,
      minDistance,
      ageMin,
      ageMax,
      relationshipType,
      photoBlurVisibility,
      verifiedOnly,
      advancedCompatibility,
      travelMode,
      travelLat,
      travelLng,
      travelCity,
      globalMode,
      heightMin,
      heightMax,
      heightUnit,
      diet,
      drinks,
      smokes,
      exercise,
      kids,
      pets,
      education,
      religion,
      zodiac,
    } = req.body || {}

    const prefUpdates = {}
    if (maxDistance !== undefined && !Number.isNaN(Number(maxDistance))) {
      prefUpdates.maxDistance = Math.max(1, Math.min(200, Math.round(Number(maxDistance))))
    }
    if (minDistance !== undefined && !Number.isNaN(Number(minDistance))) {
      prefUpdates.minDistance = Math.max(0, Math.min(100, Math.round(Number(minDistance))))
    }
    if (ageMin !== undefined && !Number.isNaN(Number(ageMin))) {
      prefUpdates.ageMin = Math.max(18, Math.min(99, Math.round(Number(ageMin))))
    }
    if (ageMax !== undefined && !Number.isNaN(Number(ageMax))) {
      prefUpdates.ageMax = Math.max(18, Math.min(99, Math.round(Number(ageMax))))
    }
    if (relationshipType !== undefined) {
      const relMap = { serious: 'serious', dating: 'dating', casual: 'casual', enm: 'non_monogamy', non_monogamy: 'non_monogamy', friends: 'friends', unsure: 'figuring_out', figuring_out: 'figuring_out', open: 'open' }
      const mapped = relMap[String(relationshipType)]
      if (mapped) prefUpdates.relationshipType = mapped
    }
    if (photoBlurVisibility !== undefined && !Number.isNaN(Number(photoBlurVisibility))) {
      prefUpdates.photoBlurVisibility = Math.max(0, Math.min(100, Math.round(Number(photoBlurVisibility))))
    }
    // Height + lifestyle are FREE filters now — saved for everyone (no gating).
    if (heightMin !== undefined && !Number.isNaN(Number(heightMin))) {
      prefUpdates.heightMin = Math.max(140, Math.min(220, Math.round(Number(heightMin))))
    }
    if (heightMax !== undefined && !Number.isNaN(Number(heightMax))) {
      prefUpdates.heightMax = Math.max(140, Math.min(220, Math.round(Number(heightMax))))
    }
    if (heightUnit !== undefined) {
      prefUpdates.heightUnit = ['cm', 'ft'].includes(String(heightUnit)) ? String(heightUnit) : 'cm'
    }

    const arrayFilters = { diet, drinks, smokes, exercise, kids, pets, education, religion, zodiac }
    for (const [key, val] of Object.entries(arrayFilters)) {
      if (val !== undefined) {
        prefUpdates[key] = Array.isArray(val) ? val.map((x) => String(x).slice(0, 60)) : []
      }
    }

    const paidFilters = {
      verifiedOnly: { value: verifiedOnly, feature: 'verifiedOnly' },
      advancedCompatibility: { value: advancedCompatibility, feature: 'advancedCompatibility' },
      travelMode: { value: travelMode, feature: 'travelMode' },
      globalMode: { value: globalMode, feature: 'globalMode' },
    }
    for (const [field, config] of Object.entries(paidFilters)) {
      if (config.value === undefined) continue
      let enabled = Boolean(config.value)
      // A premium filter can only be ON if the user is entitled. Instead of
      // failing the whole save (the client re-sends stored flags every time),
      // silently coerce it OFF for non-entitled users.
      if (enabled) {
        const access = await assertFeature(userId, config.feature)
        if (!access.ok) enabled = false
      }
      prefUpdates[field] = enabled
    }

    // Travel-mode location (the Passport pin). Only entitled users (travelMode
    // is plus+) can set it; for everyone else it's cleared. Coords are stored
    // as strings, validated numeric (the discovery query re-guards them too).
    const toCoord = (v) => {
      const n = Number(v)
      return Number.isFinite(n) ? String(n) : null
    }
    if (travelLat !== undefined) {
      prefUpdates.travelLat = hasPremium ? toCoord(travelLat) : null
    }
    if (travelLng !== undefined) {
      prefUpdates.travelLng = hasPremium ? toCoord(travelLng) : null
    }
    if (travelCity !== undefined) {
      prefUpdates.travelCity = hasPremium && travelCity ? String(travelCity).slice(0, 120) : null
    }

    await db.transaction(async (tx) => {
      if (Object.keys(prefUpdates).length > 0) {
        await tx
          .update(userDiscoverPreferences)
          .set({ ...prefUpdates, updatedAt: new Date() })
          .where(eq(userDiscoverPreferences.userId, userId))
      }
      const userSyncUpdates = {}
      if (prefUpdates.maxDistance !== undefined) userSyncUpdates.searchRadius = prefUpdates.maxDistance
      if (prefUpdates.minDistance !== undefined) userSyncUpdates.minRadius = prefUpdates.minDistance
      if (prefUpdates.photoBlurVisibility !== undefined) userSyncUpdates.myBlur = prefUpdates.photoBlurVisibility
      if (Object.keys(userSyncUpdates).length > 0) {
        await tx.update(users).set({ ...userSyncUpdates, updatedAt: new Date() }).where(eq(users.id, userId))
      }
    })

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'preferences_update_failed', message: 'Preferences update failed' })
  }
}

export async function deleteAccount(req, res) {
  try {
    const userId = req.user.id

    const [account] = await db
      .select({ phone: users.phone, phoneCountry: users.phoneCountry })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!account) return res.status(404).json({ error: 'account_not_found', message: 'Account not found' })

    // Full erasure. Most user-linked tables are ON DELETE CASCADE, so deleting
    // the users row removes them automatically: privacy & discover settings,
    // travel locations, devices, likes, matches, profile views, messages, calls,
    // blocks, reports, enforcements, appeals, subscriptions, in-app purchases,
    // boosts, activity events, photos, prompts, interests and lifestyle.
    // The two exceptions are cleaned up explicitly here:

    // 1) Support tickets only SET NULL the requester on user delete (so the
    //    ticket would survive). For a full account deletion we hard-delete the
    //    user's tickets — their messages cascade from the ticket.
    await db.delete(supportTickets).where(eq(supportTickets.requesterUserId, userId))

    // 2) Phone verifications aren't linked to users.id (keyed by phone number).
    await db.delete(phoneVerifications).where(
      and(
        eq(phoneVerifications.phone, account.phone),
        eq(phoneVerifications.phoneCountry, account.phoneCountry),
      ),
    )

    // Finally delete the user — cascade removes everything else.
    await db.delete(users).where(eq(users.id, userId))

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'account_deletion_failed', message: 'Account deletion failed' })
  }
}

export async function wipeAccount(req, res) {
  try {
    const userId = req.user.id
    let removedMatches = [] // [{ id, partnerId }] — for socket broadcast after commit

    await db.transaction(async (tx) => {
      // Clear every optional profile field — keep account credentials (phone,
      // handle, 2FA, age, iam) so they can rebuild from a blank profile.
      await tx
        .update(users)
        .set({
          bio: null,
          aboutMe: null,
          pronouns: null,
          looking: null,
          work: null,
          profileCompletePct: 10,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))

      // Remove media and content
      await tx.delete(userPhotos).where(eq(userPhotos.userId, userId))
      await tx.delete(userPrompts).where(eq(userPrompts.userId, userId))
      await tx.delete(userInterests).where(eq(userInterests.userId, userId))

      // Reset lifestyle to nulls (keep row for future edits)
      await tx
        .update(userLifestyle)
        .set({
          height: null,
          drinks: null,
          smokes: null,
          kids: null,
          pets: null,
          diet: null,
          exercise: null,
          religion: null,
          education: null,
          zodiac: null,
          updatedAt: new Date(),
        })
        .where(eq(userLifestyle.userId, userId))

      // Reset privacy toggles to factory defaults (keep the single row).
      await tx
        .update(userPrivacySettings)
        .set({
          blurPhotos: true,
          anonymousHandle: false,
          ephemeralMessages: true,
          screenshotShield: true,
          incognitoMode: false,
          hideAge: false,
          hideDistance: false,
          analyticsConsent: true,
          personalizationConsent: true,
          marketingEmails: false,
          thirdPartyMeasurement: false,
          updatedAt: new Date(),
        })
        .where(eq(userPrivacySettings.userId, userId))

      // Reset dating-preference filters to factory defaults (keep the row).
      await tx
        .update(userDiscoverPreferences)
        .set({
          maxDistance: 25,
          minDistance: 0,
          ageMin: 18,
          ageMax: 70,
          relationshipType: 'dating',
          photoBlurVisibility: 70,
          verifiedOnly: false,
          advancedCompatibility: false,
          travelMode: false,
          globalMode: false,
          travelLat: null,
          travelLng: null,
          travelCity: null,
          heightMin: 140,
          heightMax: 220,
          heightUnit: 'cm',
          diet: [],
          drinks: [],
          smokes: [],
          exercise: [],
          kids: [],
          pets: [],
          education: [],
          religion: [],
          zodiac: [],
          updatedAt: new Date(),
        })
        .where(eq(userDiscoverPreferences.userId, userId))

      // ── Wipe interactions: likes, matches, messages ──────────────────────
      // Hard-delete every like row the user is involved in (either side).
      await tx
        .delete(likes)
        .where(or(eq(likes.fromUserId, userId), eq(likes.toUserId, userId)))

      // Find every active match this user is part of, soft-deactivate them
      // and soft-delete their messages.
      const userMatches = await tx
        .select({ id: matches.id, partnerA: matches.userAId, partnerB: matches.userBId })
        .from(matches)
        .where(
          and(
            or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
            eq(matches.isActive, true),
          ),
        )

      if (userMatches.length > 0) {
        const matchIds = userMatches.map((m) => m.id)
        await tx
          .update(messages)
          .set({ deletedAt: new Date() })
          .where(and(inArray(messages.matchId, matchIds), isNull(messages.deletedAt)))

        await tx
          .update(matches)
          .set({
            isActive: false,
            unmatchedAt: new Date(),
            unmatchedByUserId: userId,
            updatedAt: new Date(),
          })
          .where(inArray(matches.id, matchIds))

        removedMatches = userMatches.map((m) => ({
          id: m.id,
          partnerId: m.partnerA === userId ? m.partnerB : m.partnerA,
        }))
      }
    })

    // After commit: tell each partner their match has vanished, like unmatch does.
    const io = getIO()
    if (io) {
      for (const r of removedMatches) {
        io.to(`user:${r.partnerId}`).emit('match:removed', { matchId: r.id })
      }
    }

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'data_wipe_failed', message: 'Data wipe failed' })
  }
}

// Accepts body.duration ∈ {1d, 3d, 1w, 2w, indefinite}.
// When omitted, toggles current state (legacy behaviour).
const PAUSE_DURATION_MS = {
  '1d': 1 * 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '2w': 14 * 24 * 60 * 60 * 1000,
}

export async function pauseAccount(req, res) {
  try {
    const userId = req.user.id
    const duration = req.body?.duration

    const [account] = await db
      .select({ isPaused: users.isPaused })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!account) return res.status(404).json({ error: 'account_not_found', message: 'Account not found' })

    // If client supplies a duration explicitly, honor it (pause).
    // Otherwise toggle the current state.
    let nowPaused
    let pausedUntil
    if (duration !== undefined) {
      if (duration !== 'indefinite' && !(duration in PAUSE_DURATION_MS)) {
        return res.status(400).json({ error: 'invalid_duration', message: 'Invalid duration' })
      }
      nowPaused = true
      pausedUntil =
        duration === 'indefinite'
          ? null
          : new Date(Date.now() + PAUSE_DURATION_MS[duration])
    } else {
      nowPaused = !account.isPaused
      pausedUntil = nowPaused ? new Date(Date.now() + PAUSE_DURATION_MS['1w']) : null
    }

    await db
      .update(users)
      .set({ isPaused: nowPaused, pausedUntil, updatedAt: new Date() })
      .where(eq(users.id, userId))

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated, isPaused: nowPaused })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'pause_toggle_failed', message: 'Pause toggle failed' })
  }
}
