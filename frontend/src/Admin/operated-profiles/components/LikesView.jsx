import { useEffect, useState } from 'react'
import { Heart, RefreshCw, Star, X } from 'lucide-react'
import { userGet, userPost } from '../core/operatedApi.js'
import { avatarGradient, op } from '../theme/operatedTheme.js'
import { Button, Chip } from '../ui/operatedStyles.jsx'

export function LikesView({ persona, userToken, onMatched }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadLikes = () => {
    if (!userToken) return
    setLoading(true)
    userGet('/user/likes/received?limit=50', userToken)
      .then(({ items: nextItems }) => {
        setItems(nextItems || [])
        setError('')
      })
      .catch((err) => setError(err.message || 'Failed to load received likes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) loadLikes()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToken])

  const likeBack = (item) => {
    userPost(`/user/likes/${item.fromUserId}/like-back`, {}, userToken)
      .then((result) => {
        setItems((value) => value.filter((entry) => entry.fromUserId !== item.fromUserId))
        onMatched?.(result.matchId)
      })
      .catch((err) => setError(err.message || 'Failed to like back'))
  }

  const pass = (item) => {
    userPost(`/user/likes/${item.fromUserId}/pass`, {}, userToken)
      .then(() => {
        setItems((value) => value.filter((entry) => entry.fromUserId !== item.fromUserId))
      })
      .catch((err) => setError(err.message || 'Failed to pass liker'))
  }

  return (
    <div className={`h-full min-h-0 flex-1 overflow-y-auto p-4 ${op.scrollbar}`}>
      <div className={`mb-4 flex items-center gap-3 rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
        <div>
          <h2 className={`text-base font-semibold ${op.text}`}>Received likes</h2>
          <p className={`mt-1 text-sm ${op.mute}`}>Review likes sent to {persona.name || persona.handle}. Like back to create a real match.</p>
        </div>
        <div className="flex-1" />
        <Chip tone="accent">{items.length} pending</Chip>
        <Button onClick={loadLikes} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      {error && <div className={`mb-4 rounded-lg border ${op.borderSoft} ${op.badBg} p-3 text-sm ${op.bad}`}>{error}</div>}
      {loading && <div className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-8 text-center ${op.mute}`}>Loading likes...</div>}
      {!loading && items.length === 0 && (
        <div className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-8 text-center ${op.mute}`}>No pending likes yet.</div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {items.map((item) => {
          const hue = Math.abs(String(item.fromUserId).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360
          return (
            <article key={item.fromUserId} className={`overflow-hidden rounded-lg border ${op.borderSoft} ${op.bgElev}`}>
              <div className="relative aspect-[4/3]" style={avatarGradient(hue)}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <div className="absolute left-4 bottom-4 right-4">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-bold text-white">{item.handle || 'Unknown'}</h3>
                    {item.age && <span className="text-sm text-white/70">{item.age}</span>}
                  </div>
                  <div className="mt-1 text-sm text-white/70">{item.distanceLabel || 'nearby'}</div>
                </div>
                {item.superLike && (
                  <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[oklch(0.75_0.12_235_/_0.20)] px-2 py-1 text-xs font-semibold text-[oklch(0.85_0.08_235)]">
                    <Star className="h-3.5 w-3.5" /> Super like
                  </div>
                )}
              </div>
              <div className="space-y-3 p-3">
                <div className="flex items-center gap-2">
                  {item.verified && <Chip tone="ok">verified</Chip>}
                  <Chip>{item.type}</Chip>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => pass(item)}><X className="h-4 w-4" /> Pass</Button>
                  <Button tone="primary" className="flex-1" onClick={() => likeBack(item)}><Heart className="h-4 w-4" /> Like back</Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
