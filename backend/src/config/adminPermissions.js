export const ADMIN_TABS = [
  'overview',
  'matches',
  'revenue',
  'experiments',
  'users',
  'trust',
  'moderation',
  'support',
  'algorithm',
  'notifications',
  'plans',
  'team',
]

export const TEAM_MANAGEMENT_TAB = 'team'

export const ROLE_PRESETS = {
  admin: {
    label: 'Admin',
    description: 'Full product access, manage team',
    defaultTabs: ADMIN_TABS.filter((tab) => tab !== TEAM_MANAGEMENT_TAB),
    backendRole: 'moderator',
  },
  moderator: {
    label: 'Moderator',
    description: 'Trust & Safety + content review',
    defaultTabs: ['overview', 'trust', 'moderation'],
    backendRole: 'moderator',
  },
  support: {
    label: 'Support',
    description: 'Tickets, user detail, refunds (capped)',
    defaultTabs: ['overview', 'users', 'support'],
    backendRole: 'support',
  },
  finance: {
    label: 'Finance',
    description: 'Revenue, payouts, billing only',
    defaultTabs: ['overview', 'revenue'],
    backendRole: 'support',
  },
  analyst: {
    label: 'Analyst',
    description: 'Read-only analytics',
    defaultTabs: ['overview', 'matches', 'revenue', 'experiments'],
    backendRole: 'support',
  },
  engineer: {
    label: 'Engineer',
    description: 'Experiments, flags, algorithm',
    defaultTabs: ['overview', 'experiments', 'algorithm'],
    backendRole: 'support',
  },
}

export const ROLE_PRESET_KEYS = Object.keys(ROLE_PRESETS)

const TAB_API_MAP = {
  overview: ['/admin/overview'],
  matches: ['/admin/matches'],
  users: ['/admin/users'],
  trust: ['/admin/trust'],
  support: ['/admin/support'],
  notifications: ['/admin/notifications'],
}

export function isSuperAdmin(admin) {
  return admin?.role === 'super_admin'
}

export function normalizeTabPermissions(raw) {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(ADMIN_TABS.filter((tab) => tab !== TEAM_MANAGEMENT_TAB))
  return [...new Set(raw.filter((tab) => typeof tab === 'string' && allowed.has(tab)))]
}

export function resolveTabsForAdmin(row) {
  if (!row) return []
  if (row.role === 'super_admin') return [...ADMIN_TABS]
  return normalizeTabPermissions(row.tabPermissions)
}

export function adminHasTab(admin, tabId) {
  if (!admin) return false
  if (isSuperAdmin(admin)) return true
  const tabs = admin.tabs ?? resolveTabsForAdmin(admin)
  return tabs.includes(tabId)
}

export function validateAssignableTabs(tabPermissions) {
  const normalized = normalizeTabPermissions(tabPermissions)
  if (normalized.length === 0) {
    return { ok: false, error: 'At least one tab must be selected' }
  }
  return { ok: true, tabs: normalized }
}

export function resolvePresetBackendRole(presetKey) {
  const preset = ROLE_PRESETS[presetKey]
  if (!preset) return null
  return preset.backendRole
}

export function resolveApiTab(pathname) {
  const path = String(pathname || '')
  for (const [tab, prefixes] of Object.entries(TAB_API_MAP)) {
    if (prefixes.some((prefix) => path.startsWith(prefix))) return tab
  }
  return null
}
