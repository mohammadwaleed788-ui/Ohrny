export const adminNavGroups = [
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
      { id: 'trust', label: 'Trust & Safety', icon: 'shield', hot: true },
      { id: 'moderation', label: 'Content review', icon: 'flag', badge: '87' },
      { id: 'support', label: 'Support', icon: 'tickets' },
    ],
  },
  {
    group: 'Product',
    items: [
      { id: 'notifications', label: 'Notifications', icon: 'send', enabled: false },
      { id: 'algorithm', label: 'Algorithm', icon: 'sliders', enabled: false },
      { id: 'plans', label: 'Plans & limits', icon: 'dollar', enabled: false },
    ],
  },
  {
    group: 'Organization',
    items: [{ id: 'team', label: 'Team', icon: 'users' }],
  },
]

export function isNavItemEnabled(item) {
  return item?.enabled !== false
}

export const routeCrumbs = {
  overview: ['Overview'],
  users: ['Users'],
  matches: ['Analytics', 'Matches'],
  trust: ['Operations', 'Trust & Safety'],
  moderation: ['Operations', 'Moderation'],
  revenue: ['Analytics', 'Revenue'],
  experiments: ['Analytics', 'Experiments'],
  algorithm: ['Product', 'Algorithm'],
  notifications: ['Product', 'Notifications'],
  plans: ['Product', 'Plans & Limits'],
  support: ['Operations', 'Support'],
  team: ['Organization', 'Team'],
}
