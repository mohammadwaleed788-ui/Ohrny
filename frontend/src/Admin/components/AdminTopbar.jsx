import { Ban, Bell, Search, Shield } from 'lucide-react'
import { adminTokens } from '../theme/tokens'

export function AdminTopbar({
  crumbs = ['Ohrny admin', 'Overview'],
  anon = true,
  onToggleAnon = () => {},
  onSignOut = () => {},
}) {
  return (
    <header className={`sticky top-0 z-10 flex h-14 items-center gap-3 border-b ${adminTokens.borderSoft} ${adminTokens.bg} px-5`}>
      <div className={`flex items-center gap-1 text-sm font-medium ${adminTokens.textDim}`}>
        {crumbs.map((crumb, index) => (
          <span key={`${crumb}-${index}`}>
            {index > 0 && <span className={`px-1 ${adminTokens.textMute}`}>/</span>}
            {index === crumbs.length - 1 ? <b className={`font-semibold ${adminTokens.text}`}>{crumb}</b> : crumb}
          </span>
        ))}
      </div>

      <span className="rounded border border-[oklch(0.82_0.14_80_/_0.3)] bg-[oklch(0.82_0.14_80_/_0.14)] px-2 py-0.5 font-mono text-[11px] text-[oklch(0.82_0.14_80)]">
        production · us-east-1
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-2.5 py-1 text-xs ${adminTokens.textDim} hover:bg-[oklch(0.26_0.014_260)]`}
          onClick={onToggleAnon}
        >
          <Shield className="h-3.5 w-3.5" />
          {anon ? 'Anon · on' : 'Anon · off'}
        </button>

        <div className={`flex min-w-[320px] items-center gap-2 rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-3 py-1.5 ${adminTokens.textDim}`}>
          <Search className="h-4 w-4" />
          <input
            className={`w-full bg-transparent text-sm ${adminTokens.text} outline-none placeholder:text-[oklch(0.55_0.01_260)]`}
            placeholder="Search users, reports, tickets, IDs..."
          />
          <kbd className="rounded border border-[oklch(0.26_0.01_260)] bg-[oklch(0.235_0.012_260)] px-1.5 py-0.5 font-mono text-[10px] text-[oklch(0.55_0.01_260)]">⌘K</kbd>
        </div>
        <button
          type="button"
          className={`relative grid h-8 w-8 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev} ${adminTokens.textDim} hover:bg-[oklch(0.26_0.014_260)]`}
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-400" />
        </button>
        <button
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev} ${adminTokens.textDim} hover:bg-[oklch(0.26_0.014_260)]`}
          title="Sign out"
          onClick={onSignOut}
        >
          <Ban className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

