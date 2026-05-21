import { useCallback, useEffect, useState } from 'react'
import { Search, Download, Filter, ChevronLeft, ChevronRight, X, MoreHorizontal } from 'lucide-react'
import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'
import { apiGet } from '../../services/apiClient'

const STATUS_CHIP = {
  active: { cls: 'bg-emerald-500/20 text-emerald-300', label: 'Active' },
  verified: { cls: 'bg-sky-500/20 text-sky-300', label: 'Verified' },
  shadow: { cls: 'bg-amber-500/20 text-amber-300', label: 'Shadow' },
  paused: { cls: `${adminTokens.bgElev2} ${adminTokens.textDim}`, label: 'Paused' },
  banned: { cls: 'bg-red-500/20 text-red-300', label: 'Banned' },
}

const PLAN_CHIP = {
  platinum: { cls: 'bg-violet-500/20 text-violet-300', label: 'Platinum' },
  gold: { cls: 'bg-amber-500/20 text-amber-300', label: 'Gold' },
  free: { cls: `${adminTokens.bgElev2} ${adminTokens.textDim}`, label: 'Free' },
}

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['verified', 'Verified'],
  ['paused', 'Paused'],
  ['banned', 'Banned'],
]

const SORT_OPTIONS = [
  ['last_active', 'Last active'],
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['most_matches', 'Most matches'],
  ['most_reports', 'Most reports'],
]

function Avatar({ name, hue, size = 32 }) {
  const letters = (name || '?').split(/[\s@_]+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `linear-gradient(135deg, oklch(0.65 0.11 ${hue}), oklch(0.45 0.11 ${hue + 60}))`,
      }}
    >
      {letters}
    </span>
  )
}

function UserDrawer({ userId, onClose }) {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('profile')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setTab('profile')
    apiGet(`/admin/users/${userId}`)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className={`text-sm ${adminTokens.textMute}`}>Loading…</div>
          </div>
        ) : !user ? (
          <div className="flex flex-1 items-center justify-center">
            <div className={`text-sm ${adminTokens.textMute}`}>User not found</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className={`flex items-center gap-3 border-b ${adminTokens.borderSoft} px-5 py-4`}>
              <Avatar name={user.handle} hue={180} size={40} />
              <div className="flex-1 min-w-0">
                <div className={`truncate font-semibold ${adminTokens.text}`}>{user.handle}</div>
                <div className={`truncate font-mono text-[11px] ${adminTokens.textMute}`}>{user.id}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[user.status]?.cls || ''}`}>
                {STATUS_CHIP[user.status]?.label || user.status}
              </span>
              <button onClick={onClose} className={`rounded-lg p-1.5 hover:${adminTokens.bgElev2}`}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${adminTokens.borderSoft} px-5`}>
              {[['profile', 'Profile'], ['activity', 'Activity'], ['reports', 'Reports']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${tab === k
                    ? `border-[oklch(0.72_0.15_25)] ${adminTokens.text}`
                    : `border-transparent ${adminTokens.textMute} hover:${adminTokens.textDim}`
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === 'profile' && (
                <div className="space-y-3">
                  <DRow k="Handle" v={<span className="font-mono">{user.handle}</span>} />
                  <DRow k="Age" v={`${user.age} (${user.gender})`} />
                  {user.pronouns && <DRow k="Pronouns" v={user.pronouns} />}
                  <DRow k="Location" v={`${user.city}${user.country ? `, ${user.country}` : ''}`} />
                  <DRow k="Joined" v={user.joined} />
                  <DRow k="Last active" v={user.lastActive} />
                  <DRow k="Plan" v={user.plan} />
                  {user.device && <DRow k="Device" v={user.device} />}
                  <DRow k="Verification" v={
                    <div className="flex gap-1.5">
                      {user.phoneVerified && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">Phone</span>}
                      {user.idVerified && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">ID</span>}
                      {!user.phoneVerified && !user.idVerified && <span className={`text-xs ${adminTokens.textMute}`}>None</span>}
                    </div>
                  } />
                  {user.bio && (
                    <>
                      <div className={`mt-4 border-t pt-3 ${adminTokens.borderSoft}`}>
                        <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${adminTokens.textMute}`}>Bio</div>
                        <p className={`text-[13px] leading-relaxed ${adminTokens.textDim}`}>{user.bio}</p>
                      </div>
                    </>
                  )}
                  {user.looking && <DRow k="Looking for" v={user.looking} />}
                  {user.work && <DRow k="Work" v={user.work} />}
                </div>
              )}

              {tab === 'activity' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <StatBox label="Matches" value={user.matches} />
                    <StatBox label="Messages" value={user.msgs} />
                    <StatBox label="Reports" value={user.reports?.length || 0} />
                  </div>
                </div>
              )}

              {tab === 'reports' && (
                <div className="space-y-3">
                  {user.reports?.length > 0 ? user.reports.map((r) => (
                    <div key={r.id} className={`rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-3`}>
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">{r.reason}</span>
                        <span className={`font-mono text-[11px] ${adminTokens.textMute}`}>{r.date}</span>
                      </div>
                      {r.details && <p className={`mt-1.5 text-xs leading-relaxed ${adminTokens.textDim}`}>{r.details}</p>}
                      <div className={`mt-1 text-[11px] ${adminTokens.textMute}`}>Status: {r.status}</div>
                    </div>
                  )) : (
                    <div className={`text-sm ${adminTokens.textMute}`}>No reports against this user.</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

function DRow({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className={`text-xs ${adminTokens.textMute}`}>{k}</span>
      <span className={`text-right text-xs ${adminTokens.textDim}`}>{v}</span>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className={`rounded-lg ${adminTokens.bgElev2} p-3 text-center`}>
      <div className={`text-[10px] uppercase tracking-wide ${adminTokens.textMute}`}>{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${adminTokens.text}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  )
}

export function UsersPage() {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0, limit: 20 })
  const [stats, setStats] = useState({ total: 0, activeToday: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('last_active')
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page, limit: 20, status: filter, sort })
      if (query) params.set('q', query)
      const result = await apiGet(`/admin/users?${params}`)
      setUsers(result.users)
      setPagination(result.pagination)
      setStats(result.stats)
    } catch (err) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, filter, sort, query])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    setPage(1)
  }, [filter, sort, query])

  return (
    <div>
      <PageHead
        title="Users"
        sub={`${stats.total.toLocaleString()} total · ${stats.activeToday.toLocaleString()} active today`}
        actions={
          <button className={`flex items-center gap-1.5 rounded-lg border ${adminTokens.borderSoft} px-3 py-1.5 text-xs font-medium ${adminTokens.textDim} hover:${adminTokens.bgElev2}`}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      {/* Filters bar */}
      <div className={`mb-3 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className={`flex items-center gap-2 rounded-lg ${adminTokens.bgElev2} px-3 py-1.5`} style={{ minWidth: 240 }}>
            <Search className={`h-3.5 w-3.5 ${adminTokens.textMute}`} />
            <input
              className={`w-full bg-transparent text-xs outline-none ${adminTokens.text}`}
              placeholder="Name, @handle, user id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Status chips */}
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${filter === k
                ? 'bg-[oklch(0.72_0.15_25_/_0.2)] text-[oklch(0.72_0.15_25)]'
                : `${adminTokens.bgElev2} ${adminTokens.textDim} hover:${adminTokens.text}`
              }`}
            >
              {l}
            </button>
          ))}

          <div className="flex-1" />

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className={`rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-1 text-[11px] ${adminTokens.textDim} outline-none`}
          >
            {SORT_OPTIONS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} overflow-hidden`}>
        {error && !users.length ? (
          <div className="p-8 text-center">
            <div className={`text-sm ${adminTokens.text}`}>Failed to load users</div>
            <div className={`mt-1 text-xs ${adminTokens.textMute}`}>{error}</div>
            <button
              className="mt-3 rounded-lg bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-xs font-medium text-[oklch(0.18_0.04_25)]"
              onClick={fetchUsers}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${adminTokens.borderSoft}`}>
                  <th className={`px-4 py-2.5 font-medium ${adminTokens.textMute}`}>User</th>
                  <th className={`px-3 py-2.5 font-medium ${adminTokens.textMute}`}>Location</th>
                  <th className={`px-3 py-2.5 font-medium ${adminTokens.textMute}`}>Status</th>
                  <th className={`px-3 py-2.5 font-medium ${adminTokens.textMute}`}>Plan</th>
                  <th className={`px-3 py-2.5 text-right font-medium ${adminTokens.textMute}`}>Matches</th>
                  <th className={`px-3 py-2.5 text-right font-medium ${adminTokens.textMute}`}>Msgs</th>
                  <th className={`px-3 py-2.5 text-right font-medium ${adminTokens.textMute}`}>Reports</th>
                  <th className={`px-3 py-2.5 font-medium ${adminTokens.textMute}`}>Last active</th>
                  <th className="w-10 px-3" />
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-50 pointer-events-none' : ''}>
                {users.map((u, i) => {
                  const statusChip = STATUS_CHIP[u.status] || STATUS_CHIP.active
                  const planChip = PLAN_CHIP[u.plan] || PLAN_CHIP.free
                  return (
                    <tr
                      key={u.id}
                      className={`cursor-pointer border-b ${adminTokens.borderSoft} transition-colors hover:bg-white/[0.02]`}
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.handle} hue={(i * 47) % 360} />
                          <div>
                            <div className={`font-medium ${adminTokens.text}`}>
                              {u.handle} <span className={`font-mono text-[10px] ${adminTokens.textMute}`}>{u.age}·{u.gender}</span>
                            </div>
                            <div className={`font-mono text-[10px] ${adminTokens.textMute}`}>{u.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 ${adminTokens.textDim}`}>{u.city}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusChip.cls}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusChip.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${planChip.cls}`}>{planChip.label}</span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono ${adminTokens.textDim}`}>{u.matches}</td>
                      <td className={`px-3 py-2.5 text-right font-mono ${adminTokens.textDim}`}>{u.msgs}</td>
                      <td className={`px-3 py-2.5 text-right font-mono ${u.reports > 3 ? 'text-red-300' : u.reports > 0 ? 'text-amber-300' : adminTokens.textMute}`}>
                        {u.reports}
                      </td>
                      <td className={`px-3 py-2.5 font-mono ${adminTokens.textMute}`}>{u.lastActive}</td>
                      <td className="px-3 py-2.5">
                        <button
                          className={`rounded-md p-1 hover:${adminTokens.bgElev2}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedUserId(u.id) }}
                        >
                          <MoreHorizontal className={`h-3.5 w-3.5 ${adminTokens.textMute}`} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`px-4 py-8 text-center text-sm ${adminTokens.textMute}`}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {pagination.pages > 1 && (
          <div className={`flex items-center justify-between border-t ${adminTokens.borderSoft} px-4 py-2.5`}>
            <div className={`text-[11px] ${adminTokens.textMute}`}>
              Showing {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} · page {page} of {pagination.pages.toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className={`rounded-md p-1.5 ${adminTokens.textDim} disabled:opacity-30 hover:${adminTokens.bgElev2}`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className={`rounded-md p-1.5 ${adminTokens.textDim} disabled:opacity-30 hover:${adminTokens.bgElev2}`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User detail drawer */}
      <UserDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </div>
  )
}
