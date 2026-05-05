// Data for the Operated Profiles workspace

const { useState, useEffect, useMemo, useRef } = React;

// Company-operated personas
const PERSONAS_SEED = [
  {
    id:"op_1", name:"Amelia Voss", age:27, gender:"Woman", orientation:"Straight",
    city:"Brooklyn, NY", country:"US", hue:12, status:"active",
    bio:"Jazz records on Sunday mornings, unsolicited book recs, very much a dog person. Ask me about my failed sourdough era.",
    work:"Editorial at a small magazine", edu:"NYU",
    height:"5'6\"", relStatus:"Single", intent:"Long-term", drinks:"Socially", smokes:"No", kids:"Wants someday",
    interests:["jazz","reading","coffee","dogs","design","slow-living"],
    photos:4, verified:true, plan:"Gold", createdBy:"Elena M.", team:"Seed · NYC",
    stats:{ matches:184, active:17, msgsToday:23, replyRate:67, lastActive:"2m ago" }
  },
  {
    id:"op_2", name:"Marcus Reid", age:31, gender:"Man", orientation:"Straight",
    city:"Austin, TX", country:"US", hue:90, status:"active",
    bio:"PM by day, weekend climber. Will definitely try to convince you sourdough is worth the effort. Dry sense of humor, fair warning.",
    work:"Senior PM · fintech", edu:"UT Austin",
    height:"6'0\"", relStatus:"Single", intent:"Long-term", drinks:"Yes", smokes:"No", kids:"Wants",
    interests:["climbing","sourdough","design","podcasts"],
    photos:5, verified:true, plan:"Platinum", createdBy:"Jordan P.", team:"Seed · TX",
    stats:{ matches:221, active:12, msgsToday:19, replyRate:71, lastActive:"just now" }
  },
  {
    id:"op_3", name:"Sasha Lindqvist", age:26, gender:"Non-binary", orientation:"Bi",
    city:"Seattle, WA", country:"US", hue:180, status:"active",
    bio:"Writing a novel about whales. Will overshare at brunch. Kayaks > boats. Looking for curious people.",
    work:"UX writer", edu:"UW",
    height:"5'8\"", relStatus:"Single", intent:"Figuring it out", drinks:"Sometimes", smokes:"No", kids:"Open",
    interests:["books","hiking","museums","cinema"],
    photos:3, verified:true, plan:"Free", createdBy:"Elena M.", team:"Seed · NW",
    stats:{ matches:97, active:8, msgsToday:11, replyRate:58, lastActive:"14m ago" }
  },
  {
    id:"op_4", name:"Nina Akhtar", age:33, gender:"Woman", orientation:"Straight",
    city:"London, UK", country:"UK", hue:260, status:"paused",
    bio:"Architect, obsessed with Japanese joinery and jazz. Tea before coffee. Terrible at small talk, great at long walks.",
    work:"Architect · studio of 8", edu:"Bartlett UCL",
    height:"5'5\"", relStatus:"Divorced", intent:"Long-term", drinks:"Rarely", smokes:"No", kids:"Has two",
    interests:["jazz","architecture","cats","wine","running"],
    photos:6, verified:true, plan:"Platinum", createdBy:"Priya V.", team:"Seed · UK",
    stats:{ matches:312, active:0, msgsToday:0, replyRate:74, lastActive:"3d ago" }
  },
  {
    id:"op_5", name:"Leo Navarro", age:29, gender:"Man", orientation:"Gay",
    city:"Los Angeles, CA", country:"US", hue:330, status:"active",
    bio:"Film photographer, plant dad, horror movie apologist. Looking for someone who can argue about A24 with me.",
    work:"Freelance photographer", edu:"CalArts",
    height:"5'10\"", relStatus:"Single", intent:"Long-term", drinks:"Yes", smokes:"No", kids:"Open",
    interests:["film","photography","plants","horror","vinyl"],
    photos:5, verified:true, plan:"Gold", createdBy:"Jordan P.", team:"Seed · LA",
    stats:{ matches:168, active:14, msgsToday:16, replyRate:63, lastActive:"5m ago" }
  },
];

// Country / city geography pool — broad, weighted toward big metros
const GEO = [
  { country:"US", flag:"🇺🇸", cities:["New York","Brooklyn","Los Angeles","Chicago","Austin","Seattle","Miami","San Francisco","Denver","Boston","Portland","Atlanta"] },
  { country:"UK", flag:"🇬🇧", cities:["London","Manchester","Bristol","Edinburgh","Brighton","Leeds"] },
  { country:"DE", flag:"🇩🇪", cities:["Berlin","Munich","Hamburg","Cologne","Frankfurt"] },
  { country:"FR", flag:"🇫🇷", cities:["Paris","Lyon","Marseille","Bordeaux"] },
  { country:"NL", flag:"🇳🇱", cities:["Amsterdam","Rotterdam","Utrecht"] },
  { country:"ES", flag:"🇪🇸", cities:["Madrid","Barcelona","Valencia"] },
  { country:"IT", flag:"🇮🇹", cities:["Milan","Rome","Florence"] },
  { country:"SE", flag:"🇸🇪", cities:["Stockholm","Gothenburg"] },
  { country:"DK", flag:"🇩🇰", cities:["Copenhagen","Aarhus"] },
  { country:"CH", flag:"🇨🇭", cities:["Zurich","Geneva","Basel"] },
  { country:"CA", flag:"🇨🇦", cities:["Toronto","Vancouver","Montreal"] },
  { country:"AU", flag:"🇦🇺", cities:["Sydney","Melbourne","Brisbane"] },
  { country:"BR", flag:"🇧🇷", cities:["São Paulo","Rio de Janeiro"] },
  { country:"MX", flag:"🇲🇽", cities:["Mexico City","Guadalajara"] },
  { country:"JP", flag:"🇯🇵", cities:["Tokyo","Osaka","Kyoto"] },
  { country:"SG", flag:"🇸🇬", cities:["Singapore"] },
];

const COUNTRY_NAME = {
  US:"United States", UK:"United Kingdom", DE:"Germany", FR:"France", NL:"Netherlands",
  ES:"Spain", IT:"Italy", SE:"Sweden", DK:"Denmark", CH:"Switzerland", CA:"Canada",
  AU:"Australia", BR:"Brazil", MX:"Mexico", JP:"Japan", SG:"Singapore"
};

// Deterministic PRNG for stable thread generation per persona
function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Olivia","Daniel","Maya","Priya","Jacob","Ines","Tom","Rina","Evan","Harper","Sam","Zoe","Liam","Aisha","Noah",
  "Mia","Felix","Chloe","Mateo","Ada","Hugo","Yuki","Nina","Leo","Amir","Sofia","Kai","Lina","Theo","Cara",
  "Nora","Owen","Elena","Henrik","Lara","Diego","Anya","Pablo","Ines","Marta","Jules","Aria","Ben","Ruth","Eli",
  "Lukas","Ida","Anders","Maja","Klara","Tomás","Suki","Hana","Ravi","Jin","Aiko","Mika","Camila","Bruno","Léa",
  "Selma","Vera","Isla","Joaquín","Romi","Aslan","Maya","Hadley","Arjun","Tara","Bilal","Stella","Otis","Romi",
];
const LAST_INITIALS = ["A.","B.","C.","D.","E.","F.","G.","H.","K.","L.","M.","N.","O.","P.","R.","S.","T.","V.","W.","Z."];

const PREVIEWS = [
  "Running late tonight, raincheck?",
  "You had me at sourdough.",
  "Book rec please",
  "coffee spot on 5th?",
  "haha same",
  "send me the jazz playlist 🎷",
  "↓ that movie list is unreal",
  "saturday?",
  "whatcha reading rn",
  "love that neighborhood",
  "so was the ramen hype real",
  "ok but where's the best espresso here",
  "you free tonight?",
  "lol that's wild",
  "finally finished the book",
  "ok pitch me a date",
  "yes to the museum",
  "wait you climb too?",
  "sunday brunch?",
  "alright I'm convinced",
  "🙃",
  "sorry, work blew up",
  "send me a pic of the dog",
  "you'd actually love this place",
  "reschedule for next week?",
  "what's your aux song",
];

const TIMES = ["just now","2m","8m","18m","32m","1h","2h","3h","5h","7h","yesterday","2d","3d","5d","1w"];

function genThread(rand, theirName){
  const baseTurns = [
    [{f:"them",t:`Hey! How's your week going?`, tt:"Mon 2:14 pm"}],
    [
      {f:"them",t:`Your bio made me laugh`, tt:"Mon 9:40 am"},
      {f:"mine",t:`That was the intent. Please tell me which bit.`, tt:"Mon 9:42 am"},
      {f:"them",t:`the sourdough era. felt that`, tt:"Mon 9:44 am"},
    ],
    [
      {f:"them",t:`hey :)`, tt:"Sat 11:10 pm"},
      {f:"mine",t:`hey back. what's a Saturday 11pm like for you`, tt:"Sat 11:13 pm"},
      {f:"them",t:`asking the important questions already`, tt:"Sat 11:14 pm"},
      {f:"them",t:`usually a movie + a snack. you?`, tt:"Sat 11:14 pm"},
      {f:"mine",t:`low-key same. what are we watching`, tt:"Sat 11:16 pm"},
    ],
    [
      {f:"them",t:`book rec please`, tt:"Sun 1:02 pm"},
    ],
    [
      {f:"them",t:`coffee spot on 5th?`, tt:"Tue 4:22 pm"},
      {f:"mine",t:`the one with the plants? it's decent. better light than coffee tbh`, tt:"Tue 4:31 pm"},
      {f:"them",t:`haha. saturday 10?`, tt:"Tue 4:33 pm"},
    ],
  ];
  const idx = Math.floor(rand() * baseTurns.length);
  return baseTurns[idx].map(m=>({...m, id:Math.floor(rand()*1e9).toString(36)}));
}

// Hash a string to a stable integer seed
function hashSeed(s){
  let h = 2166136261;
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Generate ~1,000 threads across many cities/countries for a persona
function makeThreads(personaId, hue){
  const seed = hashSeed(personaId);
  const rand = mulberry32(seed);
  const N = 1000 + Math.floor(rand()*120); // ~1000-1120 threads
  const out = new Array(N);
  for(let i=0;i<N;i++){
    const geo = GEO[Math.floor(rand() * GEO.length)];
    const city = geo.cities[Math.floor(rand() * geo.cities.length)];
    const first = FIRST_NAMES[Math.floor(rand()*FIRST_NAMES.length)];
    const li = LAST_INITIALS[Math.floor(rand()*LAST_INITIALS.length)];
    const handle = "@" + first.toLowerCase() + (Math.floor(rand()*900)+10);
    const previewIdx = Math.floor(rand()*PREVIEWS.length);
    const timeIdx = Math.floor(rand()*TIMES.length);
    // Unread distribution: heavy tail — most are 0, some have many
    const r = rand();
    let unread = 0;
    if(r > 0.55) unread = 1 + Math.floor(rand()*2);
    if(r > 0.85) unread = 3 + Math.floor(rand()*4);
    if(r > 0.97) unread = 7 + Math.floor(rand()*12);
    const flagged = rand() < 0.04;
    const age = 22 + Math.floor(rand()*18);
    out[i] = {
      id: personaId+"_t"+i,
      name: first + " " + li,
      handle,
      preview: PREVIEWS[previewIdx],
      time: TIMES[timeIdx],
      // numeric "freshness" for sort tiebreak (lower = more recent)
      timeRank: timeIdx,
      unread,
      flagged,
      userId: "u_"+personaId.slice(-1)+"_"+i,
      age,
      country: geo.country,
      flag: geo.flag,
      city,
      neighborhood: city,
      matchedOn: ["Apr 18","Apr 20","Apr 14","Mar 29","Apr 21","Apr 19","Apr 12","Apr 16","Apr 15","Apr 10","Apr 22"][i % 11],
      hue: (hue + i*37) % 360,
      messages: genThread(rand, first),
    };
  }
  return out;
}

// Swipe feed — real users for the persona to engage with
function makeFeed(personaId){
  const people = [
    { name:"River Ng",     age:29, hue:40,  distance:"4 mi",  neighborhood:"Park Slope",   bio:"Film photog, very into plants. Looking for someone who gets excited about museum gift shops.",      pills:["photography","plants","museums"]},
    { name:"Taylor Brooks",age:27, hue:150, distance:"7 mi",  neighborhood:"Greenpoint",   bio:"Runs a bookstore. Makes good coffee. Loves a plan but flexible on the plan.",                          pills:["books","coffee","cooking"]},
    { name:"Noor al-Sabah",age:31, hue:220, distance:"11 mi", neighborhood:"Long Island City", bio:"Neuroscience PhD, climbs V5, terrible cook, will still cook for you.",                          pills:["climbing","science","dogs"]},
    { name:"Devin Park",   age:26, hue:300, distance:"3 mi",  neighborhood:"Fort Greene",  bio:"Jazz drummer. Terrible cook. Looking for someone with a strong opinion about a weird movie.",         pills:["jazz","drums","film"]},
    { name:"Ines Moreau",  age:33, hue:10,  distance:"14 mi", neighborhood:"Williamsburg", bio:"Designer and walking encyclopedia of trivia. I will beat you at pub quiz. Probably.",                  pills:["design","quiz","wine"]},
    { name:"Jesse Kim",    age:28, hue:75,  distance:"9 mi",  neighborhood:"Bushwick",     bio:"Bakery baker. Sourdough is my personality. 5am hours means early dates are on the table.",             pills:["baking","cycling","indie-rock"]},
    { name:"Ada Bauer",    age:30, hue:200, distance:"6 mi",  neighborhood:"Red Hook",     bio:"Architect. I know every good building within 2 miles. Ask me about bricks, I dare you.",              pills:["architecture","cats","tea"]},
  ];
  return people.map((p,i)=>({ ...p, id: personaId+"_f"+i }));
}

const AI_SUGGESTIONS = [
  "Keep it playful",
  "Ask a question",
  "Propose meeting up",
  "Check in after silence",
  "Share a small story",
];

function makeActivity(personaId){
  return [
    { t:"12m ago",  a:"Elena M.",   k:"sent", txt:"sent message to @olivia_t" },
    { t:"48m ago",  a:"Jordan P.",  k:"swipe", txt:"right-swiped 6 profiles" },
    { t:"2h ago",   a:"Elena M.",   k:"edit", txt:"updated bio"},
    { t:"5h ago",   a:"Priya V.",   k:"photo", txt:"added photo #4"},
    { t:"yesterday",a:"Elena M.",   k:"sent", txt:"sent message to @jake_f"},
    { t:"2d ago",   a:"System",     k:"flag", txt:"auto-flagged @priyan for escalation review"},
    { t:"3d ago",   a:"Jordan P.",  k:"match", txt:"unmatched @tomb_"},
  ];
}

Object.assign(window, { PERSONAS_SEED, makeThreads, makeFeed, makeActivity, AI_SUGGESTIONS, GEO, COUNTRY_NAME });
