import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { likes, matches } from '../../../db/schema/matching.js'
import { messages } from '../../../db/schema/messaging.js'
import { userDiscoverPreferences, userPrivacySettings } from '../../../db/schema/settings.js'
import { userInterests, userLifestyle, userPhotos, userPrompts, users } from '../../../db/schema/users.js'
import { signAccessTokenUser } from '../../utils/jwt.js'

const HANDLE_PREFIX = 'optest_'
const PHONE_PREFIX = '555019'
const PHONE_COUNTRY = '+1'

function isOperatedUser(row) {
  return Boolean(
    row &&
      String(row.handle || '').startsWith(HANDLE_PREFIX) &&
      row.phoneCountry === PHONE_COUNTRY &&
      String(row.phone || '').startsWith(PHONE_PREFIX),
  )
}

function slugHandle(value) {
  const raw = String(value || 'persona').toLowerCase()
  const slug = raw.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 14)
  return `${HANDLE_PREFIX}${slug || 'persona'}`
}

function clampInt(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

function normalizeIam(value) {
  const text = String(value || '').toLowerCase()
  if (text === 'man') return 'man'
  if (text === 'non-binary' || text === 'nonbinary') return 'nonbinary'
  if (text === 'other') return 'other'
  return 'woman'
}

function normalizeRelGoal(value) {
  const text = String(value || '').toLowerCase()
  if (['casual', 'dating', 'serious', 'non_monogamy', 'friends', 'figuring_out'].includes(text)) return text
  if (text.includes('casual')) return 'casual'
  if (text.includes('figuring')) return 'figuring_out'
  if (text.includes('friend')) return 'friends'
  return 'serious'
}

function normalizeRelStatus(value) {
  const text = String(value || '').toLowerCase()
  if (['single', 'in_relationship', 'married', 'non_monogamous', 'complicated', 'prefer_not_say'].includes(text)) return text
  if (text.includes('relationship')) return 'in_relationship'
  if (text.includes('married')) return 'married'
  if (text.includes('complicated')) return 'complicated'
  return 'single'
}

function normalizeOrientation(value) {
  const arr = Array.isArray(value) ? value : [value]
  const mapped = arr
    .map((item) => String(item || '').toLowerCase())
    .map((item) => {
      if (item === 'women' || item === 'woman' || item === 'straight') return 'women'
      if (item === 'men' || item === 'man' || item === 'gay') return 'men'
      if (item === 'nonbinary' || item === 'non-binary') return 'nonbinary'
      if (item === 'everyone' || item === 'bi' || item === 'pan' || item === 'queer') return 'everyone'
      return null
    })
    .filter(Boolean)
  return [...new Set(mapped)].length ? [...new Set(mapped)] : ['everyone']
}

function defaultPhotoStorage(handle, position) {
  return `operated/${handle}/photo-${position}.jpg`
}

function mapPersona(row, extras = {}) {
  const status = row.isPaused ? 'paused' : 'active'
  const photos = extras.photos || []
  const cleanExtras = { ...extras }
  delete cleanExtras.photos
  return {
    id: row.id,
    name: row.handle,
    handle: row.handle,
    age: row.age,
    gender: row.iam === 'man' ? 'Man' : row.iam === 'nonbinary' ? 'Non-binary' : 'Woman',
    orientation: row.orientation || [],
    city: row.city || '',
    country: row.countryCode || '',
    hue: Math.abs(String(row.id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360,
    status,
    bio: row.bio || row.aboutMe || '',
    work: row.work || '',
    relStatus: row.relStatus || 'single',
    intent: row.relationshipGoal || 'serious',
    photos: photos.length,
    photosList: photos,
    verified: Boolean(row.idVerified),
    plan: row.plan,
    createdBy: 'Admin',
    team: 'Operated test',
    ...cleanExtras,
  }
}

async function getOperatedBase(userId) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!isOperatedUser(row)) return null
  return row
}

async function loadPersona(userId) {
  const row = await getOperatedBase(userId)
  if (!row) return null

  const [lifestyle, prefs, privacy, photos, prompts, interests] = await Promise.all([
    db.select().from(userLifestyle).where(eq(userLifestyle.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userDiscoverPreferences).where(eq(userDiscoverPreferences.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userPrivacySettings).where(eq(userPrivacySettings.userId, userId)).limit(1).then((rows) => rows[0] || null),
    db.select().from(userPhotos).where(and(eq(userPhotos.userId, userId), isNull(userPhotos.deletedAt))).orderBy(asc(userPhotos.position)),
    db.select().from(userPrompts).where(eq(userPrompts.userId, userId)).orderBy(asc(userPrompts.position)),
    db.select().from(userInterests).where(eq(userInterests.userId, userId)).orderBy(asc(userInterests.position)),
  ])

  return mapPersona(row, {
    lifestyle,
    preferences: prefs,
    privacy,
    photos,
    prompts,
    interests: interests.map((item) => item.interest),
    height: lifestyle?.height || '',
    drinks: lifestyle?.drinks || '',
    smokes: lifestyle?.smokes || '',
    kids: lifestyle?.kids || '',
    edu: lifestyle?.education || '',
  })
}

async function summaryForUser(row) {
  const userId = row.id
  const [matchCount, activeCount, msgCount, unreadCount] = await Promise.all([
    db.select({ count: sql`count(*)::int` }).from(matches).where(or(eq(matches.userAId, userId), eq(matches.userBId, userId))).then((rows) => Number(rows[0]?.count || 0)),
    db.select({ count: sql`count(*)::int` }).from(matches).where(and(or(eq(matches.userAId, userId), eq(matches.userBId, userId)), eq(matches.isActive, true))).then((rows) => Number(rows[0]?.count || 0)),
    db.select({ count: sql`count(*)::int` }).from(messages).where(and(eq(messages.senderId, userId), isNull(messages.deletedAt))).then((rows) => Number(rows[0]?.count || 0)),
    db
      .select({ count: sql`count(*)::int` })
      .from(messages)
      .innerJoin(matches, eq(messages.matchId, matches.id))
      .where(
        and(
          or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
          sql`${messages.senderId} <> ${userId}`,
          eq(messages.isRead, false),
          isNull(messages.deletedAt),
        ),
      )
      .then((rows) => Number(rows[0]?.count || 0)),
  ])

  return mapPersona(row, {
    unread: unreadCount,
    stats: {
      matches: matchCount,
      active: activeCount,
      msgsToday: msgCount,
      replyRate: 0,
      lastActive: row.updatedAt,
    },
  })
}

async function nextOperatedPhone() {
  const rows = await db
    .select({ phone: users.phone })
    .from(users)
    .where(and(eq(users.phoneCountry, PHONE_COUNTRY), like(users.phone, `${PHONE_PREFIX}%`)))
  const used = new Set(rows.map((row) => row.phone))
  for (let suffix = 0; suffix < 10000; suffix += 1) {
    const phone = `${PHONE_PREFIX}${String(suffix).padStart(4, '0')}`
    if (!used.has(phone)) return phone
  }
  throw new Error('No operated phone numbers available')
}

async function uniqueHandle(baseHandle) {
  let handle = baseHandle
  for (let index = 1; index < 1000; index += 1) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.handle, handle)).limit(1)
    if (!existing) return handle
    handle = `${baseHandle.slice(0, 20)}_${index}`
  }
  throw new Error('No operated handle available')
}

export async function listPersonas(req, res) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(and(like(users.handle, `${HANDLE_PREFIX}%`), eq(users.phoneCountry, PHONE_COUNTRY), like(users.phone, `${PHONE_PREFIX}%`), isNull(users.deletedAt)))
      .orderBy(desc(users.updatedAt))

    const personas = await Promise.all(rows.map(summaryForUser))
    return res.json({ personas })
  } catch (err) {
    console.error('operated listPersonas error:', err)
    return res.status(500).json({ error: 'Failed to load operated personas' })
  }
}

export async function createPersona(req, res) {
  try {
    const body = req.body || {}
    const displayName = String(body.name || body.handle || 'persona')
    const handle = await uniqueHandle(slugHandle(body.handle || displayName))
    const phone = await nextOperatedPhone()
    const age = clampInt(body.age, 18, 99, 28)
    const iam = normalizeIam(body.gender || body.iam)
    const relationshipGoal = normalizeRelGoal(body.intent || body.relationshipGoal)
    const relStatus = normalizeRelStatus(body.relStatus)
    const orientation = normalizeOrientation(body.orientation)
    const interests = Array.isArray(body.interests) ? body.interests : []
    const photos = Array.isArray(body.photos) && body.photos.length ? body.photos : [1, 2, 3].map((position) => ({ position }))
    const prompts = Array.isArray(body.prompts) && body.prompts.length
      ? body.prompts
      : [
          { position: 1, title: 'A PERFECT SUNDAY', answer: 'Coffee, a long walk, and a conversation that accidentally lasts two hours.' },
          { position: 2, title: 'NON-NEGOTIABLES', answer: 'Kindness, curiosity, and a real laugh.' },
          { position: 3, title: 'CONVERSATION STARTER', answer: 'Tell me the small thing you are weirdly passionate about.' },
        ]

    const [created] = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          handle,
          phone,
          phoneCountry: PHONE_COUNTRY,
          phoneVerified: true,
          twoFaMethod: 'skipped',
          age,
          iam,
          bio: body.bio ? String(body.bio).slice(0, 500) : null,
          work: body.work ? String(body.work).slice(0, 120) : null,
          relationshipGoal,
          relStatus,
          orientation,
          city: body.city ? String(body.city).slice(0, 100) : null,
          countryCode: body.countryCode ? String(body.countryCode).slice(0, 4) : 'US',
          latApprox: body.latApprox ? String(body.latApprox).slice(0, 12) : '40.71',
          lngApprox: body.lngApprox ? String(body.lngApprox).slice(0, 12) : '-74.01',
          locationGranted: true,
          profileCompletePct: 100,
          plan: body.plan && ['free', 'plus', 'platin', 'private'].includes(body.plan) ? body.plan : 'platin',
          idVerified: body.verified !== false,
        })
        .returning()

      await tx.insert(userLifestyle).values({
        userId: inserted.id,
        height: body.height ? String(body.height).slice(0, 20) : null,
        drinks: body.drinks ? String(body.drinks).slice(0, 40) : null,
        smokes: body.smokes ? String(body.smokes).slice(0, 40) : null,
        kids: body.kids ? String(body.kids).slice(0, 60) : null,
        education: body.edu ? String(body.edu).slice(0, 60) : null,
      })

      await tx.insert(userPrivacySettings).values({ userId: inserted.id })
      await tx.insert(userDiscoverPreferences).values({
        userId: inserted.id,
        maxDistance: clampInt(body.maxDistance, 1, 200, 25),
        minDistance: clampInt(body.minDistance, 0, 100, 0),
        ageMin: clampInt(body.ageMin, 18, 99, 18),
        ageMax: clampInt(body.ageMax, 18, 99, 70),
        relationshipType: relationshipGoal,
        globalMode: Boolean(body.globalMode),
      })

      await tx.insert(userPhotos).values(
        photos.slice(0, 6).map((photo, index) => ({
          userId: inserted.id,
          position: clampInt(photo.position, 1, 6, index + 1),
          storageKey: photo.storageKey ? String(photo.storageKey).slice(0, 512) : defaultPhotoStorage(handle, index + 1),
          isBlurred: photo.isBlurred ?? false,
          blurAmount: clampInt(photo.blurAmount, 0, 100, 0),
          isMain: index === 0,
        })),
      )

      if (interests.length) {
        await tx.insert(userInterests).values(
          interests.slice(0, 6).map((interest, index) => ({
            userId: inserted.id,
            interest: String(interest).slice(0, 60),
            position: index,
          })),
        )
      }

      await tx.insert(userPrompts).values(
        prompts.slice(0, 3).map((prompt, index) => ({
          userId: inserted.id,
          position: clampInt(prompt.position, 1, 3, index + 1),
          title: prompt.title ? String(prompt.title).slice(0, 80) : `Prompt ${index + 1}`,
          answer: prompt.answer ? String(prompt.answer).slice(0, 160) : 'Ask me anything.',
        })),
      )

      return [inserted]
    })

    const persona = await loadPersona(created.id)
    return res.status(201).json({ persona })
  } catch (err) {
    console.error('operated createPersona error:', err)
    return res.status(500).json({ error: 'Failed to create operated persona' })
  }
}

export async function getPersona(req, res) {
  try {
    const persona = await loadPersona(req.params.userId)
    if (!persona) return res.status(404).json({ error: 'Operated persona not found' })
    return res.json({ persona })
  } catch (err) {
    console.error('operated getPersona error:', err)
    return res.status(500).json({ error: 'Failed to load operated persona' })
  }
}

export async function updatePersona(req, res) {
  try {
    const userId = req.params.userId
    const existing = await getOperatedBase(userId)
    if (!existing) return res.status(404).json({ error: 'Operated persona not found' })

    const body = req.body || {}
    const userUpdates = {}
    if (body.bio !== undefined) userUpdates.bio = body.bio ? String(body.bio).slice(0, 500) : null
    if (body.work !== undefined) userUpdates.work = body.work ? String(body.work).slice(0, 120) : null
    if (body.gender !== undefined || body.iam !== undefined) userUpdates.iam = normalizeIam(body.gender || body.iam)
    if (body.orientation !== undefined) userUpdates.orientation = normalizeOrientation(body.orientation)
    if (body.relStatus !== undefined) userUpdates.relStatus = normalizeRelStatus(body.relStatus)
    if (body.intent !== undefined || body.relationshipGoal !== undefined) userUpdates.relationshipGoal = normalizeRelGoal(body.intent || body.relationshipGoal)
    if (body.city !== undefined) userUpdates.city = body.city ? String(body.city).slice(0, 100) : null
    if (body.age !== undefined) userUpdates.age = clampInt(body.age, 18, 99, existing.age)

    await db.transaction(async (tx) => {
      if (Object.keys(userUpdates).length) {
        await tx.update(users).set({ ...userUpdates, updatedAt: new Date() }).where(eq(users.id, userId))
      }

      await tx
        .insert(userLifestyle)
        .values({
          userId,
          height: body.height ? String(body.height).slice(0, 20) : null,
          drinks: body.drinks ? String(body.drinks).slice(0, 40) : null,
          smokes: body.smokes ? String(body.smokes).slice(0, 40) : null,
          kids: body.kids ? String(body.kids).slice(0, 60) : null,
          education: body.edu ? String(body.edu).slice(0, 60) : null,
        })
        .onConflictDoUpdate({
          target: userLifestyle.userId,
          set: {
            height: body.height ? String(body.height).slice(0, 20) : null,
            drinks: body.drinks ? String(body.drinks).slice(0, 40) : null,
            smokes: body.smokes ? String(body.smokes).slice(0, 40) : null,
            kids: body.kids ? String(body.kids).slice(0, 60) : null,
            education: body.edu ? String(body.edu).slice(0, 60) : null,
            updatedAt: new Date(),
          },
        })

      if (Array.isArray(body.interests)) {
        await tx.delete(userInterests).where(eq(userInterests.userId, userId))
        if (body.interests.length) {
          await tx.insert(userInterests).values(
            body.interests.slice(0, 6).map((interest, index) => ({
              userId,
              interest: String(interest).slice(0, 60),
              position: index,
            })),
          )
        }
      }

      if (Array.isArray(body.photos)) {
        await tx.delete(userPhotos).where(eq(userPhotos.userId, userId))
        if (body.photos.length) {
          await tx.insert(userPhotos).values(
            body.photos.slice(0, 6).map((photo, index) => ({
              userId,
              position: clampInt(photo.position, 1, 6, index + 1),
              storageKey: photo.storageKey ? String(photo.storageKey).slice(0, 512) : defaultPhotoStorage(existing.handle, index + 1),
              isBlurred: photo.isBlurred ?? false,
              blurAmount: clampInt(photo.blurAmount, 0, 100, 0),
              isMain: index === 0,
            })),
          )
        }
      }
    })

    const persona = await loadPersona(userId)
    return res.json({ persona })
  } catch (err) {
    console.error('operated updatePersona error:', err)
    return res.status(500).json({ error: 'Failed to update operated persona' })
  }
}

export async function updatePersonaStatus(req, res) {
  try {
    const existing = await getOperatedBase(req.params.userId)
    if (!existing) return res.status(404).json({ error: 'Operated persona not found' })
    const status = req.body?.status === 'paused' ? 'paused' : 'active'
    await db.update(users).set({ isPaused: status === 'paused', pausedUntil: status === 'paused' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, updatedAt: new Date() }).where(eq(users.id, existing.id))
    const persona = await loadPersona(existing.id)
    return res.json({ persona })
  } catch (err) {
    console.error('operated updatePersonaStatus error:', err)
    return res.status(500).json({ error: 'Failed to update operated persona status' })
  }
}

export async function createPersonaSession(req, res) {
  try {
    const existing = await getOperatedBase(req.params.userId)
    if (!existing) return res.status(404).json({ error: 'Operated persona not found' })
    const accessToken = signAccessTokenUser({ id: existing.id, handle: existing.handle })
    return res.json({
      accessToken,
      user: {
        id: existing.id,
        handle: existing.handle,
      },
    })
  } catch (err) {
    console.error('operated createPersonaSession error:', err)
    return res.status(500).json({ error: 'Failed to create operated persona session' })
  }
}

export async function getPersonaStats(req, res) {
  try {
    const existing = await getOperatedBase(req.params.userId)
    if (!existing) return res.status(404).json({ error: 'Operated persona not found' })
    const userId = existing.id
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const [matchCount, activeCount, messagesToday, repliedMatches, totalMatches, activityRows] = await Promise.all([
      db.select({ count: sql`count(*)::int` }).from(matches).where(or(eq(matches.userAId, userId), eq(matches.userBId, userId))),
      db.select({ count: sql`count(*)::int` }).from(matches).where(and(or(eq(matches.userAId, userId), eq(matches.userBId, userId)), eq(matches.isActive, true))),
      db.select({ count: sql`count(*)::int` }).from(messages).where(and(eq(messages.senderId, userId), sql`${messages.createdAt} >= ${today}`, isNull(messages.deletedAt))),
      db.select({ count: sql`count(*)::int` }).from(matches).where(and(or(eq(matches.userAId, userId), eq(matches.userBId, userId)), sql`${matches.messageCountUserA} > 0`, sql`${matches.messageCountUserB} > 0`)),
      db.select({ count: sql`count(*)::int` }).from(matches).where(or(eq(matches.userAId, userId), eq(matches.userBId, userId))),
      db
        .select({
          id: messages.id,
          createdAt: messages.createdAt,
          content: messages.content,
          matchId: messages.matchId,
        })
        .from(messages)
        .where(and(eq(messages.senderId, userId), isNull(messages.deletedAt)))
        .orderBy(desc(messages.createdAt))
        .limit(10),
    ])

    const total = Number(totalMatches[0]?.count || 0)
    const replied = Number(repliedMatches[0]?.count || 0)
    return res.json({
      stats: {
        matches: Number(matchCount[0]?.count || 0),
        active: Number(activeCount[0]?.count || 0),
        msgsToday: Number(messagesToday[0]?.count || 0),
        replyRate: total ? Math.round((replied / total) * 100) : 0,
        lastActive: existing.updatedAt,
      },
      activity: activityRows.map((row) => ({
        id: row.id,
        time: row.createdAt,
        actor: existing.handle,
        kind: 'sent',
        detail: row.content,
        matchId: row.matchId,
      })),
    })
  } catch (err) {
    console.error('operated getPersonaStats error:', err)
    return res.status(500).json({ error: 'Failed to load operated persona stats' })
  }
}
