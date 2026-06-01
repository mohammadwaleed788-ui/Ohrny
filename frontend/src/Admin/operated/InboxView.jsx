import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, MoreHorizontal, Search, Send, X } from 'lucide-react'
import { aiSuggestions } from './operatedData'
import { userGet, userPatch, userPost } from './operatedApi'
import { Button, Chip } from './operatedStyles.jsx'
import { avatarGradient, op } from './operatedTheme'

const suggestionText = {
  'Keep it playful': 'honestly that tracks',
  'Ask a question': 'okay real question: what is the last thing you got way too into?',
  'Propose meeting up': 'want to grab a coffee this weekend?',
  'Check in after silence': 'hey, you disappeared on me. still around?',
}

const POLL_INTERVAL_MS = 8000

function stableHue(value) {
  return Math.abs(String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360
}

function mapMatchToThread(match) {
  return {
    id: match.matchId,
    name: match.partner?.handle || 'Unknown',
    handle: match.partner?.handle || '',
    preview: match.lastMessage?.content || 'Matched. Start the conversation.',
    time: match.lastMessage?.createdAt ? new Date(match.lastMessage.createdAt).toLocaleString() : 'new',
    timeRank: match.lastMessage?.createdAt ? -new Date(match.lastMessage.createdAt).getTime() : 0,
    unread: match.unreadCount || 0,
    flagged: false,
    age: match.partner?.age,
    hue: stableHue(match.partner?.id || match.matchId),
    matchedOn: match.matchedAt ? new Date(match.matchedAt).toLocaleDateString() : '',
    raw: match,
  }
}

function mapApiMessages(messages = []) {
  return [...messages].reverse().map((message) => ({
    id: message.id,
    from: message.fromMe ? 'mine' : 'them',
    text: message.content,
    time: message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : '',
  }))
}

export function InboxView({ persona, userToken }) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('unread')
  const [search, setSearch] = useState('')
  const [selectedByPersona, setSelectedByPersona] = useState({})
  const [draftByThread, setDraftByThread] = useState({})
  const [loadedMessages, setLoadedMessages] = useState({})

  useEffect(() => {
    let cancelled = false
    let intervalId = null
    if (!userToken) return undefined

    const loadMatches = ({ showLoading = false } = {}) => {
      if (showLoading) {
        queueMicrotask(() => {
          if (!cancelled) setLoading(true)
        })
      }
      userGet('/user/matches', userToken)
        .then(({ matches }) => {
          if (!cancelled) {
            setThreads((matches || []).map(mapMatchToThread))
            setError('')
          }
        })
        .catch((err) => {
          if (!cancelled && err.status !== 429) setError(err.message || 'Failed to load matches')
        })
        .finally(() => {
          if (!cancelled && showLoading) setLoading(false)
        })
    }

    loadMatches({ showLoading: true })
    intervalId = setInterval(() => loadMatches(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [userToken])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return threads
      .filter((thread) => {
        if (filter === 'unread' && thread.unread <= 0) return false
        if (filter === 'flagged' && !thread.flagged) return false
        if (!query) return true
        return thread.name.toLowerCase().includes(query) || thread.handle.toLowerCase().includes(query) || thread.preview.toLowerCase().includes(query)
      })
      .sort((a, b) => {
        if (sortBy === 'recent') return a.timeRank - b.timeRank || b.unread - a.unread
        if (sortBy === 'flagged') return Number(b.flagged) - Number(a.flagged) || b.unread - a.unread
        return b.unread - a.unread || a.timeRank - b.timeRank
      })
  }, [filter, search, sortBy, threads])

  const selectedId = selectedByPersona[persona.id]
  const current = threads.find((thread) => thread.id === selectedId) ?? filtered[0] ?? null
  const visible = filtered.slice(0, 120)
  useEffect(() => {
    let cancelled = false
    let intervalId = null
    let markedRead = false
    if (!current?.id || !userToken) return undefined

    const loadMessages = () => {
      userGet(`/user/matches/${current.id}/messages`, userToken)
        .then(({ messages: apiMessages }) => {
          if (!cancelled) {
            setLoadedMessages((value) => ({
              ...value,
              [current.id]: mapApiMessages(apiMessages),
            }))
            if (!markedRead) {
              markedRead = true
              userPatch(`/user/matches/${current.id}/read`, {}, userToken).catch(() => {})
            }
          }
        })
        .catch((err) => {
          if (!cancelled && err.status !== 429) setError(err.message || 'Failed to load messages')
        })
    }

    queueMicrotask(() => {
      if (!cancelled) loadMessages()
    })
    intervalId = setInterval(loadMessages, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [current?.id, userToken])

  const messages = loadedMessages[current?.id] ?? []
  const draft = draftByThread[current?.id] ?? ''
  const totalUnread = threads.reduce((sum, thread) => sum + thread.unread, 0)
  const totalFlagged = threads.filter((thread) => thread.flagged).length

  const selectThread = (threadId) => setSelectedByPersona((value) => ({ ...value, [persona.id]: threadId }))
  const setDraft = (text) => current && setDraftByThread((value) => ({ ...value, [current.id]: text }))

  const send = () => {
    if (!current || !draft.trim()) return
    userPost(`/user/matches/${current.id}/messages`, { content: draft.trim() }, userToken)
      .then(({ message }) => {
        const sent = { id: message.id, from: 'mine', text: message.content, time: 'just now' }
        setLoadedMessages((value) => ({ ...value, [current.id]: [...(value[current.id] || []), sent] }))
        setDraft('')
      })
      .catch((err) => setError(err.message || 'Failed to send message'))
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[380px_1fr] gap-4 overflow-hidden p-4">
      <div className={`grid min-h-0 grid-rows-[auto_auto_1fr] overflow-hidden rounded-lg border ${op.borderSoft} ${op.bgElev}`}>
        <div className={`space-y-3 border-b ${op.borderSoft} p-3`}>
          <div className={`flex items-center gap-2 rounded-md border ${op.borderSoft} ${op.bgElev2} px-3 py-2 ${op.mute}`}>
            <Search className="h-4 w-4" />
            <input
              className={`w-full bg-transparent text-sm ${op.text} outline-none placeholder:${op.mute}`}
              placeholder="Search name, handle, message..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && <X className="h-3.5 w-3.5 cursor-pointer" onClick={() => setSearch('')} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['all', 'All', threads.length],
              ['unread', 'Unread', totalUnread],
              ['flagged', 'Flagged', totalFlagged],
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`rounded-md px-2 py-1 text-xs ${filter === key ? `${op.accentBg} ${op.text}` : `${op.bgElev2} ${op.dim}`}`}
                onClick={() => setFilter(key)}
              >
                {label} <span className="ml-1 rounded-full bg-[oklch(0.70_0.19_25_/_0.20)] px-1.5 font-mono text-[10px] text-[oklch(0.75_0.18_25)]">{count.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <select className={`rounded-md border ${op.borderSoft} ${op.bgElev2} px-3 py-1.5 text-xs ${op.dim} outline-none`} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="unread">Sort - Most unread</option>
            <option value="recent">Sort - Most recent</option>
            <option value="flagged">Sort - Flagged first</option>
          </select>
        </div>

        <div className={`border-b ${op.borderSoft} px-3 py-2 font-mono text-[11px] ${op.mute}`}>
          {loading ? 'Loading chats...' : `${filtered.length.toLocaleString()} of ${threads.length.toLocaleString()} chats - ${filtered.reduce((sum, thread) => sum + thread.unread, 0).toLocaleString()} unread`}
        </div>

        <div className={`min-h-0 overflow-y-auto ${op.scrollbar}`}>
          {error && <div className={`p-4 text-sm ${op.bad}`}>{error}</div>}
          {visible.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className={`flex w-full items-center gap-3 border-b ${op.borderSoft} px-3 py-2.5 text-left ${current?.id === thread.id ? op.accentBg : op.hover}`}
              onClick={() => selectThread(thread.id)}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold text-white" style={avatarGradient(thread.hue)}>{thread.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={`truncate text-sm font-semibold ${op.text}`}>{thread.name}</span>
                  {thread.flagged && <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.82_0.14_80)]" />}
                </span>
                <span className={`block truncate text-xs ${op.mute}`}>{thread.preview}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={`font-mono text-[10px] ${op.mute}`}>{thread.time}</span>
                {thread.unread > 0 && <span className="rounded-full bg-[oklch(0.76_0.18_25)] px-1.5 font-mono text-[10px] font-bold text-white">{thread.unread}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border ${op.borderSoft} ${op.bgElev}`}>
        {!current ? (
          <div className={`grid h-full place-items-center ${op.mute}`}>Pick a conversation.</div>
        ) : (
          <>
            <div className={`flex items-center gap-3 border-b ${op.borderSoft} p-4`}>
              <span className="grid h-11 w-11 place-items-center rounded-full font-bold text-white" style={avatarGradient(current.hue)}>{current.name[0]}</span>
              <div className="min-w-0 flex-1">
                <div className={`font-semibold ${op.text}`}>{current.name} <span className={`font-mono text-xs font-normal ${op.mute}`}>- {current.age}</span></div>
                <div className={`text-xs ${op.mute}`}>{current.handle} - matched {current.matchedOn}</div>
              </div>
              <Chip tone="ok">verified</Chip>
              {current.flagged && <Chip tone="warn">escalation</Chip>}
              <Button className="h-8 w-8 px-0" title="Open user in admin"><ExternalLink className="h-4 w-4" /></Button>
              <Button className="h-8 w-8 px-0" title="More"><MoreHorizontal className="h-4 w-4" /></Button>
            </div>
            <div className={`flex gap-4 border-b ${op.borderSoft} px-4 py-2 text-xs ${op.mute}`}>
              <span><b className={op.dim}>Last active</b> - {current.time}</span>
              <span><b className={op.dim}>Matched</b> - {current.matchedOn}</span>
              <span><b className={op.dim}>Compat</b> - 82%</span>
            </div>
            <div className={`min-h-0 space-y-3 overflow-y-auto p-4 ${op.scrollbar}`}>
              <div className={`text-center font-mono text-[11px] ${op.mute}`}>Conversation start - matched {current.matchedOn}</div>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.from === 'mine' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[68%]">
                    <div className={`rounded-2xl px-3 py-2 text-sm ${message.from === 'mine' ? 'bg-[oklch(0.72_0.15_25)] text-[oklch(0.18_0.04_25)]' : `${op.bgElev2} ${op.text}`}`}>{message.text}</div>
                    <div className={`mt-1 text-[11px] ${message.from === 'mine' ? 'text-right' : ''} ${op.mute}`}>
                      {message.from === 'mine' ? `${persona.name.split(' ')[0]} (${persona.team}) - ` : ''}{message.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={`border-t ${op.borderSoft} p-3`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`text-xs ${op.mute}`}>Suggest:</span>
                {aiSuggestions.map((suggestion) => (
                  <button key={suggestion} type="button" className={`rounded-full ${op.bgElev2} px-2 py-1 text-xs ${op.dim} ${op.hover}`} onClick={() => setDraft(suggestionText[suggestion])}>{suggestion}</button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  className={`min-h-16 flex-1 resize-none rounded-md border ${op.borderSoft} ${op.bgMain} px-3 py-2 text-sm ${op.text} outline-none placeholder:${op.mute}`}
                  placeholder={`Reply as ${persona.name.split(' ')[0]}...`}
                  value={draft}
                  rows={2}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      send()
                    }
                  }}
                />
                <Button tone="primary" disabled={!draft.trim()} onClick={send}><Send className="h-4 w-4" /> Send</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
