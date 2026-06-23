import { useEffect, useMemo, useState } from 'react'
import { Shield, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { Button, Chip, StatusDot } from './ui/operatedStyles.jsx'
import { op } from './theme/operatedTheme.js'
import { adminGet, adminPatch, adminPost } from './core/operatedApi.js'
import { PersonaRail } from './components/PersonaRail.jsx'
import { InboxView } from './components/InboxView.jsx'
import { ProfileView } from './components/ProfileView.jsx'
import { FeedView } from './components/FeedView.jsx'
import { DashboardView } from './components/DashboardView.jsx'
import { NewPersonaModal } from './components/NewPersonaModal.jsx'
import { LikesView } from './components/LikesView.jsx'

const tabs = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'likes', label: 'Likes' },
  { id: 'profile', label: 'Profile' },
  { id: 'feed', label: 'Feed' },
  { id: 'dashboard', label: 'Dashboard' },
]

export default function OperatedProfilesApp() {
  const { admin } = useAuth()
  const [personas, setPersonas] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [operatedToken, setOperatedToken] = useState('')
  const [tab, setTab] = useState('inbox')
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const persona = personas.find((item) => item.id === selectedId) ?? personas[0] ?? null
  const unreadByPersona = useMemo(() => {
    return Object.fromEntries(personas.map((item) => [item.id, item.unread ?? 0]))
  }, [personas])
  const threadsCount = persona?.stats?.active ?? 0

  useEffect(() => {
    let cancelled = false
    adminGet('/admin/operated/personas')
      .then(({ personas: nextPersonas }) => {
        if (cancelled) return
        setPersonas(nextPersonas)
        setSelectedId((current) => current || nextPersonas[0]?.id || '')
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load operated personas')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!persona?.id) {
      return undefined
    }

    adminGet(`/admin/operated/personas/${persona.id}`)
      .then(({ persona: fullPersona }) => {
        if (cancelled || !fullPersona?.id) return
        setPersonas((value) => value.map((item) => (item.id === fullPersona.id ? { ...item, ...fullPersona } : item)))
      })
      .catch(() => {
        /* keep summary payload if detail load fails */
      })

    adminPost(`/admin/operated/personas/${persona.id}/session`)
      .then(({ accessToken }) => {
        if (!cancelled) setOperatedToken(accessToken)
      })
      .catch((err) => {
        if (!cancelled) {
          setOperatedToken('')
          setError(err.message || 'Failed to create operated session')
        }
      })

    return () => {
      cancelled = true
    }
  }, [persona?.id])

  const updatePersona = async (nextPersona) => {
    const payload = {
      name: nextPersona.name,
      age: nextPersona.age,
      gender: nextPersona.gender,
      orientation: nextPersona.orientation,
      pronouns: nextPersona.pronouns,
      looking: nextPersona.looking,
      city: nextPersona.city,
      countryCode: nextPersona.country,
      latApprox: nextPersona.latApprox,
      lngApprox: nextPersona.lngApprox,
      bio: nextPersona.bio,
      aboutMe: nextPersona.aboutMe,
      work: nextPersona.work,
      relStatus: nextPersona.relStatus,
      intent: nextPersona.intent,
      height: nextPersona.height,
      drinks: nextPersona.drinks,
      smokes: nextPersona.smokes,
      kids: nextPersona.kids,
      pets: nextPersona.pets,
      diet: nextPersona.diet,
      exercise: nextPersona.exercise,
      religion: nextPersona.religion,
      zodiac: nextPersona.zodiac,
      edu: nextPersona.edu,
      interests: Array.isArray(nextPersona.interests) ? nextPersona.interests : [],
      prompts: Array.isArray(nextPersona.prompts) ? nextPersona.prompts : [],
      photos: Array.isArray(nextPersona.photosList)
        ? nextPersona.photosList.filter((photo) => photo?.storageKey && String(photo.storageKey).trim())
        : undefined,
    }
    const { persona: saved } = await adminPatch(`/admin/operated/personas/${nextPersona.id}`, payload)
    let refreshed = saved
    try {
      const { persona: fullPersona } = await adminGet(`/admin/operated/personas/${nextPersona.id}`)
      if (fullPersona?.id) refreshed = fullPersona
    } catch {
      /* keep PATCH payload response if refresh fails */
    }
    setPersonas((value) => value.map((item) => (item.id === refreshed.id ? { ...item, ...refreshed } : item)))
  }

  const createPersona = async (draft) => {
    const { persona: next } = await adminPost('/admin/operated/personas', {
      name: draft.name,
      age: draft.age,
      gender: draft.gender,
      orientation: draft.orientation,
      intent: draft.intent,
      relStatus: draft.relStatus,
      pronouns: draft.pronouns,
      looking: draft.looking,
      city: draft.city,
      countryCode: draft.countryCode,
      latApprox: draft.latApprox,
      lngApprox: draft.lngApprox,
      bio: draft.bio || 'New persona bio.',
      aboutMe: draft.aboutMe,
      work: draft.work,
      height: draft.height,
      edu: draft.edu,
      drinks: draft.drinks,
      smokes: draft.smokes,
      kids: draft.kids,
      pets: draft.pets,
      diet: draft.diet,
      exercise: draft.exercise,
      religion: draft.religion,
      zodiac: draft.zodiac,
      interests: draft.interests,
      photos: draft.photos,
      maxDistance: draft.maxDistance,
      ageMin: draft.ageMin,
      ageMax: draft.ageMax,
      prompts: draft.prompts,
    })
    setPersonas((value) => [...value, next])
    setSelectedId(next.id)
    setTab('profile')
    setNewOpen(false)
  }

  return (
    <div className={`grid h-screen grid-rows-[57px_1fr] overflow-hidden ${op.bgMain} ${op.text}`}>
      <header className="flex items-center gap-4 border-b border-[oklch(0.26_0.01_260)] bg-[linear-gradient(90deg,oklch(0.70_0.17_25_/_0.18),oklch(0.17_0.008_260))] px-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[radial-gradient(circle_at_30%_30%,oklch(0.80_0.17_25),oklch(0.55_0.17_25))]" />
          <div>
            <div className="text-sm font-bold"><span>Ohrny</span> <span className={op.mute}>- operated profiles</span></div>
            <div className={`font-mono text-[11px] ${op.mute}`}>workspace - separate from admin console</div>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-md ${op.warnBg} px-3 py-1 text-xs font-semibold ${op.warn}`}>
          <Shield className="h-3.5 w-3.5" /> live engagement with real users - every action is attributable and audited
        </div>
        <div className="flex-1" />
        <Chip>{admin?.name ?? 'Elena M.'} - founder</Chip>
        <Button onClick={() => window.close()}><X className="h-4 w-4" /> Close</Button>
      </header>

      <main className="grid min-h-0 grid-cols-[280px_1fr]">
        <PersonaRail
          personas={personas}
          selectedId={persona?.id}
          unreadByPersona={unreadByPersona}
          search={search}
          onSearchChange={setSearch}
          onSelect={setSelectedId}
          onNew={() => setNewOpen(true)}
        />

        <section className="grid min-h-0 grid-rows-[54px_1fr] overflow-hidden">
          <div className={`flex items-center gap-2 border-b ${op.borderSoft} px-5`}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex h-full items-center gap-2 border-b-2 px-3 text-sm font-medium ${
                  tab === item.id ? `border-[oklch(0.72_0.15_25)] ${op.text}` : `border-transparent ${op.dim} hover:${op.text}`
                }`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {item.id === 'inbox' && <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${tab === item.id ? `${op.accentBg} ${op.accent}` : `${op.bgElev2} ${op.mute}`}`}>{threadsCount}</span>}
              </button>
            ))}
            <div className="flex-1" />
            {persona && <Chip tone={persona.status === 'active' ? 'ok' : 'warn'}><StatusDot status={persona.status} /> {persona.status}</Chip>}
            {persona && <Button onClick={async () => {
              const status = persona.status === 'active' ? 'paused' : 'active'
              const { persona: saved } = await adminPatch(`/admin/operated/personas/${persona.id}/status`, { status })
              setPersonas((value) => value.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)))
            }}>
              {persona.status === 'active' ? 'Pause persona' : 'Activate persona'}
            </Button>
            }
          </div>

          <div className="min-h-0 overflow-hidden">
            {loading && <div className={`grid h-full place-items-center ${op.mute}`}>Loading operated personas...</div>}
            {!loading && error && <div className={`grid h-full place-items-center ${op.bad}`}>{error}</div>}
            {!loading && !error && !persona && <div className={`grid h-full place-items-center ${op.mute}`}>Create an operated persona to begin.</div>}
            {!loading && !error && persona && tab === 'inbox' && <InboxView persona={persona} userToken={operatedToken} />}
            {!loading && !error && persona && tab === 'likes' && <LikesView persona={persona} userToken={operatedToken} onMatched={() => setTab('inbox')} />}
            {!loading && !error && persona && tab === 'profile' && (
              <ProfileView
                persona={persona}
                onSave={updatePersona}
                userToken={operatedToken}
              />
            )}
            {!loading && !error && persona && tab === 'feed' && <FeedView persona={persona} userToken={operatedToken} />}
            {!loading && !error && persona && tab === 'dashboard' && <DashboardView persona={persona} />}
          </div>
        </section>
      </main>

      {newOpen && <NewPersonaModal onClose={() => setNewOpen(false)} onCreate={createPersona} />}
    </div>
  )
}
