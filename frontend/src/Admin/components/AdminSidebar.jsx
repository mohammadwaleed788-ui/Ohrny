import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Flag,
  FlaskConical,
  Heart,
  LayoutDashboard,
  Send,
  Shield,
  SlidersHorizontal,
  Tickets,
  Users,
} from 'lucide-react'
import { adminTokens } from '../theme/tokens'

const NAV = [
  {
    group: 'Analytics',
    items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' },
      { id: 'matches', label: 'Matches', icon: 'heart' },
      { id: 'revenue', label: 'Revenue', icon: 'dollar' },
      { id: 'experiments', label: 'Experiments', icon: 'flask', badge: '4' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'users', label: 'Users', icon: 'users' },
      { id: 'trust', label: 'Trust & Safety', icon: 'shield', badge: '342', hot: true },
      { id: 'moderation', label: 'Content review', icon: 'flag', badge: '87' },
      { id: 'support', label: 'Support', icon: 'tickets', badge: '29' },
    ],
  },
  {
    group: 'Product',
    items: [
      { id: 'notifications', label: 'Notifications', icon: 'send' },
      { id: 'algorithm', label: 'Algorithm', icon: 'sliders' },
      { id: 'plans', label: 'Plans & limits', icon: 'dollar' },
    ],
  },
  {
    group: 'Organization',
    items: [{ id: 'team', label: 'Team', icon: 'users' }],
  },
]

const ICONS = {
  dashboard: LayoutDashboard,
  heart: Heart,
  dollar: DollarSign,
  flask: FlaskConical,
  users: Users,
  shield: Shield,
  flag: Flag,
  tickets: Tickets,
  send: Send,
  sliders: SlidersHorizontal,
}

function WorkspaceSwitcher({ collapsed }) {
  const [open, setOpen] = useState(false)
  const switcherRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!switcherRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const openOperatedProfiles = () => {
    setOpen(false)
    window.open('/admin/operated-profiles', 'ohrny-operated-profiles', 'width=1440,height=920,noopener,noreferrer')
  }

  return (
    <div ref={switcherRef} className={`relative border-b ${adminTokens.borderSoft} px-3 py-3`}>
      <button
        type="button"
        className={`flex w-full items-center gap-2 rounded-md px-1 py-1 text-left ${collapsed ? 'justify-center' : ''} hover:bg-[oklch(0.235_0.012_260)]`}
        onClick={() => !collapsed && setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Switch workspace"
      >
        <div className="relative h-7 w-7 shrink-0 rounded-md bg-gradient-to-br from-orange-300 to-orange-600 shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)]">
          <span className="absolute inset-[7px] rounded-[4px] bg-[radial-gradient(circle_at_70%_60%,transparent_54%,oklch(0.42_0.12_25)_58%)] opacity-60 mix-blend-overlay" />
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-semibold ${adminTokens.text}`}>Ohrny admin</div>
              <div className={`truncate font-mono text-[11px] ${adminTokens.textMute}`}>switch workspace</div>
            </div>
            <ChevronDown className={`h-3 w-3 ${adminTokens.textMute}`} />
          </>
        )}
      </button>

      {!collapsed && open && (
        <div
          className={`absolute left-3 right-3 top-[calc(100%+8px)] z-30 rounded-lg border ${adminTokens.borderStrong} ${adminTokens.bgElev} p-2 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.9)]`}
          role="menu"
        >
          <div className={`px-2 pb-2 pt-1 text-[10px] uppercase tracking-[0.18em] ${adminTokens.textMute}`}>Workspaces</div>
          <button
            type="button"
            className={`flex w-full items-center gap-2 rounded-md bg-[oklch(0.72_0.15_25_/_0.11)] px-2 py-2 text-left ${adminTokens.text}`}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[oklch(0.48_0.12_260)] text-[oklch(0.86_0.04_260)]">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">Admin console</span>
              <span className={`block truncate text-xs ${adminTokens.textMute}`}>Analytics - ops - users - trust</span>
            </span>
            <Check className="h-3.5 w-3.5 shrink-0 text-[oklch(0.86_0.04_260)]" />
          </button>
          <button
            type="button"
            className={`mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${adminTokens.textDim} hover:bg-[oklch(0.26_0.014_260)] hover:text-[oklch(0.96_0.005_260)]`}
            role="menuitem"
            onClick={openOperatedProfiles}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-red-300 to-red-600 text-white">
              <Heart className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">Operated profiles</span>
              <span className={`block truncate text-xs ${adminTokens.textMute}`}>Company personas - engage with users</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </button>
          <div className={`mt-2 border-t ${adminTokens.borderSoft} px-2 pt-2 font-mono text-[11px] ${adminTokens.textMute}`}>
            Opens in a new window
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminSidebar({
  route = 'overview',
  onRouteChange = () => {},
  collapsed = false,
  onToggleCollapse = () => {},
}) {
  return (
    <aside className={`sticky top-0 flex h-screen flex-col border-r ${adminTokens.borderSoft} bg-[oklch(0.155_0.008_260)]`}>
      <WorkspaceSwitcher collapsed={collapsed} />

      <nav className={`flex-1 overflow-y-auto px-2 py-2 ${adminTokens.scrollbar}`}>
        {NAV.map((group) => (
          <div key={group.group} className="mb-2">
            {!collapsed && <div className={`px-2 py-2 text-[10px] uppercase tracking-[0.14em] ${adminTokens.textMute}`}>{group.group}</div>}
            {group.items.map((item) => {
              const IconComp = ICONS[item.icon] || LayoutDashboard
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm ${
                    route === item.id
                      ? `${adminTokens.accentBg} ${adminTokens.text}`
                      : `${adminTokens.textDim} hover:bg-[oklch(0.26_0.014_260)] hover:text-[oklch(0.96_0.005_260)]`
                  }`}
                  onClick={() => onRouteChange(item.id)}
                >
                  <span className={`${route === item.id ? adminTokens.accent : adminTokens.textMute}`}>
                    <IconComp className="h-4 w-4" />
                  </span>
                  {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${item.hot ? 'bg-[oklch(0.7_0.19_25_/_0.14)] text-[oklch(0.7_0.19_25)]' : 'bg-[oklch(0.235_0.012_260)] text-[oklch(0.72_0.01_260)]'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className={`flex items-center gap-2 border-t ${adminTokens.borderSoft} p-3`}>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-purple-500 text-xs font-semibold text-white">
          EM
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className={`truncate text-xs font-semibold ${adminTokens.text}`}>Elena M.</div>
            <div className={`truncate font-mono text-[11px] ${adminTokens.textMute}`}>founder - admin</div>
          </div>
        )}
        <button
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev} ${adminTokens.textDim} hover:bg-[oklch(0.26_0.014_260)]`}
          onClick={onToggleCollapse}
          title="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
