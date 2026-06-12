import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeDiscoverCursor, encodeDiscoverCursor } from '../src/controllers/User/discoverCursor.js'

// ─── encode/decode round-trips ────────────────────────────────────────────────

test('v2 cursor round-trips all sort keys', () => {
  const raw = encodeDiscoverCursor({
    boostRank: 0,
    compatRank: 2,
    distance: 12.3456789,
    id: '0b9f9d2e-1111-4222-8333-444455556666',
  })
  const decoded = decodeDiscoverCursor(raw)
  assert.deepEqual(decoded, {
    version: 2,
    boostRank: 0,
    compatRank: 2,
    distance: 12.3456789,
    id: '0b9f9d2e-1111-4222-8333-444455556666',
  })
})

test('v2 cursor round-trips with null compat and distance (global mode)', () => {
  const raw = encodeDiscoverCursor({ boostRank: 1, id: 'abc' })
  const decoded = decodeDiscoverCursor(raw)
  assert.deepEqual(decoded, {
    version: 2,
    boostRank: 1,
    compatRank: null,
    distance: null,
    id: 'abc',
  })
})

test('legacy v1 cursor ("distance|id") still decodes', () => {
  const raw = Buffer.from('7.25|some-uuid', 'utf8').toString('base64url')
  const decoded = decodeDiscoverCursor(raw)
  assert.deepEqual(decoded, { version: 1, distance: 7.25, id: 'some-uuid' })
})

test('malformed cursors decode to null', () => {
  assert.equal(decodeDiscoverCursor(null), null)
  assert.equal(decodeDiscoverCursor(''), null)
  assert.equal(decodeDiscoverCursor('not-base64-payload'), null)
  // v1 shape with non-numeric distance
  assert.equal(decodeDiscoverCursor(Buffer.from('NaN-ish|id').toString('base64url')), null)
  // v2 shape with non-integer boost rank
  assert.equal(decodeDiscoverCursor(Buffer.from('2|x||1.5|id').toString('base64url')), null)
  // v2 shape missing id
  assert.equal(decodeDiscoverCursor(Buffer.from('2|0||1.5|').toString('base64url')), null)
})

// ─── boosted-first ordering across paginated results ─────────────────────────
// Simulates the discover query's ORDER BY (boostRank, [compatRank], [distance], id)
// plus the v2 keyset WHERE: (keys...) > (cursor keys...), lexicographically —
// the exact semantics of Postgres row-wise comparison used in discover.js.

function sortTuple(row, { advancedCompatibility, distanceMode }) {
  const keys = [row.boostRank]
  if (advancedCompatibility) keys.push(row.compatRank)
  if (distanceMode) keys.push(row.distance)
  keys.push(row.id)
  return keys
}

function tupleGreater(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false
}

function fetchPage(rows, { cursor, limit, advancedCompatibility, distanceMode }) {
  const sorted = [...rows].sort((r1, r2) => {
    const t1 = sortTuple(r1, { advancedCompatibility, distanceMode })
    const t2 = sortTuple(r2, { advancedCompatibility, distanceMode })
    return tupleGreater(t1, t2) ? 1 : tupleGreater(t2, t1) ? -1 : 0
  })

  let filtered = sorted
  if (cursor) {
    const cursorTuple = [cursor.boostRank]
    if (advancedCompatibility && cursor.compatRank != null) cursorTuple.push(cursor.compatRank)
    if (distanceMode && cursor.distance != null) cursorTuple.push(cursor.distance)
    cursorTuple.push(cursor.id)
    filtered = sorted.filter((row) =>
      tupleGreater(sortTuple(row, { advancedCompatibility, distanceMode }).slice(0, cursorTuple.length), cursorTuple),
    )
  }

  const page = filtered.slice(0, limit)
  const hasMore = filtered.length > limit
  const last = page[page.length - 1]
  const nextCursor = hasMore && last
    ? decodeDiscoverCursor(encodeDiscoverCursor({
        boostRank: last.boostRank,
        compatRank: advancedCompatibility ? last.compatRank : null,
        distance: distanceMode ? last.distance : null,
        id: last.id,
      }))
    : null
  return { page, nextCursor }
}

function paginateAll(rows, opts) {
  const seen = []
  let cursor = null
  for (let i = 0; i < 20; i++) {
    const { page, nextCursor } = fetchPage(rows, { ...opts, cursor })
    seen.push(...page)
    if (!nextCursor) break
    cursor = nextCursor
  }
  return seen
}

function makeRows() {
  // ids chosen so boosted users sort *late* by id — the old distance|id cursor
  // would have skipped them on page 2.
  return [
    { id: 'a1', boostRank: 1, compatRank: 0, distance: 1.0 },
    { id: 'b2', boostRank: 1, compatRank: 1, distance: 2.0 },
    { id: 'c3', boostRank: 1, compatRank: 2, distance: 3.0 },
    { id: 'd4', boostRank: 1, compatRank: 0, distance: 4.0 },
    { id: 'e5', boostRank: 1, compatRank: 1, distance: 5.0 },
    { id: 'x8', boostRank: 0, compatRank: 2, distance: 8.0 },
    { id: 'y9', boostRank: 0, compatRank: 0, distance: 9.0 },
  ]
}

test('boosted profiles come first across all pages (local mode)', () => {
  const rows = makeRows()
  const all = paginateAll(rows, { limit: 2, advancedCompatibility: false, distanceMode: true })

  assert.equal(all.length, rows.length, 'no rows skipped or duplicated')
  assert.equal(new Set(all.map((r) => r.id)).size, rows.length)
  // Both boosted users appear before every non-boosted one
  assert.deepEqual(all.slice(0, 2).map((r) => r.id).sort(), ['x8', 'y9'])
  const boostRanks = all.map((r) => r.boostRank)
  assert.deepEqual(boostRanks, [...boostRanks].sort((a, b) => a - b), 'boost rank is monotonic across pages')
})

test('boosted profiles come first across all pages (global mode, id-only tiebreak)', () => {
  const rows = makeRows()
  const all = paginateAll(rows, { limit: 3, advancedCompatibility: false, distanceMode: false })

  assert.equal(all.length, rows.length)
  assert.deepEqual(all.map((r) => r.id), ['x8', 'y9', 'a1', 'b2', 'c3', 'd4', 'e5'])
})

test('compatibility tier ordering holds within boost tiers when enabled', () => {
  const rows = makeRows()
  const all = paginateAll(rows, { limit: 2, advancedCompatibility: true, distanceMode: true })

  assert.equal(all.length, rows.length)
  assert.deepEqual(all.map((r) => r.id), ['y9', 'x8', 'a1', 'd4', 'b2', 'e5', 'c3'])
})

test('page boundaries never repeat or drop rows around equal distances', () => {
  // Two rows with identical distance — id is the tiebreaker the cursor must carry.
  const rows = [
    { id: 'a', boostRank: 1, compatRank: 0, distance: 5.0 },
    { id: 'b', boostRank: 1, compatRank: 0, distance: 5.0 },
    { id: 'c', boostRank: 0, compatRank: 0, distance: 5.0 },
    { id: 'd', boostRank: 0, compatRank: 0, distance: 5.0 },
  ]
  const all = paginateAll(rows, { limit: 1, advancedCompatibility: false, distanceMode: true })
  assert.deepEqual(all.map((r) => r.id), ['c', 'd', 'a', 'b'])
})
