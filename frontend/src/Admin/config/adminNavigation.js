export const adminNavGroups = [
  {
    group: 'Analytics',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'matches', label: 'Matches' },
      { id: 'revenue', label: 'Revenue' },
      { id: 'experiments', label: 'Experiments' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'users', label: 'Users' },
      { id: 'trust', label: 'Trust & Safety' },
      { id: 'moderation', label: 'Moderation' },
      { id: 'support', label: 'Support' },
    ],
  },
  {
    group: 'Product',
    items: [
      { id: 'algorithm', label: 'Algorithm' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'plans', label: 'Plans & Limits' },
    ],
  },
  {
    group: 'Organization',
    items: [{ id: 'team', label: 'Team' }],
  },
]

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
