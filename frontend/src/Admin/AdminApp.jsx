import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { AdminLayout } from './AdminLayout'
import { routeCrumbs } from './config/adminNavigation'
import { adminHasTab, firstAllowedTab } from './config/adminPermissions'
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

function NoAccessPage() {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
      You do not have access to any admin sections. Contact your super admin.
    </div>
  )
}

export default function AdminApp() {
  const navigate = useNavigate()
  const { admin, logout } = useAuth()
  const [route, setRoute] = useState('overview')
  const [anon, setAnon] = useState(true)
  const [badgeOverrides, setBadgeOverrides] = useState({})

  const crumbs = useMemo(() => ['Ohrny admin', ...(routeCrumbs[route] ?? [route])], [route])
  const ActivePage = PAGE_COMPONENTS[route]
  const hasRouteAccess = adminHasTab(admin, route)

  useEffect(() => {
    if (!admin?.tabs?.length) return
    if (!adminHasTab(admin, route)) {
      setRoute(firstAllowedTab(admin))
    }
  }, [admin, route])

  const handleSignOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const refreshSidebarBadges = useCallback(async () => {
    try {
      const requests = []
      if (adminHasTab(admin, 'overview')) {
        requests.push(apiGet('/admin/overview?range=7d').then((result) => ({ type: 'overview', result })))
      }
      if (adminHasTab(admin, 'support')) {
        requests.push(apiGet('/admin/support/summary').then((result) => ({ type: 'support', result })))
      }
      if (!requests.length) return

      const results = await Promise.all(requests)
      setBadgeOverrides((current) => {
        const next = { ...current }
        for (const entry of results) {
          if (entry.type === 'overview') {
            const openReportsRaw = String(entry.result?.kpis?.openReports?.v || '').replace(/,/g, '')
            const openReports = Number.parseInt(openReportsRaw, 10)
            if (Number.isFinite(openReports)) next.trust = String(openReports)
          }
          if (entry.type === 'support') {
            const openTickets = Number.parseInt(String(entry.result?.openTickets || '0'), 10)
            if (Number.isFinite(openTickets)) next.support = String(openTickets)
          }
        }
        return next
      })
    } catch (err) {
      console.error('Sidebar badge refresh failed:', err)
    }
  }, [admin])

  useEffect(() => {
    if (!admin) return undefined
    const startupId = setTimeout(() => {
      refreshSidebarBadges()
    }, 0)
    const id = setInterval(refreshSidebarBadges, 30000)
    return () => {
      clearTimeout(startupId)
      clearInterval(id)
    }
  }, [admin, refreshSidebarBadges])

  return (
    <AdminLayout
      admin={admin}
      route={route}
      crumbs={crumbs}
      anon={anon}
      onToggleAnon={() => setAnon((value) => !value)}
      onRouteChange={setRoute}
      onSignOut={handleSignOut}
      badgeOverrides={badgeOverrides}
    >
      {!admin?.tabs?.length ? (
        <NoAccessPage />
      ) : hasRouteAccess && ActivePage ? (
        <ActivePage />
      ) : hasRouteAccess ? (
        <FallbackPage route={route} />
      ) : (
        <NoAccessPage />
      )}
    </AdminLayout>
  )
}
