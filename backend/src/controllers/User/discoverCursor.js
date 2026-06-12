// Discover-deck cursor helpers.
//
// The discover query sorts by up to four keys:
//   1. boostRank   — 0 when the user has an active boost, 1 otherwise (always)
//   2. compatRank  — 0/1/2 compatibility tier (only when advancedCompatibility)
//   3. distance    — miles from the viewer (only in local/distance mode)
//   4. id          — stable tiebreaker (always)
//
// For keyset pagination to be correct, the cursor must carry *every* sort key,
// not just distance+id — otherwise page 2+ can skip boosted profiles or repeat
// rows. The v2 cursor encodes all keys; the legacy v1 format ("distance|id")
// is still decoded so in-flight clients don't break mid-session.

const V2_PREFIX = '2'

export function decodeDiscoverCursor(raw) {
  if (!raw || typeof raw !== 'string') return null
  let decoded
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const parts = decoded.split('|')

  if (parts[0] === V2_PREFIX && parts.length === 5) {
    const [, boostStr, compatStr, distanceStr, id] = parts
    const boostRank = Number(boostStr)
    if (!Number.isInteger(boostRank) || !id) return null
    const compatRank = compatStr === '' ? null : Number(compatStr)
    const distance = distanceStr === '' ? null : Number(distanceStr)
    if (compatRank !== null && !Number.isInteger(compatRank)) return null
    if (distance !== null && !Number.isFinite(distance)) return null
    return { version: 2, boostRank, compatRank, distance, id }
  }

  // Legacy v1: "distance|id"
  if (parts.length === 2) {
    const distance = Number(parts[0])
    const id = parts[1]
    if (!Number.isFinite(distance) || !id) return null
    return { version: 1, distance, id }
  }

  return null
}

export function encodeDiscoverCursor({ boostRank, compatRank = null, distance = null, id }) {
  const compat = compatRank == null ? '' : String(compatRank)
  const dist = distance == null ? '' : String(distance)
  const payload = `${V2_PREFIX}|${Number(boostRank)}|${compat}|${dist}|${id}`
  return Buffer.from(payload, 'utf8').toString('base64url')
}
