import { Plus } from 'lucide-react'
import { Button, StatusDot } from '../ui/operatedStyles.jsx'
import { avatarGradient, op } from '../theme/operatedTheme.js'

export function PersonaRail({ personas, selectedId, unreadByPersona, search, onSearchChange, onSelect, onNew }) {
  const filtered = personas.filter((persona) => {
    const query = search.trim().toLowerCase()
    return !query || persona.name.toLowerCase().includes(query) || persona.city.toLowerCase().includes(query)
  })
  const activeCount = personas.filter((persona) => persona.status === 'active').length
  const totalUnread = Object.values(unreadByPersona).reduce((sum, value) => sum + value, 0)

  return (
    <aside className={`grid min-h-0 grid-rows-[auto_auto_1fr_auto] border-r ${op.borderSoft} bg-[oklch(0.13_0.008_260)]`}>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className={`flex-1 text-sm font-semibold ${op.text}`}>
          Personas <span className={`font-normal ${op.mute}`}>- {personas.length}</span>
        </div>
        <Button className="px-2 py-1 text-xs" onClick={onNew}>
          <Plus className="h-3 w-3" /> New
        </Button>
      </div>
      <div className="px-3 pb-3">
        <input
          className={`w-full rounded-md border ${op.borderSoft} ${op.bgElev} px-3 py-2 text-sm ${op.text} outline-none placeholder:${op.mute}`}
          placeholder="Search name, city..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className={`min-h-0 overflow-y-auto px-1.5 ${op.scrollbar}`}>
        {filtered.map((persona) => (
          <button
            key={persona.id}
            type="button"
            className={`relative mb-1 flex w-full items-center gap-3 rounded-md px-2 py-3 text-left ${selectedId === persona.id ? op.accentBg : `${op.hover}`}`}
            onClick={() => onSelect(persona.id)}
          >
            {selectedId === persona.id && <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[oklch(0.72_0.15_25)]" />}
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={avatarGradient(persona.hue)}>
              {persona.name.split(' ').map((part) => part[0]).join('')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <StatusDot status={persona.status} />
                <span className={`truncate text-sm font-semibold ${op.text}`}>{persona.name}</span>
                <span className={`text-xs ${op.mute}`}>{persona.age}</span>
              </span>
              <span className={`mt-0.5 block truncate font-mono text-[11px] ${op.mute}`}>{persona.city} - {persona.team}</span>
            </span>
            {unreadByPersona[persona.id] > 0 && (
              <span className="rounded-full bg-[oklch(0.76_0.18_25)] px-2 py-0.5 font-mono text-[10px] font-bold text-[oklch(0.18_0.04_25)]">
                {unreadByPersona[persona.id]}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={`border-t ${op.borderSoft} px-3 py-2 font-mono text-[11px] ${op.mute}`}>
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.14_155)]" /> {activeCount} active</span>
        <span className="mx-2">-</span>
        <span>{totalUnread.toLocaleString()} unread</span>
      </div>
    </aside>
  )
}
