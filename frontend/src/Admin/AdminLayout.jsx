import { useState } from 'react'
import { AdminSidebar } from './components/AdminSidebar'
import { AdminTopbar } from './components/AdminTopbar'
import { adminTokens } from './theme/tokens'

export function AdminLayout({
  children,
  route = 'overview',
  crumbs = ['Ohrny admin', 'Overview'],
  anon = true,
  onToggleAnon = () => {},
  onRouteChange = () => {},
  onSignOut = () => {},
  badgeOverrides = {},
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`min-h-screen ${adminTokens.bg} ${adminTokens.text}`}>
      <div className={`grid min-h-screen ${collapsed ? 'grid-cols-[72px_1fr]' : 'grid-cols-[240px_1fr]'}`}>
        <AdminSidebar
          route={route}
          onRouteChange={onRouteChange}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          badgeOverrides={badgeOverrides}
        />
        <main className={`min-w-0 ${adminTokens.bg}`}>
          <AdminTopbar crumbs={crumbs} anon={anon} onToggleAnon={onToggleAnon} onSignOut={onSignOut} />
          <section className="mx-auto max-w-[1500px] px-7 py-6">{children}</section>
        </main>
      </div>
    </div>
  )
}

