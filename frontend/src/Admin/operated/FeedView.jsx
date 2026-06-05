import { useEffect, useState } from 'react'
import { Filter, Heart, RotateCcw, Star, X } from 'lucide-react'
import { userGet, userPost } from './operatedApi'
import { Button, Chip } from './operatedStyles.jsx'
import { avatarGradient, op } from './operatedTheme'

export function FeedView({ persona, userToken }) {
  const [stack, setStack] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const top = stack[0]

  const loadFeed = ({ startOver = false } = {}) => {
    if (!userToken) return
    setLoading(true)
    const query = startOver
      ? '/user/discover/cards?limit=20&resetPasses=true&resetAll=true&operatedMode=true'
      : '/user/discover/cards?limit=20&resetPasses=false&operatedMode=true'
    userGet(query, userToken)
      .then(({ cards }) => {
        setStack(cards.map((card) => ({
          id: card.id,
          name: card.handle,
          age: card.age,
          hue: Math.abs(String(card.id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360,
          distance: card.distanceLabel || 'nearby',
          neighborhood: card.city || '',
          bio: card.bio || card.aboutMe || '',
          pills: card.interests || [],
        })))
        setError('')
      })
      .catch((err) => setError(err.message || 'Failed to load feed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      loadFeed()
      setMatches([])
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToken])

  const reload = () => {
    loadFeed()
    setMatches([])
  }

  const startOver = () => {
    setError('')
    loadFeed({ startOver: true })
    setMatches([])
  }

  const swipe = (direction) => {
    if (!top) return
    const type = direction === 'super' ? 'super_like' : direction === 'like' ? 'like' : 'pass'
    userPost('/user/discover/swipe', { toUserId: top.id, type }, userToken)
      .then((result) => {
        setStack((value) => value.slice(1))
        if (result.matched || direction === 'like' || direction === 'super') {
          setMatches((value) => [{ ...top, time: 'just now', super: direction === 'super', matched: result.matched }, ...value])
        }
      })
      .catch((err) => setError(err.message || 'Failed to save swipe'))
  }

  return (
    <div className={`grid h-full min-h-0 flex-1 grid-cols-[1fr_360px] gap-4 overflow-y-auto p-4 ${op.scrollbar}`}>
      <section className={`grid min-h-0 place-items-center rounded-lg border ${op.borderSoft} ${op.bgElev} p-6`}>
        <div className="w-full max-w-[460px] space-y-4">
          <div className="flex flex-wrap gap-2">
            <Chip>acting as {persona.name}</Chip>
            <Chip tone="accent">live - real users</Chip>
            <Chip tone="warn">engagement logged</Chip>
          </div>
          {loading && <div className={`rounded-lg border ${op.borderSoft} ${op.bgMain} p-4 text-center ${op.mute}`}>Loading feed...</div>}
          {error && <div className={`rounded-lg border ${op.borderSoft} ${op.badBg} p-3 text-sm ${op.bad}`}>{error}</div>}

          {!loading && top ? (
            <div className="relative grid aspect-[3/4] overflow-hidden rounded-2xl p-6 shadow-2xl" style={avatarGradient(top.hue)}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="relative mt-auto space-y-3 text-white">
                <div>
                  <div className="text-3xl font-bold">{top.name}, {top.age}</div>
                  <div className="text-sm text-white/75">{top.distance} away - {top.neighborhood}</div>
                </div>
                <p className="rounded-lg bg-black/25 p-3 text-sm leading-5">{top.bio}</p>
                <div className="flex flex-wrap gap-2">{top.pills.map((pill) => <span key={pill} className="rounded-full bg-white/15 px-2 py-1 text-xs">{pill}</span>)}</div>
              </div>
            </div>
          ) : !loading ? (
            <div className={`grid aspect-[3/4] place-items-center rounded-2xl border ${op.borderSoft} ${op.bgMain} text-center ${op.dim}`}>
              <div>
                <div className="text-base">You have reached the end of the feed.</div>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button onClick={reload}><RotateCcw className="h-4 w-4" /> Reload</Button>
                  <Button tone="primary" onClick={startOver}><RotateCcw className="h-4 w-4" /> Start over</Button>
                </div>
              </div>
            </div>
          ) : null}

          {top && (
            <div className="flex justify-center gap-5">
              <button type="button" className="grid h-14 w-14 place-items-center rounded-full border border-[oklch(0.70_0.19_25_/_0.35)] bg-[oklch(0.70_0.19_25_/_0.12)] text-[oklch(0.70_0.19_25)]" onClick={() => swipe('nope')}><X className="h-6 w-6" /></button>
              <button type="button" className="grid h-14 w-14 place-items-center rounded-full border border-[oklch(0.75_0.12_235_/_0.35)] bg-[oklch(0.75_0.12_235_/_0.12)] text-[oklch(0.75_0.12_235)]" onClick={() => swipe('super')}><Star className="h-5 w-5" /></button>
              <button type="button" className="grid h-14 w-14 place-items-center rounded-full border border-[oklch(0.78_0.14_155_/_0.35)] bg-[oklch(0.78_0.14_155_/_0.12)] text-[oklch(0.78_0.14_155)]" onClick={() => swipe('like')}><Heart className="h-6 w-6" /></button>
            </div>
          )}
        </div>
      </section>

      <aside className={`min-h-0 space-y-4 overflow-y-auto ${op.scrollbar}`}>
        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Filters</h2>
          <div className={`mt-3 space-y-2 text-sm ${op.dim}`}>
            <div className="flex justify-between"><span>Distance</span><span className="font-mono">25 mi</span></div>
            <div className="flex justify-between"><span>Age</span><span className="font-mono">26 - 36</span></div>
            <div className="flex justify-between"><span>Verified only</span><Chip tone="ok">on</Chip></div>
            <div className="flex justify-between"><span>Intent</span><span className={op.text}>Long-term</span></div>
          </div>
          <Button className="mt-4"><Filter className="h-4 w-4" /> Edit filters</Button>
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>New matches <Chip tone="accent" className="ml-2">{matches.length}</Chip></h2>
          {matches.length === 0 && <div className={`py-4 text-sm ${op.mute}`}>Swipe right to match.</div>}
          <div className="mt-3 space-y-2">
            {matches.map((match) => (
              <div key={`${match.id}-${match.time}`} className={`flex items-center gap-3 rounded-lg ${op.bgElev2} p-2`}>
                <span className="grid h-9 w-9 place-items-center rounded-full font-bold text-white" style={avatarGradient(match.hue)}>{match.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-semibold ${op.text}`}>{match.name} {match.super && <Chip tone="accent">super</Chip>}</div>
                  <div className={`text-xs ${op.mute}`}>{match.time} - {match.neighborhood}</div>
                </div>
                <Button className="px-2 py-1 text-xs">Open chat</Button>
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Session</h2>
          <div className={`mt-3 space-y-2 text-sm ${op.dim}`}>
            <div className="flex justify-between"><span>Remaining</span><span className="font-mono">{stack.length}</span></div>
            <div className="flex justify-between"><span>Right-swipe rate</span><span className="font-mono">38%</span></div>
            <div className="flex justify-between"><span>Daily swipe cap</span><span className="font-mono">60 / 120</span></div>
          </div>
        </section>
      </aside>
    </div>
  )
}
