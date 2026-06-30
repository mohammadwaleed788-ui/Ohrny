import { useCallback, useEffect, useMemo, useState } from 'react'
import { DollarSign, Filter, Heart, Plus, Send, Shield, Sparkles, X } from 'lucide-react'
import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'
import { apiGet, apiPatch, apiPost } from '../../services/apiClient'
import { connectAdminNotificationsSocket } from '../services/adminNotificationsSocket'

const REENGAGE_DEFAULT = [
  { id: 're-3', days: 3, title: 'You have 3 new likes 👀', body: 'People are checking you out — open the app to see who.', on: true },
  { id: 're-7', days: 7, title: 'We miss you 💛', body: "Your matches are still here. Come say hi before they cool off.", on: true },
  { id: 're-14', days: 14, title: 'Still looking for someone?', body: 'We found new people near you this week. Take a quick look.', on: true },
  { id: 're-30', days: 30, title: 'Your profile is going quiet 🌙', body: 'Reactivate now and get a free Boost to jump back to the top.', on: false },
]

const RULE_GROUPS = [
  {
    group: 'Matches & messages',
    icon: 'heart',
    rules: [
      {
        id: 'm-match',
        name: 'New match',
        trigger: 'When two users like each other',
        title: "It's a match! 🎉",
        body: 'You and Maya liked each other. Say hi!',
        channel: 'Push',
        on: true,
      },
      {
        id: 'm-msg',
        name: 'New message',
        trigger: 'When a match sends a message',
        title: 'New message from Jordan',
        body: "\"Hey! How's your week going?\"",
        channel: 'Push',
        on: true,
      },
      {
        id: 'm-like',
        name: 'New like',
        trigger: 'When someone likes the user',
        title: 'Someone likes you 💘',
        body: 'Open to see who liked your profile.',
        channel: 'Push',
        on: true,
      },
      {
        id: 'm-super',
        name: 'Super-like received',
        trigger: 'When the user gets a Super-like',
        title: 'You got a Super-like! ⭐',
        body: 'Someone really wants to match with you.',
        channel: 'Push',
        on: true,
      },
    ],
  },
  {
    group: 'Profile & verification',
    icon: 'shield',
    rules: [
      {
        id: 'p-complete',
        name: 'Complete your profile',
        trigger: 'Day 1 if profile <60% complete',
        title: 'Finish your profile',
        body: 'Profiles with 4+ photos get 2× more matches.',
        channel: 'Push',
        on: true,
      },
      {
        id: 'p-verify',
        name: 'Verify your selfie',
        trigger: 'When account is unverified 24h',
        title: 'Get the blue check ✓',
        body: 'Verify your selfie to build trust and get seen more.',
        channel: 'Push',
        on: true,
      },
      {
        id: 'p-photos',
        name: 'Add more photos',
        trigger: 'When profile has <3 photos',
        title: 'Add another photo 📸',
        body: 'More photos, more matches. Add one now.',
        channel: 'Push',
        on: false,
      },
    ],
  },
  {
    group: 'Activity nudges',
    icon: 'sparkle',
    rules: [
      {
        id: 'a-picks',
        name: 'Daily picks ready',
        trigger: "Every day at user's peak hour",
        title: "Today's picks are ready ✨",
        body: 'We curated new people just for you.',
        channel: 'Push',
        on: true,
      },
      {
        id: 'a-boost',
        name: 'Boost reminder',
        trigger: 'When a Boost goes live',
        title: 'Your Boost is live 🚀',
        body: "You're a top profile for the next 30 minutes.",
        channel: 'Push',
        on: false,
      },
      {
        id: 'a-recap',
        name: 'Weekly recap',
        trigger: 'Sundays at 6pm local',
        title: 'Your week on Ohrny',
        body: '12 likes, 4 matches, 28 profile views this week.',
        channel: 'Push',
        on: false,
      },
    ],
  },
  {
    group: 'Subscription & billing',
    icon: 'dollar',
    rules: [
      {
        id: 'sb-trial',
        name: 'Trial ending',
        trigger: '2 days before trial ends',
        title: 'Your Gold trial ends soon',
        body: 'Keep unlimited likes — your trial ends in 2 days.',
        channel: 'Push',
        on: true,
      },
      {
        id: 'sb-renew',
        name: 'Renewal confirmation',
        trigger: 'On successful renewal',
        title: 'Subscription renewed',
        body: 'Your Gold plan renewed. Thanks for staying with us!',
        channel: 'Email',
        on: true,
      },
      {
        id: 'sb-fail',
        name: 'Payment failed',
        trigger: 'When a charge fails',
        title: 'Payment issue',
        body: "We couldn't process your payment. Update it to keep Gold.",
        channel: 'Push',
        on: true,
      },
    ],
  },
]

const DELIVERY_SETTINGS_DEFAULT = [
  { id: 'quiet', title: 'Respect quiet hours', sub: "Never send between 10pm–8am in the user's local time", on: true },
  { id: 'cap', title: 'Frequency cap', sub: 'Max 3 push notifications per user per day', on: true },
]

const CHANNEL_CHIP = {
  Push: 'bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.78_0.18_25)]',
  Email: 'bg-[oklch(0.7_0.11_240_/_0.2)] text-[oklch(0.78_0.11_240)]',
  'In-app': 'bg-[oklch(0.3_0.01_260)] text-[oklch(0.82_0.01_260)]',
}

const SEG_FIELDS = ['Plan', 'Last active', 'Age', 'Gender', 'Location', 'Verified', 'Matches', 'Messages sent', 'Photos count']
const SEG_OPS = ['is', 'is not', 'more than', 'less than', 'contains', 'exists']
const GROUP_ICON = {
  heart: Heart,
  shield: Shield,
  sparkle: Sparkles,
  dollar: DollarSign,
}
const SHOW_OTHER_FRONTEND_ONLY_SECTIONS = false

function ToggleSwitch({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full border transition ${
        on ? 'border-[oklch(0.72_0.15_25)] bg-[oklch(0.72_0.15_25_/_0.4)]' : `border ${adminTokens.borderSoft} ${adminTokens.bgElev2}`
      }`}
      aria-pressed={on}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${on ? 'left-[22px]' : 'left-1'}`} />
    </button>
  )
}

function KpiCard({ label, value, delta, note }) {
  const positive = delta.startsWith('+')
  return (
    <div className={`rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.05em] ${adminTokens.textMute}`}>{label}</div>
      <div className={`mt-2 font-mono text-[26px] font-semibold ${adminTokens.text}`}>{value}</div>
      <div className={`mt-2 text-xs ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
        <span className="font-mono">{delta}</span>
        <span className={`ml-1 ${adminTokens.textMute}`}>{note}</span>
      </div>
    </div>
  )
}

function Panel({ title, subtitle, right, icon, children }) {
  return (
    <section className={`rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
      <header className={`flex items-center gap-3 border-b ${adminTokens.borderSoft} px-4 py-3`}>
        {icon ? <span className="grid h-7 w-7 place-items-center rounded-md bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.78_0.18_25)]">{icon}</span> : null}
        <div>
          <div className={`text-sm font-semibold ${adminTokens.text}`}>{title}</div>
          {subtitle ? <div className={`text-xs ${adminTokens.textMute}`}>{subtitle}</div> : null}
        </div>
        <div className="flex-1" />
        {right}
      </header>
      <div>{children}</div>
    </section>
  )
}

function PushPreview({ title, body, small = false }) {
  return (
    <div className={`flex gap-2.5 rounded-xl border ${adminTokens.borderSoft} ${small ? adminTokens.bgElev2 : 'bg-[oklch(0.15_0.01_260)]'} p-3`}>
      <div className={`grid ${small ? 'h-7 w-7 rounded-md' : 'h-10 w-10 rounded-lg'} place-items-center bg-gradient-to-br from-orange-300 to-orange-600 text-white`}>
        <Heart className={small ? 'h-3 w-3' : 'h-4 w-4'} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.09em] text-neutral-100">OHRNY</span>
          <span className={`text-[10px] ${adminTokens.textMute}`}>now</span>
        </div>
        <div className={`mt-1 truncate ${small ? 'text-xs' : 'text-[13px]'} font-semibold ${adminTokens.text}`}>{title || 'Notification title'}</div>
        <div className={`mt-0.5 ${small ? 'text-[11px]' : 'text-xs'} ${adminTokens.textDim}`}>{body || 'Message body goes here.'}</div>
      </div>
    </div>
  )
}

function SegmentModal({ onClose, onNext }) {
  const [name, setName] = useState('')
  const [matchMode, setMatchMode] = useState('all')
  const [conditions, setConditions] = useState([
    { id: 1, field: 'Plan', op: 'is', value: 'Free' },
    { id: 2, field: 'Last active', op: 'more than', value: '7 days' },
  ])
  const reach = 201603
  const total = 1142873
  const pct = Math.round((reach / total) * 100)

  const addCondition = () => setConditions((current) => [...current, { id: Date.now(), field: 'Plan', op: 'is', value: '' }])
  const removeCondition = (id) => setConditions((current) => current.filter((item) => item.id !== id))
  const updateCondition = (id, patch) =>
    setConditions((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
      <div className={`max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border ${adminTokens.borderStrong} ${adminTokens.bgElev} shadow-[0_38px_80px_-20px_rgba(0,0,0,0.9)]`}>
        <div className={`flex items-center gap-3 border-b ${adminTokens.borderSoft} px-5 py-4`}>
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.78_0.18_25)]">
            <Filter className="h-4 w-4" />
          </div>
          <div className={`font-semibold ${adminTokens.text}`}>Segment builder</div>
          <div className="flex-1" />
          <button type="button" className={`grid h-7 w-7 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} ${adminTokens.textDim}`} onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-120px)] space-y-5 overflow-y-auto p-5">
          <div>
            <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Segment name</div>
            <input value={name} onChange={(event) => setName(event.target.value)} className={`w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`} placeholder="e.g. Lapsed Gold - 14d" />
          </div>
          <div>
            <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Match</div>
            <div className="flex items-center gap-3">
              <div className={`inline-flex rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-1`}>
                {[
                  ['all', 'All conditions'],
                  ['any', 'Any condition'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMatchMode(id)}
                    className={`rounded px-3 py-1 text-xs ${matchMode === id ? `${adminTokens.bgElev} ${adminTokens.text}` : adminTokens.textDim}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className={`text-xs ${adminTokens.textMute}`}>{matchMode === 'all' ? 'AND - must meet every rule' : 'OR - must meet any rule'}</span>
            </div>
          </div>
          <div>
            <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Conditions</div>
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="flex items-center gap-2">
                  <span className={`w-12 text-right text-[10px] font-semibold uppercase tracking-[0.05em] ${adminTokens.textMute}`}>{index === 0 ? 'WHERE' : 'AND'}</span>
                  <select value={condition.field} onChange={(event) => updateCondition(condition.id, { field: event.target.value })} className={`min-w-0 flex-1 rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-2 text-xs ${adminTokens.text}`}>
                    {SEG_FIELDS.map((field) => (
                      <option key={field}>{field}</option>
                    ))}
                  </select>
                  <select value={condition.op} onChange={(event) => updateCondition(condition.id, { op: event.target.value })} className={`min-w-0 flex-1 rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-2 text-xs ${adminTokens.text}`}>
                    {SEG_OPS.map((op) => (
                      <option key={op}>{op}</option>
                    ))}
                  </select>
                  <input value={condition.value} onChange={(event) => updateCondition(condition.id, { value: event.target.value })} className={`min-w-0 flex-1 rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-2 text-xs ${adminTokens.text}`} />
                  <button type="button" className={`grid h-7 w-7 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} ${adminTokens.textDim}`} onClick={() => removeCondition(condition.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addCondition} className={`mt-3 inline-flex items-center gap-1 rounded-md border border-dashed ${adminTokens.borderSoft} px-3 py-1.5 text-xs ${adminTokens.textDim}`}>
              <Plus className="h-3 w-3" />
              Add condition
            </button>
          </div>
          <div className={`rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-4`}>
            <div className="mb-2 flex items-end justify-between">
              <div>
                <div className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Estimated reach</div>
                <div className="mt-1 h-0.5 w-14 bg-[oklch(0.72_0.15_25)]" />
              </div>
              <span className={`font-mono text-3xl font-semibold ${adminTokens.text}`}>{reach.toLocaleString()}</span>
            </div>
            <div className={`h-1.5 overflow-hidden rounded-full ${adminTokens.bgElev}`}>
              <div className="h-full rounded-full bg-[oklch(0.72_0.15_25)]" style={{ width: `${pct}%` }} />
            </div>
            <div className={`mt-2 text-xs ${adminTokens.textMute}`}>
              {pct}% of {total.toLocaleString()} monthly actives - estimate refreshes hourly
            </div>
          </div>
        </div>
        <div className={`flex items-center justify-between border-t ${adminTokens.borderSoft} px-5 py-3`}>
          <button type="button" className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-1.5 text-sm ${adminTokens.text}`} onClick={onClose}>
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-1.5 text-sm ${adminTokens.text}`} onClick={onClose}>
              Save segment
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => {
                onClose()
                if (onNext) onNext()
              }}
            >
              <Send className="h-3.5 w-3.5" />
              Save & create campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CampaignModal({ onClose, onSubmit, submitting }) {
  const [name, setName] = useState('')
  const [channel, setChannel] = useState('Push')
  const [audience, setAudience] = useState('Active · 7d inactive')
  const [title, setTitle] = useState('You have 3 new matches ✨')
  const [message, setMessage] = useState('Open to see who liked you back — two of them messaged you.')
  const [deeplink, setDeeplink] = useState('ohrny://matches')
  const [delivery, setDelivery] = useState('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const segmentOptions = ['Active · 7d inactive', 'Gold subscribers', 'Free · 14d inactive', 'All active', 'New this week']

  const submit = async (mode) => {
    if (!onSubmit || submitting) return
    if (mode === 'schedule' && !scheduledFor) return
    await onSubmit({
      name,
      title,
      body: message,
      deeplink,
      channel,
      audienceType: 'all_users',
      deliveryMode: mode,
      scheduledAt: mode === 'schedule' ? new Date(scheduledFor).toISOString() : null,
      audienceLabel: audience,
    })
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
      <div className={`max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl border ${adminTokens.borderStrong} ${adminTokens.bgElev} shadow-[0_38px_80px_-20px_rgba(0,0,0,0.9)]`}>
        <div className={`flex items-center gap-3 border-b ${adminTokens.borderSoft} px-5 py-3`}>
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.78_0.18_25)]">
            <Send className="h-3.5 w-3.5" />
          </div>
          <div className={`font-semibold ${adminTokens.text}`}>New campaign</div>
          <div className="flex-1" />
          <button type="button" className={`grid h-7 w-7 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} ${adminTokens.textDim}`} onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid max-h-[calc(92vh-116px)] min-h-[540px] grid-cols-1 overflow-hidden md:grid-cols-[1fr_310px]">
          <div className={`space-y-4 overflow-y-auto border-r ${adminTokens.borderSoft} p-5`}>
            <div>
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Campaign name</div>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weekend Boost" className={`w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`} />
            </div>
            <div>
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Channel</div>
              <div className={`inline-flex rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-1`}>
                {['Push', 'Email', 'In-app'].map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setChannel(entry)}
                    className={`rounded px-3 py-1 text-xs ${channel === entry ? `${adminTokens.bgElev} ${adminTokens.text}` : adminTokens.textDim}`}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Audience</div>
              <select value={audience} onChange={(event) => setAudience(event.target.value)} className={`w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}>
                {segmentOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.72_0.15_25_/_0.18)] px-2 py-0.5 text-[11px] text-[oklch(0.78_0.18_25)]">
                  <Sparkles className="h-3 w-3" />
                  412,908 recipients
                </span>
                <span className={`text-[11px] ${adminTokens.textMute}`}>after quiet-hours and frequency caps</span>
              </div>
            </div>
            <div>
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Title</div>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} className={`w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`} />
            </div>
            <div>
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Message</div>
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 160))}
                  className={`min-h-24 w-full resize-y rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 pr-14 text-sm ${adminTokens.text}`}
                />
                <span className={`pointer-events-none absolute bottom-2 right-2 font-mono text-[10px] ${adminTokens.textMute}`}>{message.length}/160</span>
              </div>
            </div>
            <div>
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Deeplink</div>
              <input value={deeplink} onChange={(event) => setDeeplink(event.target.value)} className={`w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 font-mono text-sm ${adminTokens.text}`} />
            </div>
            <div>
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Delivery</div>
              <div className="space-y-2">
                {[
                  ['now', 'Send now'],
                  ['schedule', 'Schedule'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDelivery(id)}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      delivery === id
                        ? 'border-[oklch(0.72_0.15_25)] bg-[oklch(0.72_0.15_25_/_0.14)] text-[oklch(0.85_0.06_25)]'
                        : `${adminTokens.borderSoft} ${adminTokens.bgElev2} ${adminTokens.textDim}`
                    }`}
                  >
                    <span className={`grid h-4 w-4 place-items-center rounded-full border ${delivery === id ? 'border-[oklch(0.72_0.15_25)]' : adminTokens.borderSoft}`}>
                      {delivery === id ? <span className="h-2 w-2 rounded-full bg-[oklch(0.72_0.15_25)]" /> : null}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
              {delivery === 'schedule' ? (
                <input
                  type="datetime-local"
                  className={`mt-2 w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                />
              ) : null}
            </div>
          </div>
          <aside className="space-y-3 overflow-y-auto bg-[oklch(0.175_0.009_260)] p-5">
            <div className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Preview</div>
            <PushPreview title={title} body={message} />
            <div className={`overflow-hidden rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2}`}>
              {[
                ['Channel', channel],
                ['Deeplink', deeplink],
                ['When', delivery === 'now' ? 'Immediately' : 'Scheduled'],
                ['A/B test', '2 variants'],
              ].map(([k, v]) => (
                <div key={k} className={`flex items-center justify-between border-b ${adminTokens.borderSoft} px-3 py-2 text-xs last:border-b-0`}>
                  <span className={adminTokens.textMute}>{k}</span>
                  <span className={`${k === 'Deeplink' ? 'font-mono' : ''} max-w-36 truncate ${adminTokens.text}`}>{v}</span>
                </div>
              ))}
            </div>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Push preview</div>
            <PushPreview title={title} body={message} small />
          </aside>
        </div>
        <div className={`flex items-center justify-between border-t ${adminTokens.borderSoft} px-5 py-3`}>
          <button type="button" className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-1.5 text-sm ${adminTokens.text}`} onClick={onClose}>
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button type="button" disabled={submitting} className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-1.5 text-sm ${adminTokens.text}`} onClick={() => submit('draft')}>
              Save as draft
            </button>
            <button
              type="button"
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => submit(delivery === 'schedule' ? 'schedule' : 'now')}
            >
              <Send className="h-3.5 w-3.5" />
              {delivery === 'schedule' ? 'Schedule campaign' : 'Send campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const [reengage, setReengage] = useState(REENGAGE_DEFAULT)
  const [groups, setGroups] = useState(RULE_GROUPS)
  const [deliverySettings, setDeliverySettings] = useState(DELIVERY_SETTINGS_DEFAULT)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [summary, setSummary] = useState({ byStatus: {}, totals: { campaigns: 0, sent: 0, failed: 0 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submittingCampaign, setSubmittingCampaign] = useState(false)

  const allRules = useMemo(() => [...reengage, ...groups.flatMap((group) => group.rules)], [groups, reengage])
  const activeCount = useMemo(() => allRules.filter((rule) => rule.on).length, [allRules])

  const mergeReengagementRule = useCallback((ruleId, patch) => {
    setReengage((current) => current.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)))
  }, [])

  const updateReengage = useCallback(async (ruleId, apiPatchBody, optimisticPatch) => {
    const previous = reengage
    mergeReengagementRule(ruleId, optimisticPatch)
    try {
      const result = await apiPatch(`/admin/notifications/reengagement/rules/${ruleId}`, apiPatchBody)
      const saved = result?.rule
      if (saved) {
        mergeReengagementRule(ruleId, {
          title: saved.title,
          body: saved.body,
          days: saved.inactiveDays,
          on: saved.isEnabled,
          deeplink: saved.deeplink,
        })
      }
    } catch (err) {
      setReengage(previous)
      setError(err?.message || 'Failed to update re-engagement rule')
    }
  }, [mergeReengagementRule, reengage])
  const updateRule = (groupIndex, id, patch) =>
    setGroups((current) =>
      current.map((group, index) =>
        index !== groupIndex ? group : { ...group, rules: group.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) },
      ),
    )
  const updateDelivery = (id, patch) =>
    setDeliverySettings((current) => current.map((setting) => (setting.id === id ? { ...setting, ...patch } : setting)))

  const upsertCampaign = useCallback((campaignId, patch) => {
    setCampaigns((current) => {
      const index = current.findIndex((item) => item.id === campaignId)
      if (index === -1) return current
      const next = [...current]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryResult, campaignsResult, rulesResult] = await Promise.all([
        apiGet('/admin/notifications/summary'),
        apiGet('/admin/notifications/campaigns?limit=50'),
        apiGet('/admin/notifications/reengagement/rules'),
      ])
      setSummary(summaryResult || { byStatus: {}, totals: { campaigns: 0, sent: 0, failed: 0 } })
      setCampaigns(campaignsResult?.campaigns || [])
      if (Array.isArray(rulesResult?.rules)) {
        setReengage(
          rulesResult.rules.map((rule) => ({
            id: rule.id,
            title: rule.title,
            body: rule.body,
            days: Number(rule.inactiveDays || 7),
            on: Boolean(rule.isEnabled),
            deeplink: rule.deeplink || '',
          })),
        )
      }
    } catch (err) {
      setError(err?.message || 'Failed to load notification campaigns')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      loadData()
    }, 0)
    return () => clearTimeout(id)
  }, [loadData])

  useEffect(() => {
    const disconnect = connectAdminNotificationsSocket({
      onAnyCampaignEvent: (_event, payload) => {
        if (!payload?.campaignId) return
        const patch = {}
        if (payload.status) patch.status = payload.status
        if (typeof payload.sent === 'number') patch.totalSent = payload.sent
        if (typeof payload.failed === 'number') patch.totalFailed = payload.failed
        upsertCampaign(payload.campaignId, patch)
      },
    })
    return () => {
      disconnect()
    }
  }, [upsertCampaign])

  const submitCampaign = async (payload) => {
    setSubmittingCampaign(true)
    try {
      await apiPost('/admin/notifications/campaigns', payload)
      setCampaignOpen(false)
      await loadData()
    } catch (err) {
      setError(err?.message || 'Failed to create campaign')
    } finally {
      setSubmittingCampaign(false)
    }
  }

  const triggerSendNow = async (campaignId) => {
    try {
      await apiPost(`/admin/notifications/campaigns/${campaignId}/send-now`, {})
      upsertCampaign(campaignId, { status: 'queued' })
    } catch (err) {
      setError(err?.message || 'Failed to queue send')
    }
  }

  const cancelCampaign = async (campaignId) => {
    try {
      await apiPost(`/admin/notifications/campaigns/${campaignId}/cancel`, {})
      upsertCampaign(campaignId, { status: 'cancelled' })
    } catch (err) {
      setError(err?.message || 'Failed to cancel campaign')
    }
  }

  return (
    <div className="space-y-[14px]">
      <PageHead
        title="Notifications & campaigns"
        sub="Push, email, and in-app · automated rules + one-off campaigns"
        actions={
          <>
            {SHOW_OTHER_FRONTEND_ONLY_SECTIONS ? (
              <button type="button" className={`inline-flex items-center gap-1.5 rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-1.5 text-xs ${adminTokens.text}`} onClick={() => setSegmentOpen(true)}>
                <Filter className="h-3.5 w-3.5" />
                Segment builder
              </button>
            ) : null}
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setCampaignOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New campaign
            </button>
          </>
        }
      />

      <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Campaigns" value={String(summary?.totals?.campaigns || 0)} delta="+0" note="all statuses" />
        <KpiCard label="Push sent" value={String(summary?.totals?.sent || 0)} delta="+0" note="all campaigns" />
        <KpiCard label="Failed sends" value={String(summary?.totals?.failed || 0)} delta="+0" note="delivery errors" />
        <KpiCard label="Scheduled" value={String(summary?.byStatus?.scheduled || 0)} delta="+0" note="queued for future" />
      </div>

      <Panel title="Campaigns" right={<span className={`text-xs ${adminTokens.textMute}`}>{campaigns.length} loaded</span>}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className={`border-b ${adminTokens.borderSoft} ${adminTokens.textMute}`}>
                <th className="px-4 py-2 text-left font-medium">Campaign</th>
                <th className="px-4 py-2 text-left font-medium">Channel</th>
                <th className="px-4 py-2 text-left font-medium">Audience</th>
                <th className="px-4 py-2 text-right font-medium">Sent</th>
                <th className="px-4 py-2 text-right font-medium">Failed</th>
                <th className="px-4 py-2 text-right font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">When</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className={`border-b ${adminTokens.borderSoft} last:border-b-0`}>
                  <td className="px-4 py-3">
                    <div className={`font-medium ${adminTokens.text}`}>{campaign.name}</div>
                    <div className={`font-mono text-[11px] ${adminTokens.textMute}`}>{campaign.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHANNEL_CHIP[campaign.channel] || CHANNEL_CHIP.Push}`}>{campaign.channel || 'Push'}</span>
                  </td>
                  <td className={`px-4 py-3 ${adminTokens.textDim}`}>{campaign.audienceType || 'all_users'}</td>
                  <td className={`px-4 py-3 text-right font-mono ${adminTokens.text}`}>{campaign.totalSent || 0}</td>
                  <td className={`px-4 py-3 text-right font-mono ${adminTokens.text}`}>{campaign.totalFailed || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${campaign.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : campaign.status === 'failed' ? 'bg-red-500/20 text-red-300' : campaign.status === 'scheduled' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-500/20 text-slate-300'}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${adminTokens.textMute}`}>{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : (campaign.sentAt ? new Date(campaign.sentAt).toLocaleString() : '—')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {(campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'failed') ? (
                        <button type="button" className={`rounded border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-1 text-xs ${adminTokens.text}`} onClick={() => triggerSendNow(campaign.id)}>
                          Send now
                        </button>
                      ) : null}
                      {(campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'queued') ? (
                        <button type="button" className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300" onClick={() => cancelCampaign(campaign.id)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`px-4 py-6 text-center text-sm ${adminTokens.textMute}`}>No campaigns yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
      {error ? (
        <div className="rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
      ) : null}

      <Panel
        title="Re-engagement reminders"
        subtitle="Automatically nudge users who have not opened the app in a while"
        icon={<Heart className="h-4 w-4" />}
      >
        <div className="space-y-2 p-4">
          {reengage.map((rule) => (
            <div key={rule.id} className={`flex flex-wrap items-center gap-3 rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-3 ${rule.on ? '' : 'opacity-50'}`}>
              <ToggleSwitch
                on={rule.on}
                onClick={() => updateReengage(rule.id, { isEnabled: !rule.on }, { on: !rule.on })}
              />
              <div className="w-[132px]">
                <div className={`text-[11px] ${adminTokens.textMute}`}>Inactive for</div>
                <div className={`mt-1 inline-flex items-center overflow-hidden rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
                  <button
                    type="button"
                    disabled={!rule.on}
                    className={`grid h-7 w-7 place-items-center text-base ${adminTokens.textDim} disabled:opacity-40`}
                    onClick={() => updateReengage(rule.id, { inactiveDays: Math.max(1, rule.days - 1) }, { days: Math.max(1, rule.days - 1) })}
                  >
                    -
                  </button>
                  <span className={`min-w-11 px-2 text-center font-mono text-sm ${adminTokens.text}`}>
                    {rule.days}
                    <small className={`ml-0.5 text-[10px] ${adminTokens.textMute}`}>d</small>
                  </span>
                  <button
                    type="button"
                    disabled={!rule.on}
                    className={`grid h-7 w-7 place-items-center text-base ${adminTokens.textDim} disabled:opacity-40`}
                    onClick={() => updateReengage(rule.id, { inactiveDays: Math.min(180, rule.days + 1) }, { days: Math.min(180, rule.days + 1) })}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="min-w-[220px] flex-1 border-l border-[oklch(0.28_0.01_260)] pl-3">
                <div className={`text-[13px] font-semibold ${adminTokens.text}`}>{rule.title}</div>
                <div className={`text-[12px] ${adminTokens.textDim}`}>{rule.body}</div>
              </div>
              <span className="rounded-full bg-[oklch(0.72_0.15_25_/_0.18)] px-2 py-0.5 text-[11px] text-[oklch(0.78_0.18_25)]">Push</span>
            </div>
          ))}
        </div>
      </Panel>

      {SHOW_OTHER_FRONTEND_ONLY_SECTIONS ? (
        <>
          {groups.map((group, groupIndex) => {
            const Icon = GROUP_ICON[group.icon] || Sparkles
            const enabledCount = group.rules.filter((rule) => rule.on).length
            return (
              <Panel
                key={group.group}
                title={group.group}
                icon={<Icon className="h-4 w-4" />}
                right={<span className={`text-xs ${adminTokens.textMute}`}>{enabledCount}/{group.rules.length} on</span>}
              >
                <div>
                  {group.rules.map((rule) => (
                    <div key={rule.id} className={`flex flex-wrap items-center gap-3 border-b ${adminTokens.borderSoft} px-4 py-3 last:border-b-0 ${rule.on ? '' : 'opacity-50'}`}>
                      <ToggleSwitch on={rule.on} onClick={() => updateRule(groupIndex, rule.id, { on: !rule.on })} />
                      <div className="w-[200px]">
                        <div className={`text-[13px] font-semibold ${adminTokens.text}`}>{rule.name}</div>
                        <div className={`flex items-center gap-1 text-[11px] ${adminTokens.textMute}`}>
                          <Sparkles className="h-3 w-3" />
                          {rule.trigger}
                        </div>
                      </div>
                      <div className="min-w-[220px] flex-1 border-l border-[oklch(0.28_0.01_260)] pl-3">
                        <div className={`text-[13px] font-semibold ${adminTokens.text}`}>{rule.title}</div>
                        <div className={`truncate text-[12px] ${adminTokens.textDim}`}>{rule.body}</div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${CHANNEL_CHIP[rule.channel] || ''}`}>{rule.channel}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )
          })}

          <Panel
            title="Global delivery settings"
            right={<span className={`text-xs ${adminTokens.textMute}`}>Applied to every rule above</span>}
          >
            {deliverySettings.map((setting, index) => (
              <div key={setting.id} className={`flex items-center justify-between px-4 py-4 ${index < deliverySettings.length - 1 ? `border-b ${adminTokens.borderSoft}` : ''}`}>
                <div>
                  <div className={`text-sm font-semibold ${adminTokens.text}`}>{setting.title}</div>
                  <div className={`text-xs ${adminTokens.textMute}`}>{setting.sub}</div>
                </div>
                <ToggleSwitch on={setting.on} onClick={() => updateDelivery(setting.id, { on: !setting.on })} />
              </div>
            ))}
          </Panel>

          <div className={`rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-3 text-xs ${adminTokens.textMute}`}>
            Active rules: <span className={`font-mono ${adminTokens.text}`}>{activeCount}</span> / {allRules.length}
          </div>
        </>
      ) : (
        <div className={`rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-3 text-xs ${adminTokens.textMute}`}>
          Automated rules and global settings are hidden in this phase.
        </div>
      )}

      {campaignOpen ? <CampaignModal onClose={() => setCampaignOpen(false)} onSubmit={submitCampaign} submitting={submittingCampaign} /> : null}
      {segmentOpen ? (
        <SegmentModal
          onClose={() => setSegmentOpen(false)}
          onNext={() => {
            setCampaignOpen(true)
          }}
        />
      ) : null}
    </div>
  )
}

