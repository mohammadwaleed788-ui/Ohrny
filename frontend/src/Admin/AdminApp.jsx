import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { AdminLayout } from './AdminLayout'
import { routeCrumbs } from './config/adminNavigation'
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

  const crumbs = useMemo(() => ['Ohrny admin', ...(routeCrumbs[route] ?? [route])], [route])
  const ActivePage = PAGE_COMPONENTS[route]

  const handleSignOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <AdminLayout
      route={route}
      crumbs={crumbs}
      anon={anon}
      onToggleAnon={() => setAnon((value) => !value)}
      onRouteChange={setRoute}
      onSignOut={handleSignOut}
    >
      {ActivePage ? <ActivePage /> : <FallbackPage route={route} />}
    </AdminLayout>
  )
}
