/**
 * Seed script: 20 discovery candidates + 1 test viewer near San Francisco.
 * Run with: node db/seed_users.js
 *
 * Idempotent: deletes all users with phone in the 555-010-xxxx range before inserting.
 * Photos: set photosBlurred: true to simulate locked profiles.
 */

import 'dotenv/config'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema/index.js'

const { users, userPhotos, userLifestyle, userPrompts, userInterests, userDiscoverPreferences } = schema

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })

// San Francisco base: 37.7749, -122.4194
// 1° lat ≈ 69 mi, 1° lng ≈ 54.6 mi at 37.7°
function sfOffset(milesNorth, milesEast = 0) {
  const lat = (37.7749 + milesNorth / 69).toFixed(4)
  const lng = (-122.4194 + milesEast / 54.6).toFixed(4)
  return { lat, lng }
}

// ─── Candidates ───────────────────────────────────────────────────────────────

const CANDIDATES = [

  // ── Women · open photos ──────────────────────────────────────────────────

  {
    handle: 'Emma', phone: '5550100001', age: 28, iam: 'woman',
    pronouns: 'she/her', relStatus: 'single', relationshipGoal: 'dating',
    looking: 'Something real, slow-built',
    bio: 'Slow coffee, the good bookstore, and a walk that takes the long way home.',
    aboutMe: 'Graphic designer at a small studio. I like weekends where nothing is planned but everything happens. Honest, low-drama, occasionally too earnest.',
    city: 'San Francisco', ...sfOffset(0.5, 0.3), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/1.jpg', 'https://randomuser.me/api/portraits/women/2.jpg', 'https://randomuser.me/api/portraits/women/3.jpg'],
    lifestyle: { height: "5'6\"", drinks: 'Socially', smokes: 'Never', kids: 'Want someday', pets: 'One cat', diet: 'Mostly veggie', exercise: 'A few times a week', zodiac: 'Libra', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'A PERFECT SUNDAY', answer: 'Slow coffee, the good bookstore, and a walk that takes the long way home.' },
      { position: 2, title: 'NON-NEGOTIABLES', answer: 'A real laugh. Kindness to strangers. Coffee before conversation.' },
      { position: 3, title: 'MY IDEAL WEEKEND', answer: 'Something new on Saturday, something slow on Sunday.' },
    ],
    interests: ['Long walks', 'Bookstores', 'Live music', 'Cooking in', 'Weekend markets'],
  },

  {
    handle: 'Sofia', phone: '5550100002', age: 25, iam: 'woman',
    pronouns: 'she/they', relStatus: 'single', relationshipGoal: 'dating',
    looking: 'Long walks, longer dinners',
    bio: 'I will remember the small thing you mentioned in passing last Tuesday.',
    aboutMe: 'Ceramicist and part-time hiking guide. I will always order the weird thing on the menu. Looking for someone who finds ordinary moments interesting.',
    city: 'San Francisco', ...sfOffset(1.0, -0.5), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/5.jpg', 'https://randomuser.me/api/portraits/women/6.jpg', 'https://randomuser.me/api/portraits/women/7.jpg'],
    lifestyle: { height: "5'4\"", drinks: 'Never', smokes: 'Never', kids: 'Open to it', pets: 'Dog lover', diet: 'Vegan', exercise: 'Daily', zodiac: 'Pisces', education: "Master's" },
    prompts: [
      { position: 1, title: 'THE WAY TO MY HEART', answer: 'Remember the small thing I mentioned in passing last Tuesday.' },
      { position: 2, title: 'I WILL ALWAYS WANT TO', answer: 'Find a hidden gem café before anyone else does.' },
      { position: 3, title: 'MY LOVE LANGUAGE', answer: 'Noticing the details that most people miss.' },
    ],
    interests: ['Ceramics', 'Hiking', 'Vinyl records', 'Farmers markets', 'Baking'],
  },

  {
    handle: 'Aria', phone: '5550100003', age: 27, iam: 'woman',
    pronouns: 'she/her', relStatus: 'single', relationshipGoal: 'serious',
    looking: 'Partner in quiet trouble',
    bio: 'The best nights start with "I know this place" and no further explanation.',
    aboutMe: 'Photographer and occasional chef. I think getting lost on purpose is a valid activity. I will make you try the weird dish and you will like it.',
    city: 'San Francisco', ...sfOffset(2.5, 1.0), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/15.jpg', 'https://randomuser.me/api/portraits/women/16.jpg', 'https://randomuser.me/api/portraits/women/17.jpg'],
    lifestyle: { height: "5'5\"", drinks: 'Socially', smokes: 'Never', kids: 'Maybe', pets: 'One rescue dog', diet: 'Mostly veggie', exercise: 'A few times a week', zodiac: 'Gemini', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'BEST TRAVEL STORY', answer: 'The best nights start with "I know this place" and no further explanation.' },
      { position: 2, title: 'MY KITCHEN SPECIALTY', answer: 'Whatever requires the most obscure ingredient from that tiny market on 24th.' },
      { position: 3, title: 'WHAT I LEARNED LAST YEAR', answer: 'How to say no without explaining myself.' },
    ],
    interests: ['Film photography', 'Cooking', 'Travel', 'Wine', 'Architecture'],
  },

  {
    handle: 'Nova', phone: '5550100004', age: 32, iam: 'woman',
    pronouns: 'she/her', relStatus: 'single', relationshipGoal: 'serious',
    looking: 'Slow, serious, silly',
    bio: 'I will always stop to look at the dog. Always.',
    aboutMe: "Environmental lawyer who spends weekends trying to be a completely different person. Serious about some things, not serious about most. Let's figure out which is which.",
    city: 'Oakland', ...sfOffset(4.0, 2.5), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/20.jpg', 'https://randomuser.me/api/portraits/women/21.jpg', 'https://randomuser.me/api/portraits/women/22.jpg'],
    lifestyle: { height: "5'7\"", drinks: 'Socially', smokes: 'Never', kids: 'Want someday', pets: 'Two dogs', diet: 'Omnivore', exercise: 'Daily', zodiac: 'Taurus', education: 'JD' },
    prompts: [
      { position: 1, title: 'A DEALBREAKER FOR ME', answer: 'Being mean to service staff. Instant red flag, no exceptions.' },
      { position: 2, title: 'MOST SPONTANEOUS THING', answer: 'Booked a flight to Lisbon because someone said the pastéis de nata were worth it. They were.' },
      { position: 3, title: 'MY SIMPLE PLEASURES', answer: 'Farmers market, good bread, the first sip of coffee on a slow morning.' },
    ],
    interests: ['Dogs', 'Running', 'Reading', 'Travel', 'Cooking for friends'],
  },

  {
    handle: 'Cleo', phone: '5550100005', age: 33, iam: 'woman',
    pronouns: 'she/her', relStatus: 'single', relationshipGoal: 'casual',
    looking: 'One person, really known',
    bio: 'I make a very good breakfast and I am not afraid to admit it.',
    aboutMe: 'ER nurse who somehow stays optimistic. I have a dark sense of humor and a very good breakfast game. Looking for someone who can keep up with both.',
    city: 'San Francisco', ...sfOffset(6.0, -0.5), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/35.jpg', 'https://randomuser.me/api/portraits/women/36.jpg', 'https://randomuser.me/api/portraits/women/37.jpg'],
    lifestyle: { height: "5'8\"", drinks: 'Socially', smokes: 'Never', kids: 'Have one', pets: 'Dog and fish', diet: 'Omnivore', exercise: 'Daily — it keeps me sane', zodiac: 'Cancer', education: 'BSN' },
    prompts: [
      { position: 1, title: 'MY SUPERPOWER', answer: 'Reading the room. And making very good eggs.' },
      { position: 2, title: 'HOW I RECHARGE', answer: 'Long run, hot shower, something funny on TV, no talking.' },
      { position: 3, title: 'I WILL SHOW YOU', answer: "The coffee spot where they know my order. It took three years, it was worth it." },
    ],
    interests: ['Running', 'Coffee', 'True crime', 'Cooking', 'Live comedy'],
  },

  {
    handle: 'Maya', phone: '5550100006', age: 31, iam: 'woman',
    pronouns: 'she/her', relStatus: 'single', relationshipGoal: 'casual',
    looking: 'Real and present',
    bio: 'I think the best conversations happen when neither person is trying to be impressive.',
    aboutMe: 'UX researcher who spends too much time thinking about how people make decisions. Also spends too much time at the farmers market. These two things are related.',
    city: 'San Francisco', ...sfOffset(8.0, -1.5), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/45.jpg', 'https://randomuser.me/api/portraits/women/46.jpg', 'https://randomuser.me/api/portraits/women/47.jpg'],
    lifestyle: { height: "5'6\"", drinks: 'Socially', smokes: 'Never', kids: 'Undecided', pets: 'Two cats', diet: 'Flexitarian', exercise: 'A few times a week', zodiac: 'Sagittarius', education: "Master's" },
    prompts: [
      { position: 1, title: 'I AM MOST MYSELF WHEN', answer: 'Cooking for people I like with music on and nowhere to be.' },
      { position: 2, title: 'A SMALL THING I LOVE', answer: 'When someone laughs at something before they have finished reading it.' },
      { position: 3, title: 'LOOKING FOR SOMEONE WHO', answer: 'Shows up with their actual self, not their highlight reel.' },
    ],
    interests: ['Cooking', 'Research', 'Cats', 'Farmers markets', 'Documentaries'],
  },

  {
    handle: 'Isla', phone: '5550100007', age: 29, iam: 'woman',
    pronouns: 'she/her', relStatus: 'single', relationshipGoal: 'serious',
    looking: 'Something that grows quietly',
    bio: 'I will always take the long route if it means walking through the good park.',
    aboutMe: "Landscape architect. I think about how spaces make people feel, which means I overthink coffee shops and genuinely love empty plazas at dusk. Looking for someone to overthink things with.",
    city: 'Berkeley', ...sfOffset(5.5, 2.0), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/30.jpg', 'https://randomuser.me/api/portraits/women/31.jpg', 'https://randomuser.me/api/portraits/women/32.jpg'],
    lifestyle: { height: "5'6\"", drinks: 'Socially', smokes: 'Never', kids: 'Want someday', pets: 'One old cat', diet: 'Mostly veggie', exercise: 'Cycling', zodiac: 'Virgo', education: "Master's" },
    prompts: [
      { position: 1, title: 'MY PERFECT DAY', answer: 'Slow morning, farmers market, long bike ride, cook something that takes effort, eat it outside.' },
      { position: 2, title: 'I AM WORKING ON', answer: 'Getting better at doing nothing. It is harder than it sounds.' },
      { position: 3, title: 'BEST QUALITY I BRING', answer: 'I notice when the light is good. I will make you stop and look.' },
    ],
    interests: ['Cycling', 'Plants', 'Architecture', 'Cooking', 'Long walks'],
  },

  // ── Women · blurred photos ───────────────────────────────────────────────

  {
    handle: 'Jade', phone: '5550100008', age: 26, iam: 'woman',
    pronouns: 'she/they', relStatus: 'single', relationshipGoal: 'casual',
    looking: 'Something honest and a little surprising',
    bio: 'I will absolutely judge you on your bookshelf, but in an interested way.',
    aboutMe: "Editor at a small press. I spend my days thinking about sentences and my evenings forgetting about them. Looking for someone to build a shared vocabulary with.",
    city: 'San Francisco', ...sfOffset(7.0, 1.5), photosBlurred: true,
    photos: ['https://randomuser.me/api/portraits/women/40.jpg', 'https://randomuser.me/api/portraits/women/41.jpg', 'https://randomuser.me/api/portraits/women/42.jpg'],
    lifestyle: { height: "5'5\"", drinks: 'Wine, mostly', smokes: 'Never', kids: 'Maybe later', pets: 'One plant named Gerald', diet: 'Omnivore', exercise: 'Yoga and walking', zodiac: 'Capricorn', education: 'MFA' },
    prompts: [
      { position: 1, title: 'WHAT I LOOK FOR', answer: 'Someone who gets excited about things. The subject does not matter.' },
      { position: 2, title: 'A COMFORT', answer: 'Rereading a book I already know. The ending is not the point.' },
      { position: 3, title: 'CONVERSATION STARTER', answer: 'What is a word you use that other people look up?' },
    ],
    interests: ['Books', 'Writing', 'Poetry readings', 'Coffee shops', 'Museums'],
  },

  {
    handle: 'Luna', phone: '5550100009', age: 30, iam: 'nonbinary',
    pronouns: 'they/them', relStatus: 'single', relationshipGoal: 'non_monogamy',
    looking: 'See what happens',
    bio: 'Old maps, fermentation science, and the acoustics of empty train stations.',
    aboutMe: 'Researcher by day, fermentation nerd by night. I have opinions about rye bread and will share them freely. Curious about things that have no practical value.',
    city: 'San Francisco', ...sfOffset(3.0, -1.5), photosBlurred: true,
    photos: ['https://randomuser.me/api/portraits/women/10.jpg', 'https://randomuser.me/api/portraits/women/11.jpg', 'https://randomuser.me/api/portraits/women/12.jpg'],
    lifestyle: { height: "5'8\"", drinks: 'Socially', smokes: 'Sometimes', kids: 'Not for me', pets: 'Allergic, sadly', diet: 'Omnivore', exercise: 'Occasionally', zodiac: 'Scorpio', education: 'PhD' },
    prompts: [
      { position: 1, title: 'I GEEK OUT ON', answer: 'Old maps, fermentation science, and the acoustics of empty train stations.' },
      { position: 2, title: 'A GREEN FLAG FOR ME', answer: "You're curious about things that have no practical value." },
      { position: 3, title: 'CHANGE MY MIND', answer: 'Sourdough is overrated. Rye is better.' },
    ],
    interests: ['Fermentation', 'Old maps', 'Architecture', 'Jazz', 'Foraging'],
  },

  {
    handle: 'Zara', phone: '5550100010', age: 24, iam: 'woman',
    pronouns: 'she/her', relStatus: 'single', relationshipGoal: 'casual',
    looking: 'Depth over breadth',
    bio: 'If you can hold a conversation AND make a good playlist, I am very interested.',
    aboutMe: "Music producer and part-time philosophy reader. I make beats in my bedroom and think way too hard about most things. Looking for someone who does both.",
    city: 'San Francisco', ...sfOffset(9.5, -2.0), photosBlurred: true,
    photos: ['https://randomuser.me/api/portraits/women/25.jpg', 'https://randomuser.me/api/portraits/women/26.jpg', 'https://randomuser.me/api/portraits/women/27.jpg'],
    lifestyle: { height: "5'3\"", drinks: 'Rarely', smokes: 'Never', kids: 'Not sure yet', pets: 'Want a cat', diet: 'Pescatarian', exercise: 'Walks count', zodiac: 'Aquarius', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'CURRENTLY OBSESSED WITH', answer: 'The way a good sample flip can completely change the emotional register of a song.' },
      { position: 2, title: 'I WANT SOMEONE WHO', answer: 'Has a playlist for every mood and is not afraid to defend their choices.' },
      { position: 3, title: 'A THING I AM PROUD OF', answer: "I've played music at small venues in three countries. Still nervous every time." },
    ],
    interests: ['Music production', 'Philosophy', 'Concerts', 'Art galleries', 'Late nights'],
  },

  // ── Men · open photos ────────────────────────────────────────────────────

  {
    handle: 'Liam', phone: '5550100011', age: 29, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'friends',
    looking: 'Slow down, be somewhere',
    bio: 'I ask too many questions but I am very interested in the answers.',
    aboutMe: "Architect who spends too much time sketching things that may never get built. I think the best cities are the ones you can walk across. Looking for someone who is genuinely curious.",
    city: 'San Francisco', ...sfOffset(1.5, 1.0), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/men/1.jpg', 'https://randomuser.me/api/portraits/men/2.jpg', 'https://randomuser.me/api/portraits/men/3.jpg'],
    lifestyle: { height: "6'0\"", drinks: 'Socially', smokes: 'Never', kids: 'Want someday', pets: 'No pets', diet: 'Omnivore', exercise: 'A few times a week', zodiac: 'Aries', education: "Master's" },
    prompts: [
      { position: 1, title: 'MY FAVORITE THING ABOUT SF', answer: 'The fog rolling in over Twin Peaks at exactly the wrong time.' },
      { position: 2, title: 'MOST LIKELY TO', answer: 'Suggest a walk when there is a perfectly good taxi available.' },
      { position: 3, title: 'I AM LOOKING FOR', answer: 'Someone to slow down with.' },
    ],
    interests: ['Architecture', 'Long walks', 'Coffee', 'Sketching', 'Jazz'],
  },

  {
    handle: 'Ethan', phone: '5550100012', age: 27, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'serious',
    looking: 'Something with staying power',
    bio: 'I will always stop to read the plaque on an old building.',
    aboutMe: 'History teacher who moonlights as a terrible but enthusiastic home chef. I think the best conversations happen over food that took effort.',
    city: 'San Francisco', ...sfOffset(3.5, -1.0), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/men/10.jpg', 'https://randomuser.me/api/portraits/men/11.jpg', 'https://randomuser.me/api/portraits/men/12.jpg'],
    lifestyle: { height: "5'11\"", drinks: 'Rarely', smokes: 'Never', kids: 'Open to it', pets: 'One dog', diet: 'Omnivore', exercise: 'Cycling daily', zodiac: 'Cancer', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'I ALWAYS WANT TO TALK ABOUT', answer: 'Why certain places become legendary and others are forgotten.' },
      { position: 2, title: 'GREEN FLAG', answer: 'You have an opinion about something specific and you defend it well.' },
      { position: 3, title: 'HOW I SPEND A SLOW SUNDAY', answer: 'Reading, cooking something long, bothering no one.' },
    ],
    interests: ['History', 'Cooking', 'Museums', 'Reading', 'Cycling'],
  },

  {
    handle: 'Marcus', phone: '5550100013', age: 31, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'dating',
    looking: 'Real, present, unhurried',
    bio: 'I make very good coffee and I take it seriously.',
    aboutMe: 'Documentary filmmaker based in Oakland. I pay attention to things other people walk past. Looking for someone who is also paying attention.',
    city: 'Oakland', ...sfOffset(5.0, 3.0), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/men/15.jpg', 'https://randomuser.me/api/portraits/men/16.jpg', 'https://randomuser.me/api/portraits/men/17.jpg'],
    lifestyle: { height: "6'1\"", drinks: 'Socially', smokes: 'Never', kids: 'Want someday', pets: 'One cat', diet: 'Omnivore', exercise: 'Running', zodiac: 'Virgo', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'WHAT I AM WORKING ON', answer: 'A short film about the last all-night diner in Oakland. It is taking longer than expected.' },
      { position: 2, title: 'I NOTICE', answer: 'When the light is good. When someone is having a bad day. When the coffee is actually good.' },
      { position: 3, title: 'YOU SHOULD KNOW', answer: "I am a morning person but I won't hold it against you if you're not." },
    ],
    interests: ['Filmmaking', 'Photography', 'Coffee', 'Cycling', 'Jazz bars'],
  },

  {
    handle: 'Finn', phone: '5550100014', age: 26, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'friends',
    looking: 'Something that surprises me',
    bio: 'I have a playlist for every occasion and yes, that includes grocery shopping.',
    aboutMe: "UX engineer at a startup. I care a lot about how things work and whether they feel right. Off-screen I surf badly but enthusiastically.",
    city: 'San Francisco', ...sfOffset(2.0, -2.0), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/men/25.jpg', 'https://randomuser.me/api/portraits/men/26.jpg', 'https://randomuser.me/api/portraits/men/27.jpg'],
    lifestyle: { height: "5'10\"", drinks: 'Socially', smokes: 'Never', kids: 'Not sure', pets: 'Want a dog', diet: 'Pescatarian', exercise: 'Surfing and gym', zodiac: 'Gemini', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'CURRENT OBSESSION', answer: 'Learning to make pasta from scratch. The ratio of effort to payoff is very high.' },
      { position: 2, title: 'I WILL ALWAYS', answer: 'Have strong opinions about menu choices. I am usually right.' },
      { position: 3, title: 'LOOKING FOR', answer: 'Someone easy to be quiet with.' },
    ],
    interests: ['Surfing', 'Cooking', 'Music', 'Design', 'Film'],
  },

  {
    handle: 'Oliver', phone: '5550100015', age: 28, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'casual',
    looking: 'Depth, humor, honesty',
    bio: 'I read cookbooks like novels. This is a personality trait.',
    aboutMe: "Brand strategist who grew up between two cities and never fully committed to either. I think about language a lot. I am more interesting in person than on apps.",
    city: 'San Francisco', ...sfOffset(7.5, 0.5), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/men/35.jpg', 'https://randomuser.me/api/portraits/men/36.jpg', 'https://randomuser.me/api/portraits/men/37.jpg'],
    lifestyle: { height: "5'11\"", drinks: 'Wine, often', smokes: 'Never', kids: 'Want someday', pets: 'No pets', diet: 'Omnivore', exercise: 'Running', zodiac: 'Scorpio', education: "Master's" },
    prompts: [
      { position: 1, title: 'A THING I LOVE', answer: 'When a stranger tells you an unrequested but very specific fact about something.' },
      { position: 2, title: 'MY FATAL FLAW', answer: 'I finish books I am not enjoying because I committed to them.' },
      { position: 3, title: 'BEST DATE IDEA', answer: "Somewhere you haven't been. Something with a story. I'll handle the logistics." },
    ],
    interests: ['Writing', 'Food', 'Travel', 'Podcasts', 'Wine'],
  },

  // ── Men · blurred photos ─────────────────────────────────────────────────

  {
    handle: 'Noah', phone: '5550100016', age: 30, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'friends',
    looking: 'One really good thing',
    bio: 'I am suspicious of people who do not have at least one irrational food preference.',
    aboutMe: 'Climate scientist. I spend my days looking at genuinely worrying data and somehow remain optimistic. Good at long hikes, bad at Netflix.',
    city: 'San Francisco', ...sfOffset(4.5, -3.0), photosBlurred: true,
    photos: ['https://randomuser.me/api/portraits/men/5.jpg', 'https://randomuser.me/api/portraits/men/6.jpg', 'https://randomuser.me/api/portraits/men/7.jpg'],
    lifestyle: { height: "6'0\"", drinks: 'Rarely', smokes: 'Never', kids: 'Open to it', pets: 'Two chickens', diet: 'Mostly veggie', exercise: 'Hiking daily', zodiac: 'Libra', education: 'PhD' },
    prompts: [
      { position: 1, title: 'MY ACTUAL HOBBY', answer: 'Amateur beekeeping. It is meditative and I give away a lot of honey.' },
      { position: 2, title: 'WHAT PEOPLE GET WRONG ABOUT ME', answer: 'That I am intense. I am just enthusiastic.' },
      { position: 3, title: 'I WANT TO KNOW', answer: 'What you are unreasonably good at.' },
    ],
    interests: ['Hiking', 'Beekeeping', 'Climate', 'Cooking outdoors', 'Road trips'],
  },

  {
    handle: 'Julian', phone: '5550100017', age: 32, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'non_monogamy',
    looking: 'Something quiet and real',
    bio: 'I think the best way to know someone is to travel badly with them.',
    aboutMe: 'Civil engineer who spends weekends climbing rocks in Yosemite. I am reliable, direct, and genuinely bad at small talk. Good at everything else.',
    city: 'Berkeley', ...sfOffset(6.5, 2.5), photosBlurred: true,
    photos: ['https://randomuser.me/api/portraits/men/20.jpg', 'https://randomuser.me/api/portraits/men/21.jpg', 'https://randomuser.me/api/portraits/men/22.jpg'],
    lifestyle: { height: "6'2\"", drinks: 'Socially', smokes: 'Never', kids: 'Want someday', pets: 'No pets', diet: 'Omnivore', exercise: 'Climbing and cycling', zodiac: 'Taurus', education: "Master's" },
    prompts: [
      { position: 1, title: 'THE TRUTH IS', answer: 'I would rather do one thing well than three things adequately.' },
      { position: 2, title: 'HOW TO IMPRESS ME', answer: 'Tell me something true and specific about yourself in the first five minutes.' },
      { position: 3, title: 'ON WEEKENDS', answer: "Yosemite if I can manage it. Otherwise: the farmer's market, a long bike ride, cook for someone." },
    ],
    interests: ['Rock climbing', 'Cycling', 'Cooking', 'Architecture', 'Maps'],
  },

  {
    handle: 'Leo', phone: '5550100018', age: 25, iam: 'man',
    pronouns: 'he/him', relStatus: 'single', relationshipGoal: 'figuring_out',
    looking: 'Something I did not plan',
    bio: 'Ask me about the last book I read. I have thoughts.',
    aboutMe: 'Journalist at a local outlet. I write about housing and neighborhoods but I think about people. Looking for someone worth writing a story about.',
    city: 'San Francisco', ...sfOffset(10.0, -1.0), photosBlurred: true,
    photos: ['https://randomuser.me/api/portraits/men/30.jpg', 'https://randomuser.me/api/portraits/men/31.jpg', 'https://randomuser.me/api/portraits/men/32.jpg'],
    lifestyle: { height: "5'10\"", drinks: 'Beer and wine', smokes: 'Occasionally', kids: 'Not yet', pets: 'Want a dog', diet: 'Omnivore', exercise: 'Cycling', zodiac: 'Leo', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'THE BEST CONVERSATION STARTER', answer: "What's something everyone around you believes that you're not sure about?" },
      { position: 2, title: 'I AM TRYING TO', answer: 'Read more fiction. I keep getting distracted by nonfiction about very specific things.' },
      { position: 3, title: 'A SMALL WIN', answer: 'I finally know every barista at my local coffee shop by name.' },
    ],
    interests: ['Writing', 'Neighborhoods', 'Books', 'Cycling', 'Late night food'],
  },

  // ── Non-binary ───────────────────────────────────────────────────────────

  {
    handle: 'Alex', phone: '5550100019', age: 27, iam: 'nonbinary',
    pronouns: 'they/them', relStatus: 'single', relationshipGoal: 'dating',
    looking: 'Something with texture and honesty',
    bio: 'I think the difference between a good day and a bad day is often just lighting.',
    aboutMe: 'Lighting designer for theater. I make spaces feel a certain way for a living, which means I am always noticing how places make you feel. Looking for someone who notices things.',
    city: 'San Francisco', ...sfOffset(2.0, 1.5), photosBlurred: false,
    photos: ['https://randomuser.me/api/portraits/women/50.jpg', 'https://randomuser.me/api/portraits/women/51.jpg', 'https://randomuser.me/api/portraits/women/52.jpg'],
    lifestyle: { height: "5'7\"", drinks: 'Socially', smokes: 'Never', kids: 'Not sure', pets: 'One plant wall', diet: 'Mostly veggie', exercise: 'Dance classes', zodiac: 'Sagittarius', education: "Bachelor's" },
    prompts: [
      { position: 1, title: 'MY UNUSUAL SKILL', answer: 'I can walk into any room and tell you what the lighting is doing wrong.' },
      { position: 2, title: 'I VALUE', answer: 'People who say what they mean and mean something interesting.' },
      { position: 3, title: 'WHAT I AM LOOKING FOR', answer: 'Someone who is genuinely themselves, whatever that looks like.' },
    ],
    interests: ['Theater', 'Photography', 'Architecture', 'Cooking', 'Dance'],
  },

  {
    handle: 'River', phone: '5550100020', age: 29, iam: 'nonbinary',
    pronouns: 'they/them', relStatus: 'single', relationshipGoal: 'dating',
    looking: 'Slow, honest, curious',
    bio: 'I give very good directions and I expect the same in return.',
    aboutMe: 'Cartographer and data visualization designer. I make maps that help people understand complicated things. I like puzzles, physical spaces, and people who know what they want.',
    city: 'San Francisco', ...sfOffset(11.0, 1.0), photosBlurred: true,
    photos: ['https://randomuser.me/api/portraits/men/40.jpg', 'https://randomuser.me/api/portraits/men/41.jpg', 'https://randomuser.me/api/portraits/men/42.jpg'],
    lifestyle: { height: "5'9\"", drinks: 'Rarely', smokes: 'Never', kids: 'Open to it', pets: 'Two cats', diet: 'Vegan', exercise: 'Long walks', zodiac: 'Pisces', education: "Master's" },
    prompts: [
      { position: 1, title: 'A FACT ABOUT ME', answer: 'I have visited every neighborhood in SF on foot. I have opinions about all of them.' },
      { position: 2, title: 'I AM DRAWN TO', answer: 'People who are specific about what they like and why.' },
      { position: 3, title: 'ONE THING I KNOW FOR SURE', answer: 'The best map is the one that admits it does not show everything.' },
    ],
    interests: ['Cartography', 'Walking', 'Data', 'Coffee shops', 'Bookstores'],
  },
]

// ─── Test viewer ──────────────────────────────────────────────────────────────

const VIEWER = {
  handle: 'Viewer',
  phone: '5550100000',
  age: 29,
  iam: 'man',
  pronouns: 'he/him',
  relStatus: 'single',
  relationshipGoal: 'dating',
  looking: 'Something worth staying for',
  bio: 'A good question beats a good answer every time.',
  aboutMe: 'Software engineer who builds things during the day and reads about them at night.',
  city: 'San Francisco',
  lat: '37.7749',
  lng: '-122.4194',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function clearExistingSeeds() {
  // All seed users use phone numbers in the 555-010-xxxx range (fictional/safe)
  await db.execute(sql`
    DELETE FROM users
    WHERE phone_country = '+1'
      AND phone ~ '^555010'
  `)
  console.log('Cleared existing seed users.')
}

async function insertUser(data) {
  const { lat, lng, lifestyle, prompts, interests, photos, photosBlurred = false, ...userFields } = data

  const [inserted] = await db
    .insert(users)
    .values({
      handle:           userFields.handle,
      phone:            userFields.phone,
      phoneCountry:     '+1',
      phoneVerified:    true,
      twoFaMethod:      'skipped',
      age:              userFields.age,
      iam:              userFields.iam,
      pronouns:         userFields.pronouns ?? null,
      relStatus:        userFields.relStatus,
      relationshipGoal: userFields.relationshipGoal,
      looking:          userFields.looking ?? null,
      bio:              userFields.bio ?? null,
      aboutMe:          userFields.aboutMe ?? null,
      city:             userFields.city ?? null,
      latApprox:        lat,
      lngApprox:        lng,
      locationGranted:  true,
      idVerified:       Math.random() > 0.6,
      profileCompletePct: 95,
      plan:             'free',
    })
    .returning({ id: users.id })

  const userId = inserted.id

  if (lifestyle) {
    await db.insert(userLifestyle).values({ userId, ...lifestyle })
  }

  if (photos?.length) {
    await db.insert(userPhotos).values(
      photos.map((url, i) => ({
        userId,
        position:   i + 1,
        storageKey: url,
        blurAmount: photosBlurred ? 80 : 0,
        isBlurred:  photosBlurred,
        isMain:     i === 0,
      })),
    )
  }

  if (prompts?.length) {
    await db.insert(userPrompts).values(
      prompts.map((p) => ({ userId, position: p.position, title: p.title, answer: p.answer })),
    )
  }

  if (interests?.length) {
    await db.insert(userInterests).values(
      interests.map((interest, i) => ({ userId, interest, position: i })),
    )
  }

  await db.insert(userDiscoverPreferences).values({
    userId,
    maxDistance:          25,
    minDistance:          0,
    ageMin:               18,
    ageMax:               70,
    relationshipType:     'dating',
    photoBlurVisibility:  70,
  })

  return userId
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await clearExistingSeeds()

    console.log('Inserting test viewer...')
    const viewerId = await insertUser({ ...VIEWER, lat: VIEWER.lat, lng: VIEWER.lng })
    console.log(`  viewer: ${VIEWER.handle} (${viewerId})`)

    console.log(`\nInserting ${CANDIDATES.length} candidates...`)
    for (const candidate of CANDIDATES) {
      const id = await insertUser(candidate)
      const lock = candidate.photosBlurred ? '🔒' : '📷'
      console.log(`  ${lock} ${candidate.handle} (${candidate.iam}, ${candidate.age}) → ${id}`)
    }

    const open    = CANDIDATES.filter((c) => !c.photosBlurred).length
    const blurred = CANDIDATES.filter((c) =>  c.photosBlurred).length
    console.log(`\nDone! ${CANDIDATES.length + 1} users seeded (${open} open photos, ${blurred} blurred).`)
    console.log(`\nTest viewer → handle: @${VIEWER.handle}  phone: +1 ${VIEWER.phone}`)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
