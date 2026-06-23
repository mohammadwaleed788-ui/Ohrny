import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/operatedStyles.jsx'
import { op } from '../theme/operatedTheme.js'

const fieldClass = `rounded-md border ${op.borderSoft} ${op.bgMain} px-3 py-2 text-sm text-[oklch(0.96_0.005_260)] outline-none`

export function NewPersonaModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState(28)
  const [gender, setGender] = useState('Woman')
  const [orientation, setOrientation] = useState('everyone')
  const [intent, setIntent] = useState('serious')
  const [relStatus, setRelStatus] = useState('single')
  const [pronouns, setPronouns] = useState('')
  const [looking, setLooking] = useState('')
  const [city, setCity] = useState('')
  const [countryCode, setCountryCode] = useState('US')
  const [latApprox, setLatApprox] = useState('40.71')
  const [lngApprox, setLngApprox] = useState('-74.01')
  const [bio, setBio] = useState('')
  const [work, setWork] = useState('')
  const [height, setHeight] = useState('')
  const [edu, setEdu] = useState('')
  const [drinks, setDrinks] = useState('Socially')
  const [smokes, setSmokes] = useState('No')
  const [kids, setKids] = useState('Open')
  const [pets, setPets] = useState('')
  const [diet, setDiet] = useState('')
  const [exercise, setExercise] = useState('')
  const [religion, setReligion] = useState('')
  const [zodiac, setZodiac] = useState('')
  const [interests, setInterests] = useState('coffee, music, books')
  const [maxDistance, setMaxDistance] = useState(25)
  const [ageMin, setAgeMin] = useState(18)
  const [ageMax, setAgeMax] = useState(70)
  const [promptOne, setPromptOne] = useState('Coffee, a long walk, and a conversation that accidentally lasts two hours.')
  const [promptTwo, setPromptTwo] = useState('Kindness, curiosity, and a real laugh.')
  const [promptThree, setPromptThree] = useState('Tell me the small thing you are weirdly passionate about.')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    if (creating) return
    const cleanInterests = interests
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6)

    setCreating(true)
    setError('')
    try {
      await onCreate({
        name,
        age,
        gender,
        orientation: [orientation],
        intent,
        relStatus,
        pronouns,
        looking,
        city,
        countryCode,
        latApprox,
        lngApprox,
        bio,
        work,
        height,
        edu,
        drinks,
        smokes,
        kids,
        pets,
        diet,
        exercise,
        religion,
        zodiac,
        interests: cleanInterests,
        maxDistance,
        ageMin,
        ageMax,
        prompts: [
          { position: 1, title: 'A PERFECT SUNDAY', answer: promptOne },
          { position: 2, title: 'NON-NEGOTIABLES', answer: promptTwo },
          { position: 3, title: 'CONVERSATION STARTER', answer: promptThree },
        ],
        hue: Math.floor(Math.random() * 360),
      })
    } catch (err) {
      setError(err?.message || 'Failed to create persona')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className={`max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg border ${op.borderSoft} ${op.bgElev} shadow-2xl`} onClick={(event) => event.stopPropagation()}>
        <div className={`flex items-center gap-3 border-b ${op.borderSoft} p-4`}>
          <div className={`flex-1 font-semibold ${op.text}`}>New operated persona</div>
          <Button className="h-8 w-8 px-0" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="max-h-[calc(90vh-132px)] space-y-5 overflow-y-auto p-4">
          <p className={`text-sm ${op.mute}`}>Creates a new company-operated profile. Upload photos on the Profile tab after creation.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Display name<input className={`mt-1 w-full ${fieldClass}`} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Age<input className={`mt-1 w-full ${fieldClass}`} type="number" value={age} onChange={(event) => setAge(Number(event.target.value))} /></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Gender<select className={`mt-1 w-full ${fieldClass}`} value={gender} onChange={(event) => setGender(event.target.value)}><option>Woman</option><option>Man</option><option>Non-binary</option></select></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Interested in<select className={`mt-1 w-full ${fieldClass}`} value={orientation} onChange={(event) => setOrientation(event.target.value)}><option value="everyone">Everyone</option><option value="women">Women</option><option value="men">Men</option><option value="nonbinary">Non-binary</option></select></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Intent<select className={`mt-1 w-full ${fieldClass}`} value={intent} onChange={(event) => setIntent(event.target.value)}><option value="serious">Long-term</option><option value="dating">Dating</option><option value="casual">Casual</option><option value="figuring_out">Figuring it out</option><option value="friends">Friends</option><option value="non_monogamy">Non-monogamy</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Pronouns<input className={`mt-1 w-full ${fieldClass}`} value={pronouns} onChange={(event) => setPronouns(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Looking for<input className={`mt-1 w-full ${fieldClass}`} value={looking} onChange={(event) => setLooking(event.target.value)} /></label>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>City<input className={`mt-1 w-full ${fieldClass}`} placeholder="Brooklyn, NY" value={city} onChange={(event) => setCity(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Country<input className={`mt-1 w-full ${fieldClass}`} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Latitude<input className={`mt-1 w-full ${fieldClass}`} value={latApprox} onChange={(event) => setLatApprox(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Longitude<input className={`mt-1 w-full ${fieldClass}`} value={lngApprox} onChange={(event) => setLngApprox(event.target.value)} /></label>
          </div>
          <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Bio<textarea className={`mt-1 min-h-24 w-full resize-none ${fieldClass}`} value={bio} onChange={(event) => setBio(event.target.value)} /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Work<input className={`mt-1 w-full ${fieldClass}`} value={work} onChange={(event) => setWork(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Height<input className={`mt-1 w-full ${fieldClass}`} placeholder={'5 ft 8 in'} value={height} onChange={(event) => setHeight(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Education<input className={`mt-1 w-full ${fieldClass}`} value={edu} onChange={(event) => setEdu(event.target.value)} /></label>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Status<select className={`mt-1 w-full ${fieldClass}`} value={relStatus} onChange={(event) => setRelStatus(event.target.value)}><option value="single">Single</option><option value="in_relationship">In relationship</option><option value="married">Married</option><option value="non_monogamous">Non-monogamous</option><option value="complicated">Complicated</option><option value="prefer_not_say">Private</option></select></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Drinks<select className={`mt-1 w-full ${fieldClass}`} value={drinks} onChange={(event) => setDrinks(event.target.value)}><option>Yes</option><option>Socially</option><option>Sometimes</option><option>Rarely</option><option>No</option></select></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Smokes<select className={`mt-1 w-full ${fieldClass}`} value={smokes} onChange={(event) => setSmokes(event.target.value)}><option>No</option><option>Socially</option><option>Yes</option></select></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Kids<select className={`mt-1 w-full ${fieldClass}`} value={kids} onChange={(event) => setKids(event.target.value)}><option>Open</option><option>Wants</option><option>Wants someday</option><option>Has kids</option><option>Doesn't want</option></select></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Pets<input className={`mt-1 w-full ${fieldClass}`} value={pets} onChange={(event) => setPets(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Diet<input className={`mt-1 w-full ${fieldClass}`} value={diet} onChange={(event) => setDiet(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Exercise<input className={`mt-1 w-full ${fieldClass}`} value={exercise} onChange={(event) => setExercise(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Religion<input className={`mt-1 w-full ${fieldClass}`} value={religion} onChange={(event) => setReligion(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Zodiac<input className={`mt-1 w-full ${fieldClass}`} value={zodiac} onChange={(event) => setZodiac(event.target.value)} /></label>
          </div>
          <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Interests<input className={`mt-1 w-full ${fieldClass}`} value={interests} onChange={(event) => setInterests(event.target.value)} /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Distance<input className={`mt-1 w-full ${fieldClass}`} type="number" value={maxDistance} onChange={(event) => setMaxDistance(Number(event.target.value))} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Age min<input className={`mt-1 w-full ${fieldClass}`} type="number" value={ageMin} onChange={(event) => setAgeMin(Number(event.target.value))} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Age max<input className={`mt-1 w-full ${fieldClass}`} type="number" value={ageMax} onChange={(event) => setAgeMax(Number(event.target.value))} /></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Prompt 1<textarea className={`mt-1 min-h-20 w-full resize-none ${fieldClass}`} value={promptOne} onChange={(event) => setPromptOne(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Prompt 2<textarea className={`mt-1 min-h-20 w-full resize-none ${fieldClass}`} value={promptTwo} onChange={(event) => setPromptTwo(event.target.value)} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Prompt 3<textarea className={`mt-1 min-h-20 w-full resize-none ${fieldClass}`} value={promptThree} onChange={(event) => setPromptThree(event.target.value)} /></label>
          </div>
        </div>
        <div className={`flex justify-end gap-2 border-t ${op.borderSoft} p-4`}>
          <Button onClick={onClose} disabled={creating}>Cancel</Button>
          <Button tone="primary" className="cursor-pointer" disabled={creating || !name || !city} onClick={create}>
            <Plus className="h-4 w-4" /> {creating ? 'Creating...' : 'Create persona'}
          </Button>
        </div>
        {error && <p className={`px-4 pb-4 text-sm ${op.bad}`}>{error}</p>}
      </div>
    </div>
  )
}
