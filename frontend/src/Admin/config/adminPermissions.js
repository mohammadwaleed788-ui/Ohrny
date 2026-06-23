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
  },
  moderator: {
    label: 'Moderator',
    description: 'Trust & Safety + content review',
    defaultTabs: ['overview', 'trust', 'moderation'],
  },
  support: {
    label: 'Support',
    description: 'Tickets, user detail, refunds (capped)',
    defaultTabs: ['overview', 'users', 'support'],
  },
  finance: {
    label: 'Finance',
    description: 'Revenue, payouts, billing only',
    defaultTabs: ['overview', 'revenue'],
  },
  analyst: {
    label: 'Analyst',
    description: 'Read-only analytics',
    defaultTabs: ['overview', 'matches', 'revenue', 'experiments'],
  },
  engineer: {
    label: 'Engineer',
    description: 'Experiments, flags, algorithm',
    defaultTabs: ['overview', 'experiments', 'algorithm'],
  },
}

export const ROLE_PRESET_KEYS = Object.keys(ROLE_PRESETS)

export const TAB_LABELS = {
  overview: 'Overview',
  matches: 'Matches',
  revenue: 'Revenue',
  experiments: 'Experiments',
  users: 'Users',
  trust: 'Trust & Safety',
  moderation: 'Moderation',
  support: 'Support',
  algorithm: 'Algorithm',
  notifications: 'Notifications',
  plans: 'Plans & Limits',
  team: 'Team',
}

export function isSuperAdmin(admin) {
  return admin?.role === 'super_admin'
}

export function adminHasTab(admin, tabId) {
  if (!admin) return false
  if (isSuperAdmin(admin)) return true
  return Array.isArray(admin.tabs) && admin.tabs.includes(tabId)
}

export function firstAllowedTab(admin) {
  if (!admin?.tabs?.length) return 'overview'
  return admin.tabs[0]
}

export function formatRoleLabel(admin) {
  if (isSuperAdmin(admin)) return 'Super admin'
  const preset = ROLE_PRESETS[admin?.teamRolePreset]
  if (preset) return preset.label
  return admin?.role || 'Admin'
}
