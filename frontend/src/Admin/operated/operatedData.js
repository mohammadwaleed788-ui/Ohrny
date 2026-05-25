export const personasSeed = [
  {
    id: 'op_1',
    name: 'Amelia Voss',
    age: 27,
    gender: 'Woman',
    orientation: 'Straight',
    city: 'Brooklyn, NY',
    country: 'US',
    hue: 12,
    status: 'active',
    bio: 'Jazz records on Sunday mornings, unsolicited book recs, very much a dog person. Ask me about my failed sourdough era.',
    work: 'Editorial at a small magazine',
    edu: 'NYU',
    height: '5\'6"',
    relStatus: 'Single',
    intent: 'Long-term',
    drinks: 'Socially',
    smokes: 'No',
    kids: 'Wants someday',
    interests: ['jazz', 'reading', 'coffee', 'dogs', 'design', 'slow-living'],
    photos: 4,
    verified: true,
    plan: 'Gold',
    createdBy: 'Elena M.',
    team: 'Seed - NYC',
    stats: { matches: 184, active: 17, msgsToday: 23, replyRate: 67, lastActive: '2m ago' },
  },
  {
    id: 'op_2',
    name: 'Marcus Reid',
    age: 31,
    gender: 'Man',
    orientation: 'Straight',
    city: 'Austin, TX',
    country: 'US',
    hue: 90,
    status: 'active',
    bio: 'PM by day, weekend climber. Dry sense of humor, fair warning.',
    work: 'Senior PM - fintech',
    edu: 'UT Austin',
    height: '6\'0"',
    relStatus: 'Single',
    intent: 'Long-term',
    drinks: 'Yes',
    smokes: 'No',
    kids: 'Wants',
    interests: ['climbing', 'sourdough', 'design', 'podcasts'],
    photos: 5,
    verified: true,
    plan: 'Platinum',
    createdBy: 'Jordan P.',
    team: 'Seed - TX',
    stats: { matches: 221, active: 12, msgsToday: 19, replyRate: 71, lastActive: 'just now' },
  },
  {
    id: 'op_3',
    name: 'Sasha Lindqvist',
    age: 26,
    gender: 'Non-binary',
    orientation: 'Bi',
    city: 'Seattle, WA',
    country: 'US',
    hue: 180,
    status: 'active',
    bio: 'Writing a novel about whales. Kayaks over boats. Looking for curious people.',
    work: 'UX writer',
    edu: 'UW',
    height: '5\'8"',
    relStatus: 'Single',
    intent: 'Figuring it out',
    drinks: 'Sometimes',
    smokes: 'No',
    kids: 'Open',
    interests: ['books', 'hiking', 'museums', 'cinema'],
    photos: 3,
    verified: true,
    plan: 'Free',
    createdBy: 'Elena M.',
    team: 'Seed - NW',
    stats: { matches: 97, active: 8, msgsToday: 11, replyRate: 58, lastActive: '14m ago' },
  },
  {
    id: 'op_4',
    name: 'Nina Akhtar',
    age: 33,
    gender: 'Woman',
    orientation: 'Straight',
    city: 'London, UK',
    country: 'UK',
    hue: 260,
    status: 'paused',
    bio: 'Architect, obsessed with Japanese joinery and jazz. Tea before coffee.',
    work: 'Architect - studio of 8',
    edu: 'Bartlett UCL',
    height: '5\'5"',
    relStatus: 'Divorced',
    intent: 'Long-term',
    drinks: 'Rarely',
    smokes: 'No',
    kids: 'Has two',
    interests: ['jazz', 'architecture', 'cats', 'wine', 'running'],
    photos: 6,
    verified: true,
    plan: 'Platinum',
    createdBy: 'Priya V.',
    team: 'Seed - UK',
    stats: { matches: 312, active: 0, msgsToday: 0, replyRate: 74, lastActive: '3d ago' },
  },
  {
    id: 'op_5',
    name: 'Leo Navarro',
    age: 29,
    gender: 'Man',
    orientation: 'Gay',
    city: 'Los Angeles, CA',
    country: 'US',
    hue: 330,
    status: 'active',
    bio: 'Film photographer, plant dad, horror movie apologist.',
    work: 'Freelance photographer',
    edu: 'CalArts',
    height: '5\'10"',
    relStatus: 'Single',
    intent: 'Long-term',
    drinks: 'Yes',
    smokes: 'No',
    kids: 'Open',
    interests: ['film', 'photography', 'plants', 'horror', 'vinyl'],
    photos: 5,
    verified: true,
    plan: 'Gold',
    createdBy: 'Jordan P.',
    team: 'Seed - LA',
    stats: { matches: 168, active: 14, msgsToday: 16, replyRate: 63, lastActive: '5m ago' },
  },
]

const firstNames = ['Olivia', 'Daniel', 'Maya', 'Priya', 'Jacob', 'Ines', 'Tom', 'Rina', 'Evan', 'Harper', 'Sam', 'Zoe', 'Liam', 'Aisha', 'Noah', 'Mia', 'Felix', 'Chloe', 'Mateo', 'Ada', 'Hugo', 'Yuki', 'Nina', 'Leo', 'Amir', 'Sofia', 'Kai', 'Lina', 'Theo', 'Cara', 'Anders', 'Maja', 'Lukas']
const lastInitials = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'K.', 'L.', 'M.', 'N.', 'O.', 'P.', 'R.', 'S.', 'T.', 'V.']
const previews = ['Running late tonight, raincheck?', 'You had me at sourdough.', 'Book rec please', 'coffee spot on 5th?', 'haha same', 'send me the jazz playlist', 'saturday?', 'whatcha reading rn', 'love that neighborhood', 'ok but where is the best espresso here', 'you free tonight?', 'reschedule for next week?', 'sunday brunch?']
const times = ['just now', '2m', '8m', '18m', '32m', '1h', '2h', '3h', '5h', '7h', 'yesterday', '2d', '3d']
const cities = ['New York', 'Brooklyn', 'Los Angeles', 'Chicago', 'Austin', 'Seattle', 'Miami', 'San Francisco', 'London', 'Berlin', 'Paris', 'Toronto']

function hashSeed(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  return function next() {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function sample(rand, list) {
  return list[Math.floor(rand() * list.length)]
}

function makeMessages(rand, first) {
  const sets = [
    [{ from: 'them', text: 'Hey! How is your week going?', time: 'Mon 2:14 pm' }],
    [
      { from: 'them', text: 'Your bio made me laugh', time: 'Mon 9:40 am' },
      { from: 'mine', text: 'That was the intent. Which bit?', time: 'Mon 9:42 am' },
      { from: 'them', text: 'the sourdough era. felt that', time: 'Mon 9:44 am' },
    ],
    [
      { from: 'them', text: 'coffee spot on 5th?', time: 'Tue 4:22 pm' },
      { from: 'mine', text: 'the one with the plants? better light than coffee honestly', time: 'Tue 4:31 pm' },
      { from: 'them', text: 'haha. saturday 10?', time: 'Tue 4:33 pm' },
    ],
  ]
  return sample(rand, sets).map((message, index) => ({ ...message, id: `${first}-${index}-${Math.floor(rand() * 10000)}` }))
}

export function makeThreads(personaId, hue, count = 1025) {
  const rand = mulberry32(hashSeed(personaId))
  return Array.from({ length: count }, (_, index) => {
    const first = sample(rand, firstNames)
    const timeIndex = Math.floor(rand() * times.length)
    const unreadRoll = rand()
    let unread = unreadRoll > 0.55 ? 1 + Math.floor(rand() * 2) : 0
    if (unreadRoll > 0.85) unread = 3 + Math.floor(rand() * 4)
    if (unreadRoll > 0.97) unread = 7 + Math.floor(rand() * 12)

    return {
      id: `${personaId}_t${index}`,
      name: `${first} ${sample(rand, lastInitials)}`,
      handle: `@${first.toLowerCase()}${Math.floor(rand() * 900) + 10}`,
      preview: sample(rand, previews),
      time: times[timeIndex],
      timeRank: timeIndex,
      unread,
      flagged: rand() < 0.04,
      age: 22 + Math.floor(rand() * 18),
      city: sample(rand, cities),
      matchedOn: ['Apr 18', 'Apr 20', 'Apr 14', 'Mar 29', 'Apr 21'][index % 5],
      hue: (hue + index * 37) % 360,
      messages: makeMessages(rand, first),
    }
  })
}

export function makeFeed(personaId) {
  return [
    { id: `${personaId}_f1`, name: 'River Ng', age: 29, hue: 40, distance: '4 mi', neighborhood: 'Park Slope', bio: 'Film photog, very into plants. Looking for someone who gets excited about museum gift shops.', pills: ['photography', 'plants', 'museums'] },
    { id: `${personaId}_f2`, name: 'Taylor Brooks', age: 27, hue: 150, distance: '7 mi', neighborhood: 'Greenpoint', bio: 'Runs a bookstore. Makes good coffee. Loves a plan but flexible on the plan.', pills: ['books', 'coffee', 'cooking'] },
    { id: `${personaId}_f3`, name: 'Noor al-Sabah', age: 31, hue: 220, distance: '11 mi', neighborhood: 'Long Island City', bio: 'Neuroscience PhD, climbs V5, terrible cook, will still cook for you.', pills: ['climbing', 'science', 'dogs'] },
    { id: `${personaId}_f4`, name: 'Devin Park', age: 26, hue: 300, distance: '3 mi', neighborhood: 'Fort Greene', bio: 'Jazz drummer. Looking for someone with a strong opinion about a weird movie.', pills: ['jazz', 'drums', 'film'] },
  ]
}

export function makeActivity(personaId) {
  return [
    { id: `${personaId}_a1`, time: '12m ago', actor: 'Elena M.', kind: 'sent', detail: 'sent message to @olivia_t' },
    { id: `${personaId}_a2`, time: '48m ago', actor: 'Jordan P.', kind: 'swipe', detail: 'right-swiped 6 profiles' },
    { id: `${personaId}_a3`, time: '2h ago', actor: 'Elena M.', kind: 'edit', detail: 'updated bio' },
    { id: `${personaId}_a4`, time: '5h ago', actor: 'Priya V.', kind: 'photo', detail: 'added photo #4' },
    { id: `${personaId}_a5`, time: 'yesterday', actor: 'System', kind: 'flag', detail: 'auto-flagged a conversation for review' },
  ]
}

export const aiSuggestions = ['Keep it playful', 'Ask a question', 'Propose meeting up', 'Check in after silence']
