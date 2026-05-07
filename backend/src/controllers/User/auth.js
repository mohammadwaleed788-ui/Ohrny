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
    const { phone, phoneCountry, flow } = req.body || {}
    const { phone: digits, phoneCountry: country } = normalizePhone(phoneCountry, phone)
    if (digits.length < 8) {
      return res.status(400).json({ error: 'Invalid phone number' })
    }

    const [existing] = await db
      .select({ id: users.id, isBanned: users.isBanned, deletedAt: users.deletedAt })
      .from(users)
      .where(and(eq(users.phone, digits), eq(users.phoneCountry, country)))
      .limit(1)

    if (flow === 'login') {
      if (!existing) {
        return res.status(404).json({ error: 'No account found with this number. New here? Create a profile.' })
      }
      if (existing.isBanned) {
        return res.status(403).json({ error: 'Account suspended' })
      }
      if (existing.deletedAt) {
        return res.status(403).json({ error: 'Account not available' })
      }
    } else {
      // signup flow
      if (existing && !existing.deletedAt) {
        return res.status(409).json({ error: 'An account already exists for this number. Please sign in instead.' })
      }
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

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id
    const {
      bio,
      pronouns,
      looking,
      work,
      orientation,
      relStatus,
      relationshipGoal,
      lifestyle,
      interests,
      prompts,
    } = req.body || {}

    const userUpdates = {}
    if (bio !== undefined) userUpdates.bio = bio ? String(bio).trim().slice(0, 500) : null
    if (pronouns !== undefined) userUpdates.pronouns = pronouns ? String(pronouns).trim().slice(0, 40) : null
    if (looking !== undefined) userUpdates.looking = looking ? String(looking).trim().slice(0, 120) : null
    if (work !== undefined) userUpdates.work = work ? String(work).trim().slice(0, 120) : null
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
    })

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Profile update failed' })
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
      analyticsConsent,
      personalizationConsent,
      marketingEmails,
      thirdPartyMeasurement,
    } = req.body || {}

    const updates = {}
    if (blurPhotos !== undefined) updates.blurPhotos = Boolean(blurPhotos)
    if (anonymousHandle !== undefined) updates.anonymousHandle = Boolean(anonymousHandle)
    if (ephemeralMessages !== undefined) updates.ephemeralMessages = Boolean(ephemeralMessages)
    if (screenshotShield !== undefined) updates.screenshotShield = Boolean(screenshotShield)
    if (incognitoMode !== undefined) updates.incognitoMode = Boolean(incognitoMode)
    if (analyticsConsent !== undefined) updates.analyticsConsent = Boolean(analyticsConsent)
    if (personalizationConsent !== undefined) updates.personalizationConsent = Boolean(personalizationConsent)
    if (marketingEmails !== undefined) updates.marketingEmails = Boolean(marketingEmails)
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
    return res.status(500).json({ error: 'Privacy update failed' })
  }
}

export async function updatePreferences(req, res) {
  try {
    const userId = req.user.id
    const {
      maxDistance,
      minDistance,
      ageMin,
      ageMax,
      relationshipType,
      photoBlurVisibility,
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
      const relMap = { serious: 'serious', dating: 'dating', casual: 'casual', enm: 'non_monogamy', non_monogamy: 'non_monogamy', open: 'open' }
      const mapped = relMap[String(relationshipType)]
      if (mapped) prefUpdates.relationshipType = mapped
    }
    if (photoBlurVisibility !== undefined && !Number.isNaN(Number(photoBlurVisibility))) {
      prefUpdates.photoBlurVisibility = Math.max(0, Math.min(100, Math.round(Number(photoBlurVisibility))))
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
    return res.status(500).json({ error: 'Preferences update failed' })
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

    if (!account) return res.status(404).json({ error: 'Account not found' })

    // Clean up phone verifications (not cascade-linked to users)
    await db.delete(phoneVerifications).where(
      and(
        eq(phoneVerifications.phone, account.phone),
        eq(phoneVerifications.phoneCountry, account.phoneCountry),
      ),
    )

    // Delete user — cascade removes all related rows automatically
    await db.delete(users).where(eq(users.id, userId))

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Account deletion failed' })
  }
}

export async function wipeAccount(req, res) {
  try {
    const userId = req.user.id

    await db.transaction(async (tx) => {
      // Clear optional profile fields, keep account credentials intact
      await tx
        .update(users)
        .set({
          bio: null,
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
    })

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Data wipe failed' })
  }
}

export async function pauseAccount(req, res) {
  try {
    const userId = req.user.id

    const [account] = await db
      .select({ isPaused: users.isPaused })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!account) return res.status(404).json({ error: 'Account not found' })

    const nowPaused = !account.isPaused
    const pausedUntil = nowPaused ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null

    await db
      .update(users)
      .set({ isPaused: nowPaused, pausedUntil, updatedAt: new Date() })
      .where(eq(users.id, userId))

    const updated = await loadUserDetails(userId)
    return res.json({ user: updated, isPaused: nowPaused })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Pause toggle failed' })
  }
}
