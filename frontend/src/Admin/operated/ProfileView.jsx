import { Camera, Check, Eye, Plus, X } from 'lucide-react'
import { Button, Chip } from './operatedStyles.jsx'
import { avatarGradient, op } from './operatedTheme'

function Field({ label, children }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-[0.08em] text-[oklch(0.55_0.01_260)]">
      {label}
      {children}
    </label>
  )
}

const inputClass = `rounded-md border ${op.borderSoft} ${op.bgMain} px-3 py-2 text-sm normal-case tracking-normal ${op.text} outline-none`

export function ProfileView({ persona, onChange }) {
  const interests = Array.isArray(persona.interests) ? persona.interests : []
  const photoCount = Number.isFinite(Number(persona.photos)) ? Number(persona.photos) : 0
  const hue = Number.isFinite(Number(persona.hue)) ? Number(persona.hue) : 12
  const set = (key, value) => onChange({ ...persona, [key]: value })
  const removeInterest = (interest) => set('interests', interests.filter((item) => item !== interest))

  return (
    <div className={`grid h-full min-h-0 flex-1 grid-cols-[1fr_320px] gap-4 overflow-y-auto p-4 ${op.scrollbar}`}>
      <div className="space-y-4">
        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Identity</h2>
          <p className={`mt-1 text-xs ${op.mute}`}>Publicly visible on the profile. Users see exactly what you enter here.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Display name"><input className={inputClass} value={persona.name || persona.handle || ''} onChange={(event) => set('name', event.target.value)} /></Field>
            <Field label="Age"><input className={inputClass} type="number" value={persona.age || 18} onChange={(event) => set('age', Number(event.target.value))} /></Field>
            <Field label="Gender"><select className={inputClass} value={persona.gender || 'Woman'} onChange={(event) => set('gender', event.target.value)}><option>Woman</option><option>Man</option><option>Non-binary</option></select></Field>
            <Field label="Orientation"><select className={inputClass} value={Array.isArray(persona.orientation) ? persona.orientation[0] || 'everyone' : persona.orientation || 'everyone'} onChange={(event) => set('orientation', [event.target.value])}><option value="women">Women</option><option value="men">Men</option><option value="everyone">Everyone</option><option value="nonbinary">Non-binary</option></select></Field>
            <Field label="City"><input className={inputClass} value={persona.city || ''} onChange={(event) => set('city', event.target.value)} /></Field>
            <Field label="Height"><input className={inputClass} value={persona.height || ''} onChange={(event) => set('height', event.target.value)} /></Field>
          </div>
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Photos <span className={`font-normal ${op.mute}`}>- {photoCount} of 6</span></h2>
          <p className={`mt-1 text-xs ${op.mute}`}>First photo is the cover. Upload licensed assets only.</p>
          <div className="mt-4 grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, index) => {
              const filled = index < photoCount
              return (
                <button
                  key={index}
                  type="button"
                  className={`relative grid aspect-[3/4] place-items-center overflow-hidden rounded-lg border ${op.borderSoft} text-xs ${filled ? 'text-white' : op.mute}`}
                  style={filled ? avatarGradient((hue + index * 25) % 360) : undefined}
                  onClick={() => !filled && set('photos', Math.min(6, photoCount + 1))}
                >
                  {filled ? <span className="font-mono">{index + 1}</span> : <span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> upload</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => set('photos', Math.min(6, photoCount + 1))}><Camera className="h-4 w-4" /> Add photo</Button>
            <Chip tone="ok" className="ml-auto">no face-match conflicts</Chip>
          </div>
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Bio & prompts</h2>
          <div className="mt-4 space-y-3">
            <Field label="Bio">
              <textarea className={`${inputClass} min-h-24 resize-none`} value={persona.bio || ''} maxLength={280} onChange={(event) => set('bio', event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Work"><input className={inputClass} value={persona.work || ''} onChange={(event) => set('work', event.target.value)} /></Field>
              <Field label="Education"><input className={inputClass} value={persona.edu || ''} onChange={(event) => set('edu', event.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <Chip key={interest}>{interest}<X className="h-3 w-3 cursor-pointer" onClick={() => removeInterest(interest)} /></Chip>
              ))}
            </div>
          </div>
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Relationship & lifestyle</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Relationship status"><select className={inputClass} value={persona.relStatus || 'single'} onChange={(event) => set('relStatus', event.target.value)}><option value="single">Single</option><option value="in_relationship">In relationship</option><option value="complicated">Complicated</option><option value="prefer_not_say">Private</option></select></Field>
            <Field label="Intent"><select className={inputClass} value={persona.intent || 'serious'} onChange={(event) => set('intent', event.target.value)}><option value="serious">Long-term</option><option value="dating">Dating</option><option value="figuring_out">Figuring it out</option><option value="casual">Casual</option></select></Field>
            <Field label="Drinks"><select className={inputClass} value={persona.drinks || ''} onChange={(event) => set('drinks', event.target.value)}><option value="">Unset</option><option>Yes</option><option>Socially</option><option>Sometimes</option><option>Rarely</option><option>No</option></select></Field>
            <Field label="Smokes"><select className={inputClass} value={persona.smokes || ''} onChange={(event) => set('smokes', event.target.value)}><option value="">Unset</option><option>No</option><option>Socially</option><option>Yes</option></select></Field>
          </div>
        </section>

        <div className="flex gap-2">
          <Button tone="primary"><Check className="h-4 w-4" /> Save changes</Button>
          <Button><Eye className="h-4 w-4" /> Preview as user</Button>
          <Button tone="danger" className="ml-auto">Archive persona</Button>
        </div>
      </div>

      <aside className="space-y-4">
        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Live preview</h2>
          <div className={`mt-3 overflow-hidden rounded-[28px] border ${op.border} ${op.bgMain} p-2`}>
            <div className="relative aspect-[9/13] overflow-hidden rounded-[22px]" style={avatarGradient(hue)}>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4">
                <div className="text-xl font-bold text-white">{persona.name || persona.handle}, {persona.age}</div>
                <div className="text-sm text-white/75">{persona.city || 'Unknown city'}</div>
              </div>
            </div>
            <div className={`space-y-3 p-3 text-sm ${op.dim}`}>
              <p>{persona.bio || 'No bio yet.'}</p>
              <div className="flex flex-wrap gap-1.5">{interests.slice(0, 6).map((interest) => <Chip key={interest}>{interest}</Chip>)}</div>
            </div>
          </div>
        </section>
        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Governance</h2>
          <div className={`mt-3 space-y-2 text-sm ${op.dim}`}>
            <div className="flex justify-between"><span>Created by</span><span className={op.text}>{persona.createdBy}</span></div>
            <div className="flex justify-between"><span>Team</span><span className={op.text}>{persona.team}</span></div>
            <div className="flex justify-between"><span>Verified badge</span><Chip tone="ok">on</Chip></div>
            <div className="flex justify-between"><span>Disclosure</span><Chip tone="warn">required</Chip></div>
          </div>
          <p className={`mt-4 border-t ${op.borderSoft} pt-3 text-xs leading-5 ${op.mute}`}>Every message is attributed to the team member who sent it. Required disclosure remains part of Ohrny policy.</p>
        </section>
      </aside>
    </div>
  )
}
