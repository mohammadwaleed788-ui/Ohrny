import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { userTravelLocations } from '../../../db/schema/settings.js'
import { getEffectiveEntitlements } from '../../services/entitlementService.js'

const MAX_SAVED = 20

// "Travel to all cities" (saved favorites) is a Platin/Private perk. Plus users
// still get travel mode, but only the single active pin on their prefs row.
async function hasAllCities(userId) {
  const ent = await getEffectiveEntitlements(userId)
  return ['platin', 'private'].includes(ent?.plan)
}

function isCoord(v) {
  const n = Number(v)
  return Number.isFinite(n)
}

export async function listTravelLocations(req, res) {
  try {
    if (!(await hasAllCities(req.user.id))) return res.json({ locations: [] })
    const rows = await db
      .select({
        id: userTravelLocations.id,
        lat: userTravelLocations.lat,
        lng: userTravelLocations.lng,
        city: userTravelLocations.city,
        createdAt: userTravelLocations.createdAt,
      })
      .from(userTravelLocations)
      .where(eq(userTravelLocations.userId, req.user.id))
      .orderBy(desc(userTravelLocations.createdAt))
    return res.json({ locations: rows })
  } catch (err) {
    console.error('listTravelLocations error:', err)
    return res.status(500).json({ error: 'Failed to load saved places' })
  }
}

export async function addTravelLocation(req, res) {
  try {
    if (!(await hasAllCities(req.user.id))) {
      return res.status(403).json({ error: 'feature_locked', paywall: 'platin' })
    }
    const { lat, lng, city } = req.body || {}
    if (!isCoord(lat) || !isCoord(lng) || !city) {
      return res.status(400).json({ error: 'lat, lng and city are required' })
    }

    const [countRow] = await db
      .select({ count: sql`count(*)::int` })
      .from(userTravelLocations)
      .where(eq(userTravelLocations.userId, req.user.id))
    if (Number(countRow?.count || 0) >= MAX_SAVED) {
      return res.status(409).json({ error: 'saved_places_full', max: MAX_SAVED })
    }

    const [row] = await db
      .insert(userTravelLocations)
      .values({
        userId: req.user.id,
        lat: String(Number(lat)),
        lng: String(Number(lng)),
        city: String(city).slice(0, 120),
      })
      .returning()
    return res.json({ ok: true, location: row })
  } catch (err) {
    console.error('addTravelLocation error:', err)
    return res.status(500).json({ error: 'Failed to save place' })
  }
}

export async function deleteTravelLocation(req, res) {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'id required' })
    await db
      .delete(userTravelLocations)
      .where(and(eq(userTravelLocations.id, id), eq(userTravelLocations.userId, req.user.id)))
    return res.json({ ok: true })
  } catch (err) {
    console.error('deleteTravelLocation error:', err)
    return res.status(500).json({ error: 'Failed to remove place' })
  }
}
