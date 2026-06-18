import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Ban, Check, Clock3, Eye, ShieldAlert, Sparkles, X } from 'lucide-react'
import { PageHead } from '../components/PageHead'
import { Sparkline } from '../components/AreaChart'
import { adminTokens } from '../theme/tokens'
import { apiGet, apiPatch, apiPost } from '../../services/apiClient'

const TABS = [
  { id: 'queue', label: 'Queue' },
  { id: 'appeals', label: 'Appeals' },
  { id: 'bans', label: 'Bans' },
  { id: 'patterns', label: 'Patterns' },
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'review', label: 'Under review' },
  { id: 'resolved', label: 'Resolved' },
]

const SEVERITY_STYLES = {
  critical: 'bg-red-500/18 text-red-300',
  high: 'bg-red-500/14 text-red-200',
  medium: 'bg-amber-500/18 text-amber-300',
  low: 'bg-[oklch(0.235_0.012_260)] text-[oklch(0.72_0.01_260)]',
}

const STATUS_STYLES = {
  new: 'bg-red-500/16 text-red-300',
  review: 'bg-amber-500/18 text-amber-300',
  resolved: 'bg-emerald-500/16 text-emerald-300',
}

const STATUS_UPDATES = [
  { label: 'Mark review', value: 'review' },
  { label: 'Resolve', value: 'resolved' },
]

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-US')
}

function KPI({ label, value, delta, note, series = [] }) {
  const isUp = (delta || '').startsWith('+')
  return (
    <div className={`relative overflow-hidden rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
      <div className={`text-[11.5px] font-semibold uppercase tracking-[0.04em] ${adminTokens.textMute}`}>{label}</div>
      <div className={`mt-2 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] ${adminTokens.text}`}>{value}</div>
      <div className={`mt-2 inline-flex items-center gap-1 font-mono text-xs ${isUp ? 'text-emerald-300' : 'text-red-300'}`}>
        {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        <span>{delta}</span>
        <span className={`ml-1 ${adminTokens.textMute}`}>{note}</span>
      </div>
      {series.length > 0 && (
        <div className="mt-3">
          <Sparkline data={series} width={120} height={28} />
        </div>
      )}
    </div>
  )
}

function SubjectCell({ report }) {
  const initials = (report.subjectName || '?')
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="flex items-center gap-2">
      <div className="grid h-7 w-7 place-items-center rounded-full bg-[oklch(0.72_0.15_25_/_0.18)] text-[11px] font-semibold text-[oklch(0.86_0.03_25)]">
        {initials}
      </div>
      <div className="min-w-0">
        <div className={`truncate text-[13px] ${adminTokens.text}`}>{report.subjectName}</div>
        <div className={`truncate font-mono text-[11px] ${adminTokens.textMute}`}>{report.subjectId}</div>
      </div>
    </div>
  )
}

function ReportDetailModal({ report, loading, onClose, onStatusUpdate, actionLoading }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className={`w-full max-w-[720px] rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-center border-b ${adminTokens.borderSoft} px-4 py-3`}>
          <div>
            <div className={`text-sm font-semibold ${adminTokens.text}`}>Report details</div>
            <div className={`font-mono text-xs ${adminTokens.textMute}`}>{report?.id || 'Loading...'}</div>
          </div>
          <button
            type="button"
            className={`ml-auto grid h-7 w-7 place-items-center rounded-md ${adminTokens.bgElev2} ${adminTokens.textDim} hover:${adminTokens.text}`}
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          {loading || !report ? (
            <div className={`rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-4 text-sm ${adminTokens.textDim}`}>Loading report...</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Reason" value={report.reason} />
                <InfoCard label="Severity" value={report.severity} />
                <InfoCard label="Subject" value={report.subjectName} sub={report.subjectId} monoSub />
                <InfoCard label="Reporter" value={report.reporterName} sub={report.reporterId} monoSub />
                <InfoCard label="Status" value={report.status} />
                <InfoCard label="Created" value={new Date(report.createdAt).toLocaleString()} />
              </div>

              <div className={`rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-3`}>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>Report details</div>
                <p className={`mt-2 text-sm leading-6 ${adminTokens.text}`}>{report.details || 'No additional details provided.'}</p>
              </div>

              <div className="flex items-center gap-2">
                {STATUS_UPDATES.map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    disabled={actionLoading}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${adminTokens.bgElev2} ${adminTokens.textDim} hover:${adminTokens.text} disabled:cursor-not-allowed disabled:opacity-60`}
                    onClick={() => onStatusUpdate(action.value)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value, sub, monoSub = false }) {
  return (
    <div className={`rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} p-3`}>
      <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>{label}</div>
      <div className={`mt-1 text-sm ${adminTokens.text}`}>{value || '—'}</div>
      {sub ? <div className={`mt-0.5 text-[11px] ${monoSub ? `font-mono ${adminTokens.textMute}` : adminTokens.textMute}`}>{sub}</div> : null}
    </div>
  )
}

export function TrustPage() {
  const [tab, setTab] = useState('queue')
  const [filter, setFilter] = useState('all')
  const [appealFilter, setAppealFilter] = useState('all')
  const [bansActiveOnly, setBansActiveOnly] = useState(true)
  const [reports, setReports] = useState([])
  const [appeals, setAppeals] = useState([])
  const [bans, setBans] = useState([])
  const [summary, setSummary] = useState({ openReports: 0, criticalOpen: 0, byStatus: { new: 0, review: 0, resolved: 0 } })
  const [trustSummary, setTrustSummary] = useState({
    openReports: 0,
    slaBreaches: 0,
    bansToday: 0,
    appealsOpen: 0,
    avgResolveHours: 0,
  })
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [openDelta, setOpenDelta] = useState('+0')
  const [showEnforceModal, setShowEnforceModal] = useState(false)
  const [enforceTarget, setEnforceTarget] = useState(null)
  const [enforceAction, setEnforceAction] = useState('hard_ban')
  const [enforceDuration, setEnforceDuration] = useState(24)
  const [enforceReason, setEnforceReason] = useState('')
  const [enforceNote, setEnforceNote] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const previousOpenRef = useRef(0)

  const fetchTrustSummary = useCallback(async () => {
    try {
      const result = await apiGet('/admin/trust/summary')
      setTrustSummary({
        openReports: Number(result?.openReports || 0),
        slaBreaches: Number(result?.slaBreaches || 0),
        bansToday: Number(result?.bansToday || 0),
        appealsOpen: Number(result?.appealsOpen || 0),
        avgResolveHours: Number(result?.avgResolveHours || 0),
      })
    } catch (err) {
      console.error('Trust summary fetch error:', err)
    }
  }, [])

  const fetchReports = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    if (!silent) setError(null)
    try {
      const result = await apiGet(`/admin/trust/reports?status=${filter}&limit=25&page=1`)
      const nextOpen = Number(result.summary?.openReports || 0)
      const delta = nextOpen - Number(previousOpenRef.current || 0)
      const sign = delta >= 0 ? '+' : ''
      setOpenDelta(`${sign}${delta}`)
      previousOpenRef.current = nextOpen
      setReports(result.reports || [])
      setSummary(result.summary || { openReports: 0, criticalOpen: 0, byStatus: { new: 0, review: 0, resolved: 0 } })
      setPagination(result.pagination || { page: 1, limit: 25, total: 0, pages: 1 })
    } catch (err) {
      console.error('Trust reports fetch error:', err)
      setError(err.message || 'Failed to load reports')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [filter])

  const fetchAppeals = useCallback(async () => {
    try {
      const result = await apiGet(`/admin/trust/appeals?status=${appealFilter}`)
      setAppeals(result.appeals || [])
    } catch (err) {
      console.error('Trust appeals fetch error:', err)
      setError(err.message || 'Failed to load appeals')
    }
  }, [appealFilter])

  const fetchBans = useCallback(async () => {
    try {
      const result = await apiGet(`/admin/trust/bans?activeOnly=${bansActiveOnly}`)
      setBans(result.bans || [])
    } catch (err) {
      console.error('Trust bans fetch error:', err)
      setError(err.message || 'Failed to load bans')
    }
  }, [bansActiveOnly])

  useEffect(() => {
    const id = setTimeout(() => {
      fetchTrustSummary()
      fetchReports()
      fetchAppeals()
      fetchBans()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchAppeals, fetchBans, fetchReports, fetchTrustSummary])

  useEffect(() => {
    const id = setInterval(() => {
      fetchTrustSummary()
      if (tab === 'queue') {
        fetchReports({ silent: true })
      } else if (tab === 'appeals') {
        fetchAppeals()
      } else if (tab === 'bans') {
        fetchBans()
      }
    }, 15000)
    return () => clearInterval(id)
  }, [fetchAppeals, fetchBans, fetchReports, fetchTrustSummary, tab])

  useEffect(() => {
    const id = setTimeout(() => {
      fetchAppeals()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchAppeals])

  useEffect(() => {
    const id = setTimeout(() => {
      fetchBans()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchBans])

  const handleOpenReport = async (reportId) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const result = await apiGet(`/admin/trust/reports/${reportId}`)
      setSelectedReport(result.report || null)
    } catch (err) {
      console.error('Trust report detail error:', err)
      setSelectedReport(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleStatusUpdate = async (reportId, status) => {
    setUpdatingId(reportId)
    try {
      await apiPatch(`/admin/trust/reports/${reportId}`, { status })
      await fetchReports({ silent: true })
      await fetchTrustSummary()
      if (selectedReport?.id === reportId) {
        const result = await apiGet(`/admin/trust/reports/${reportId}`)
        setSelectedReport(result.report || null)
      }
    } catch (err) {
      console.error('Trust report status update error:', err)
      setError(err.message || 'Failed to update report')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleEnforceSubmit = async () => {
    if (!enforceTarget?.id) return
    setActionBusy(true)
    try {
      await apiPost(`/admin/trust/reports/${enforceTarget.id}/enforce`, {
        action: enforceAction,
        reason: enforceReason,
        note: enforceNote,
        durationHours: enforceAction === 'timed_pause' ? Number(enforceDuration) : undefined,
      })
      setShowEnforceModal(false)
      setEnforceTarget(null)
      setEnforceReason('')
      setEnforceNote('')
      await fetchReports({ silent: true })
      await fetchBans()
      await fetchTrustSummary()
    } catch (err) {
      setError(err.message || 'Failed to enforce action')
    } finally {
      setActionBusy(false)
    }
  }

  const handleAppealDecision = async (appealId, decision) => {
    const note = window.prompt(`Add note for ${decision}:`, '')
    if (!note) return
    setActionBusy(true)
    try {
      await apiPost(`/admin/trust/appeals/${appealId}/decide`, { decision, note })
      await fetchAppeals()
      await fetchBans()
      await fetchTrustSummary()
    } catch (err) {
      setError(err.message || 'Failed to decide appeal')
    } finally {
      setActionBusy(false)
    }
  }

  const handleUnbanUser = async (userId) => {
    const note = window.prompt('Optional unban note:', '') || ''
    setActionBusy(true)
    try {
      await apiPost(`/admin/trust/users/${userId}/unban`, { note })
      await fetchBans()
      await fetchTrustSummary()
    } catch (err) {
      setError(err.message || 'Failed to unban user')
    } finally {
      setActionBusy(false)
    }
  }

  const queueLabel = `Queue (${formatNum(summary.openReports)})`
  const tabLabels = {
    queue: queueLabel,
    appeals: `Appeals (${formatNum(trustSummary.appealsOpen)})`,
    bans: `Bans (${formatNum(trustSummary.bansToday)})`,
    patterns: 'Patterns (coming soon)',
  }

  return (
    <div className={loading ? 'opacity-75 transition-opacity' : ''}>
      <PageHead
        title="Trust & Safety"
        sub={`${formatNum(trustSummary.openReports)} open reports · ${formatNum(summary.criticalOpen)} critical · avg resolve ${trustSummary.avgResolveHours.toFixed(1)}h`}
      />

      <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Open reports" value={formatNum(summary.openReports)} delta={openDelta} note="since refresh" series={[summary.openReports, summary.openReports, summary.openReports]} />
        <KPI label="SLA breaches" value={formatNum(trustSummary.slaBreaches)} delta="+0" note=">12h open" />
        <KPI label="Auto-resolved" value="—" delta="+0.0pp" note="AI confidence " />
        <KPI label="Bans today" value={formatNum(trustSummary.bansToday)} delta="+0" note="hard ban + pause" />
      </div>

      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
        <div className={`flex gap-2 border-b ${adminTokens.borderSoft} px-4 pt-3`}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-t-md border-b-2 px-3 py-2 text-xs font-medium ${tab === item.id
                ? 'border-[oklch(0.72_0.15_25)] text-[oklch(0.86_0.03_25)]'
                : `border-transparent ${adminTokens.textDim} hover:${adminTokens.text}`}`}
            >
              {tabLabels[item.id] || item.label}
            </button>
          ))}
        </div>

        {tab === 'queue' ? (
          <>
            <div className={`flex flex-wrap items-center gap-2 border-b ${adminTokens.borderSoft} px-4 py-3`}>
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-full px-2.5 py-1 text-xs ${filter === item.id
                    ? 'bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.86_0.03_25)]'
                    : `${adminTokens.bgElev2} ${adminTokens.textDim}`}`}
                >
                  {item.label}
                </button>
              ))}
              <span className={`rounded-full px-2.5 py-1 text-xs ${adminTokens.bgElev2} ${adminTokens.textMute}`}>Severity: derived</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${adminTokens.bgElev2} ${adminTokens.textMute}`}>AI: unavailable</span>
            </div>

            {error ? (
              <div className={`px-4 py-3 text-xs text-red-300`}>{error}</div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className={`border-b ${adminTokens.borderSoft} text-left text-[11px] uppercase tracking-[0.06em] ${adminTokens.textMute}`}>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2 text-right">Evidence</th>
                    <th className="px-3 py-2 text-right">AI score</th>
                    <th className="px-3 py-2">Age</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className={`border-b ${adminTokens.borderSoft} last:border-b-0`}>
                      <td className={`px-3 py-2 font-mono text-xs ${adminTokens.text}`}>{report.id}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.low}`}>
                          {report.severity}
                        </span>
                      </td>
                      <td className={`px-3 py-2 ${adminTokens.text}`}>{report.reason}</td>
                      <td className="px-3 py-2"><SubjectCell report={report} /></td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${adminTokens.textMute}`}>—</td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${adminTokens.textMute}`}>—</td>
                      <td className={`px-3 py-2 font-mono text-xs ${adminTokens.textMute}`}>{report.age}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[report.status] || STATUS_STYLES.new}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-1 text-[11px] ${adminTokens.textDim} hover:${adminTokens.text}`}
                            onClick={() => handleOpenReport(report.id)}
                          >
                            <Eye className="mr-1 inline h-3 w-3" />
                            Open
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/15"
                            disabled={actionBusy}
                            onClick={() => {
                              setEnforceTarget(report)
                              setEnforceAction('hard_ban')
                              setShowEnforceModal(true)
                            }}
                          >
                            <Ban className="mr-1 inline h-3 w-3" />
                            Ban
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === report.id}
                            className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-1 text-[11px] ${adminTokens.textDim} hover:${adminTokens.text} disabled:cursor-not-allowed disabled:opacity-55`}
                            onClick={() => handleStatusUpdate(report.id, 'resolved')}
                          >
                            {updatingId === report.id ? <ShieldAlert className="inline h-3 w-3 animate-pulse" /> : <Check className="inline h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && reports.length === 0 && (
                    <tr>
                      <td colSpan={9} className={`px-3 py-8 text-center text-sm ${adminTokens.textDim}`}>
                        No reports found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={`flex items-center border-t ${adminTokens.borderSoft} px-4 py-3 text-xs`}>
              <div className={adminTokens.textDim}>
                Showing {formatNum(reports.length)} of {formatNum(pagination.total)} filtered reports
              </div>
              <div className="flex-1" />
              <div className={`font-mono ${adminTokens.textMute}`}>auto-refreshing every 15s</div>
            </div>

          </>
        ) : tab === 'appeals' ? (
          <div className="p-4">
            <div className={`mb-3 flex items-center gap-2`}>
              {['all', 'open', 'decided'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAppealFilter(item)}
                  className={`rounded-full px-2.5 py-1 text-xs ${appealFilter === item ? 'bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.86_0.03_25)]' : `${adminTokens.bgElev2} ${adminTokens.textDim}`}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead>
                  <tr className={`border-b ${adminTokens.borderSoft} text-left text-[11px] uppercase tracking-[0.06em] ${adminTokens.textMute}`}>
                    <th className="px-3 py-2">Appeal</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Enforcement</th>
                    <th className="px-3 py-2">Statement</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appeals.map((appeal) => (
                    <tr key={appeal.id} className={`border-b ${adminTokens.borderSoft} last:border-b-0`}>
                      <td className={`px-3 py-2 font-mono text-xs ${adminTokens.text}`}>{appeal.id}</td>
                      <td className={`px-3 py-2 ${adminTokens.text}`}>{appeal.userName}</td>
                      <td className={`px-3 py-2 ${adminTokens.textDim}`}>{appeal.enforcementAction || '—'}</td>
                      <td className={`max-w-[380px] truncate px-3 py-2 ${adminTokens.textMute}`}>{appeal.statement}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${appeal.status === 'open' ? 'bg-amber-500/18 text-amber-300' : 'bg-emerald-500/16 text-emerald-300'}`}>
                          {appeal.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={actionBusy || appeal.status !== 'open'}
                            className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-1 text-[11px] ${adminTokens.textDim} hover:${adminTokens.text} disabled:cursor-not-allowed disabled:opacity-50`}
                            onClick={() => handleAppealDecision(appeal.id, 'uphold')}
                          >
                            Uphold
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy || appeal.status !== 'open'}
                            className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => handleAppealDecision(appeal.id, 'overturn')}
                          >
                            Overturn
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {appeals.length === 0 && (
                    <tr>
                      <td colSpan={6} className={`px-3 py-8 text-center text-sm ${adminTokens.textDim}`}>No appeals found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'bans' ? (
          <div className="p-4">
            <div className={`mb-3 flex items-center gap-2`}>
              <button
                type="button"
                className={`rounded-full px-2.5 py-1 text-xs ${bansActiveOnly ? 'bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.86_0.03_25)]' : `${adminTokens.bgElev2} ${adminTokens.textDim}`}`}
                onClick={() => setBansActiveOnly(true)}
              >
                Active
              </button>
              <button
                type="button"
                className={`rounded-full px-2.5 py-1 text-xs ${!bansActiveOnly ? 'bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.86_0.03_25)]' : `${adminTokens.bgElev2} ${adminTokens.textDim}`}`}
                onClick={() => setBansActiveOnly(false)}
              >
                History
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead>
                  <tr className={`border-b ${adminTokens.borderSoft} text-left text-[11px] uppercase tracking-[0.06em] ${adminTokens.textMute}`}>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bans.map((banRow) => (
                    <tr key={banRow.id} className={`border-b ${adminTokens.borderSoft} last:border-b-0`}>
                      <td className={`px-3 py-2 ${adminTokens.text}`}>{banRow.userName}</td>
                      <td className={`px-3 py-2 ${adminTokens.textDim}`}>{banRow.action}</td>
                      <td className={`px-3 py-2 ${adminTokens.textMute}`}>{banRow.reason || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-xs ${adminTokens.textMute}`}>{new Date(banRow.startsAt).toLocaleString()}</td>
                      <td className={`px-3 py-2 font-mono text-xs ${adminTokens.textMute}`}>{banRow.endsAt ? new Date(banRow.endsAt).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${banRow.active ? 'bg-red-500/16 text-red-300' : 'bg-emerald-500/16 text-emerald-300'}`}>
                          {banRow.active ? 'active' : 'closed'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={!banRow.active || actionBusy}
                          className={`rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2 py-1 text-[11px] ${adminTokens.textDim} hover:${adminTokens.text} disabled:cursor-not-allowed disabled:opacity-50`}
                          onClick={() => handleUnbanUser(banRow.userId)}
                        >
                          <Clock3 className="mr-1 inline h-3 w-3" />
                          Unban
                        </button>
                      </td>
                    </tr>
                  ))}
                  {bans.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`px-3 py-8 text-center text-sm ${adminTokens.textDim}`}>No bans found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {tab === 'patterns' && <div className={`px-4 py-10 text-center text-sm ${adminTokens.textDim}`}>Coming soon in .</div>}
      </div>

      {detailOpen && (
        <ReportDetailModal
          report={selectedReport}
          loading={detailLoading}
          actionLoading={Boolean(updatingId && updatingId === selectedReport?.id)}
          onClose={() => {
            setDetailOpen(false)
            setSelectedReport(null)
          }}
          onStatusUpdate={(nextStatus) => {
            if (!selectedReport?.id) return
            handleStatusUpdate(selectedReport.id, nextStatus)
          }}
        />
      )}

      {showEnforceModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6" onClick={() => setShowEnforceModal(false)}>
          <div className={`w-full max-w-[520px] rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`} onClick={(event) => event.stopPropagation()}>
            <div className={`mb-3 text-sm font-semibold ${adminTokens.text}`}>Enforcement action</div>
            <div className={`mb-3 text-xs ${adminTokens.textMute}`}>
              Report: <span className="font-mono">{enforceTarget?.id}</span> · Subject: {enforceTarget?.subjectName}
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs ${enforceAction === 'hard_ban' ? 'bg-red-500/20 text-red-300' : `${adminTokens.bgElev2} ${adminTokens.textDim}`}`}
                  onClick={() => setEnforceAction('hard_ban')}
                >
                  Hard ban
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs ${enforceAction === 'timed_pause' ? 'bg-amber-500/20 text-amber-300' : `${adminTokens.bgElev2} ${adminTokens.textDim}`}`}
                  onClick={() => setEnforceAction('timed_pause')}
                >
                  Timed pause
                </button>
              </div>
              {enforceAction === 'timed_pause' && (
                <label className="block">
                  <div className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${adminTokens.textMute}`}>
                    Pause duration (hours)
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={2160}
                    value={enforceDuration}
                    onChange={(event) => setEnforceDuration(Number(event.target.value || 24))}
                    className={`w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
                    placeholder="e.g. 24"
                  />
                </label>
              )}
              <input
                value={enforceReason}
                onChange={(event) => setEnforceReason(event.target.value)}
                className={`w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
                placeholder="Reason (required)"
              />
              <textarea
                value={enforceNote}
                onChange={(event) => setEnforceNote(event.target.value)}
                className={`h-24 w-full rounded-md border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
                placeholder="Moderator note"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs ${adminTokens.bgElev2} ${adminTokens.textDim}`}
                  onClick={() => setShowEnforceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionBusy || !enforceReason.trim()}
                  className="rounded-md bg-red-500/85 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleEnforceSubmit}
                >
                  {actionBusy ? 'Applying...' : 'Confirm action'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

