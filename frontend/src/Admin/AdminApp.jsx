import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { AdminLayout } from './AdminLayout'
import { routeCrumbs } from './config/adminNavigation'
import { apiGet } from '../services/apiClient'
import {
  AlgorithmPage,
  ExperimentsPage,
  MatchesPage,
  ModerationPage,
  NotificationsPage,
  OverviewPage,
  PlansPage,
  RevenuePage,
  SupportPage,
  TeamPage,
  TrustPage,
  UsersPage,
} from './pages'

const PAGE_COMPONENTS = {
  overview: OverviewPage,
  matches: MatchesPage,
  revenue: RevenuePage,
  experiments: ExperimentsPage,
  users: UsersPage,
  trust: TrustPage,
  moderation: ModerationPage,
  support: SupportPage,
  notifications: NotificationsPage,
  algorithm: AlgorithmPage,
  plans: PlansPage,
  team: TeamPage,
}

function FallbackPage({ route }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
      <span className="font-medium text-neutral-100">{route}</span> page is not created yet.
    </div>
  )
}

export default function AdminApp() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [route, setRoute] = useState('overview')
  const [anon, setAnon] = useState(true)
  const [badgeOverrides, setBadgeOverrides] = useState({})

  const crumbs = useMemo(() => ['Ohrny admin', ...(routeCrumbs[route] ?? [route])], [route])
  const ActivePage = PAGE_COMPONENTS[route]

  const handleSignOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const refreshSidebarBadges = useCallback(async () => {
    try {
      const [overviewResult, supportResult] = await Promise.all([
        apiGet('/admin/overview?range=7d'),
        apiGet('/admin/support/summary'),
      ])
      const openReportsRaw = String(overviewResult?.kpis?.openReports?.v || '').replace(/,/g, '')
      const openReports = Number.parseInt(openReportsRaw, 10)
      const openTickets = Number.parseInt(String(supportResult?.openTickets || '0'), 10)
      setBadgeOverrides((current) => ({
        ...current,
        ...(Number.isFinite(openReports) ? { trust: String(openReports) } : {}),
        ...(Number.isFinite(openTickets) ? { support: String(openTickets) } : {}),
      }))
    } catch (err) {
      console.error('Sidebar badge refresh failed:', err)
    }
  }, [])

  useEffect(() => {
    const startupId = setTimeout(() => {
      refreshSidebarBadges()
    }, 0)
    const id = setInterval(refreshSidebarBadges, 30000)
    return () => {
      clearTimeout(startupId)
      clearInterval(id)
    }
  }, [refreshSidebarBadges])

  return (
    <AdminLayout
      route={route}
      crumbs={crumbs}
      anon={anon}
      onToggleAnon={() => setAnon((value) => !value)}
      onRouteChange={setRoute}
      onSignOut={handleSignOut}
      badgeOverrides={badgeOverrides}
    >
      {ActivePage ? <ActivePage /> : <FallbackPage route={route} />}
    </AdminLayout>
  )
}
