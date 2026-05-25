import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from './operatedStyles.jsx'
import { op } from './operatedTheme'

const fieldClass = `rounded-md border ${op.borderSoft} ${op.bgMain} px-3 py-2 text-sm text-[oklch(0.96_0.005_260)] outline-none`

export function NewPersonaModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState(28)
  const [gender, setGender] = useState('Woman')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')

  const create = () => {
    onCreate({
      name,
      age,
      gender,
      city,
      bio,
      hue: Math.floor(Math.random() * 360),
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className={`w-full max-w-lg rounded-lg border ${op.borderSoft} ${op.bgElev} shadow-2xl`} onClick={(event) => event.stopPropagation()}>
        <div className={`flex items-center gap-3 border-b ${op.borderSoft} p-4`}>
          <div className={`flex-1 font-semibold ${op.text}`}>New operated persona</div>
          <Button className="h-8 w-8 px-0" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-3 p-4">
          <p className={`text-sm ${op.mute}`}>Creates a new company-operated profile. Disclosure and audit controls are added automatically.</p>
          <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Display name<input className={`mt-1 w-full ${fieldClass}`} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Age<input className={`mt-1 w-full ${fieldClass}`} type="number" value={age} onChange={(event) => setAge(Number(event.target.value))} /></label>
            <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Gender<select className={`mt-1 w-full ${fieldClass}`} value={gender} onChange={(event) => setGender(event.target.value)}><option>Woman</option><option>Man</option><option>Non-binary</option></select></label>
          </div>
          <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>City<input className={`mt-1 w-full ${fieldClass}`} placeholder="Brooklyn, NY" value={city} onChange={(event) => setCity(event.target.value)} /></label>
          <label className={`block text-xs font-medium uppercase tracking-[0.08em] ${op.mute}`}>Bio<textarea className={`mt-1 min-h-24 w-full resize-none ${fieldClass}`} value={bio} onChange={(event) => setBio(event.target.value)} /></label>
        </div>
        <div className={`flex justify-end gap-2 border-t ${op.borderSoft} p-4`}>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" disabled={!name || !city} onClick={create}><Plus className="h-4 w-4" /> Create persona</Button>
        </div>
      </div>
    </div>
  )
}
