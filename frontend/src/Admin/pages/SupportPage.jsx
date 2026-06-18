import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { apiGet, apiPatch, apiPost } from '../../services/apiClient'
import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

const STATUS_FILTERS = [
  ['all', 'All'],
  ['open', 'Open'],
  ['waiting', 'Waiting'],
  ['closed', 'Closed'],
]

const SEVERITY_STYLES = {
  low: 'bg-slate-500/20 text-slate-300',
  medium: 'bg-amber-500/20 text-amber-300',
  high: 'bg-red-500/20 text-red-300',
}

const STATUS_STYLES = {
  open: 'bg-red-500/20 text-red-300',
  waiting: 'bg-amber-500/20 text-amber-300',
  closed: 'bg-slate-500/20 text-slate-300',
}

function KpiCard({ label, value, note }) {
  return (
    <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
      <p className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>{label}</p>
      <p className={`mt-1.5 font-mono text-2xl ${adminTokens.text}`}>{value}</p>
      {note ? <p className={`mt-1 text-xs ${adminTokens.textMute}`}>{note}</p> : null}
    </div>
  )
}

export function SupportPage() {
  const [summary, setSummary] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [severityFilter, setSeverityFilter] = useState('any')
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketMessages, setTicketMessages] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replyInternal, setReplyInternal] = useState(false)
  const [macros, setMacros] = useState([])
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    requesterUserId: '',
    severity: 'low',
  })

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryResult, ticketResult] = await Promise.all([
        apiGet('/admin/support/summary'),
        apiGet(`/admin/support/tickets?status=${statusFilter}&severity=${severityFilter}&limit=50`),
      ])
      setSummary(summaryResult)
      setTickets(ticketResult?.tickets || [])
    } catch (err) {
      setError(err?.message || 'Failed to load support data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter])

  const fetchMacros = useCallback(async () => {
    try {
      const result = await apiGet('/admin/support/macros')
      setMacros(result?.macros || [])
    } catch {
      setMacros([])
    }
  }, [])

  const fetchTicketDetail = useCallback(async (ticketId) => {
    setDetailLoading(true)
    try {
      const result = await apiGet(`/admin/support/tickets/${ticketId}`)
      setSelectedTicket(result?.ticket || null)
      setTicketMessages(result?.messages || [])
    } catch (err) {
      setError(err?.message || 'Failed to load ticket')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      fetchTickets()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchTickets])

  useEffect(() => {
    const id = setTimeout(() => {
      fetchMacros()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchMacros])

  useEffect(() => {
    if (!selectedTicketId) return
    const id = setTimeout(() => {
      fetchTicketDetail(selectedTicketId)
    }, 0)
    return () => clearTimeout(id)
  }, [selectedTicketId, fetchTicketDetail])

  const closeTicketDrawer = () => {
    setSelectedTicketId(null)
    setSelectedTicket(null)
    setTicketMessages([])
    setReplyBody('')
    setReplyInternal(false)
  }

  const subtitle = useMemo(() => {
    if (!summary) return 'Support workload and response health'
    return `${summary.openTickets} open · median first response ${summary.medianFirstResponseMinutes}m · CSAT ${summary.csat.toFixed(1)} / 5`
  }, [summary])

  const handleAssignSelf = async (ticketId) => {
    setActionLoading(true)
    try {
      await apiPost(`/admin/support/tickets/${ticketId}/assign-self`, {})
      await fetchTickets()
      if (selectedTicketId === ticketId) await fetchTicketDetail(ticketId)
    } catch (err) {
      setError(err?.message || 'Failed to assign ticket')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (ticketId, status) => {
    setActionLoading(true)
    try {
      await apiPatch(`/admin/support/tickets/${ticketId}`, { status })
      await fetchTickets()
      if (selectedTicketId === ticketId) await fetchTicketDetail(ticketId)
    } catch (err) {
      setError(err?.message || 'Failed to update status')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendReply = async () => {
    const body = replyBody.trim()
    if (!selectedTicketId || !body) return
    setActionLoading(true)
    try {
      await apiPost(`/admin/support/tickets/${selectedTicketId}/replies`, {
        body,
        isInternal: replyInternal,
      })
      setReplyBody('')
      setReplyInternal(false)
      await fetchTicketDetail(selectedTicketId)
      await fetchTickets()
    } catch (err) {
      setError(err?.message || 'Failed to post reply')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateTicket = async () => {
    const subject = newTicket.subject.trim()
    const description = newTicket.description.trim()
    if (!subject || !description) return
    setActionLoading(true)
    try {
      await apiPost('/admin/support/tickets', {
        subject,
        description,
        requesterUserId: newTicket.requesterUserId.trim() || null,
        severity: newTicket.severity,
      })
      setShowNewTicket(false)
      setNewTicket({ subject: '', description: '', requesterUserId: '', severity: 'low' })
      await fetchTickets()
    } catch (err) {
      setError(err?.message || 'Failed to create ticket')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApplyMacro = (macroBody) => {
    if (!selectedTicketId) {
      setError('Open a ticket before applying a macro.')
      return
    }
    setReplyBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${macroBody}` : macroBody))
  }

  return (
    <div>
      <PageHead
        title="Support tickets"
        sub={subtitle}
        // actions={(
        //   <>
        //     <button
        //       onClick={() => setShowNewTicket(true)}
        //       className="rounded-lg bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-xs font-semibold text-[oklch(0.18_0.04_25)]"
        //     >
        //       <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />New ticket</span>
        //     </button>
        //   </>
        // )}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <KpiCard label="Open" value={summary ? String(summary.openTickets) : '—'} note="current queue" />
        <KpiCard label="First response" value={summary ? `${summary.medianFirstResponseMinutes}m` : '—'} note="median" />
        <KpiCard label="CSAT" value={summary ? summary.csat.toFixed(1) : '—'} note="/ 5 · last 50" />
        <KpiCard label="Agents online" value={summary ? `${summary.agentsOnline} / ${summary.agentsTotal}` : '—'} note="support role" />
      </div>

      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
        <div className={`flex items-center gap-2 border-b ${adminTokens.borderSoft} px-4 py-3`}>
          {STATUS_FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-2.5 py-1 text-xs ${statusFilter === key ? 'bg-[oklch(0.72_0.15_25_/_0.18)] text-[oklch(0.86_0.06_25)]' : `${adminTokens.bgElev2} ${adminTokens.textDim}`}`}
            >
              {label}
            </button>
          ))}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className={`ml-1 rounded-full border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2.5 py-1 text-xs ${adminTokens.textDim}`}
          >
            <option value="any">Severity: any</option>
            <option value="low">Severity: low</option>
            <option value="medium">Severity: medium</option>
            <option value="high">Severity: high</option>
          </select>
          <span className={`ml-auto text-xs ${adminTokens.textMute}`}>{tickets.length} tickets</span>
        </div>

        {error ? <div className="px-4 py-3 text-sm text-red-300">{error}</div> : null}
        {loading ? <div className={`px-4 py-5 text-sm ${adminTokens.textMute}`}>Loading tickets…</div> : null}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={`text-xs uppercase tracking-wide ${adminTokens.textMute}`}>
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-left">Age</th>
                  <th className="px-4 py-3 text-left" />
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className={`border-t ${adminTokens.borderSoft}`}>
                    <td className={`px-4 py-3 font-mono text-xs ${adminTokens.textMute}`}>{ticket.ticketNo}</td>
                    <td className={`px-4 py-3 ${adminTokens.text}`}>{ticket.subject}</td>
                    <td className="px-4 py-3">
                      {ticket.requester ? (
                        <div>
                          <div className={adminTokens.text}>{ticket.requester.handle}</div>
                          <div className={`font-mono text-[11px] ${adminTokens.textMute}`}>{ticket.requester.id}</div>
                        </div>
                      ) : <span className={adminTokens.textMute}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLES[ticket.severity] || SEVERITY_STYLES.low}`}>
                        {ticket.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[ticket.status] || STATUS_STYLES.open}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${adminTokens.textDim}`}>{ticket.assignee?.name || '—'}</td>
                    <td className={`px-4 py-3 font-mono text-xs ${adminTokens.textMute}`}>{ticket.age}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className={`rounded-md border ${adminTokens.borderSoft} px-2 py-1 text-xs ${adminTokens.textDim}`}
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleAssignSelf(ticket.id)}
                          disabled={actionLoading}
                          className={`rounded-md border ${adminTokens.borderSoft} px-2 py-1 text-xs ${adminTokens.textDim} disabled:opacity-60`}
                        >
                          Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`px-4 py-6 text-center text-sm ${adminTokens.textMute}`}>
                      No tickets found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTicketId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/55" onClick={closeTicketDrawer} />
          <aside className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[560px] flex-col border-l ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
            <div className={`border-b ${adminTokens.borderSoft} px-5 py-4`}>
              <div className={`text-xs ${adminTokens.textMute}`}>{selectedTicket?.ticketNo || 'Ticket'}</div>
              <div className={`mt-1 text-base font-semibold ${adminTokens.text}`}>{selectedTicket?.subject || 'Loading…'}</div>
            </div>
            {detailLoading ? (
              <div className={`px-5 py-6 text-sm ${adminTokens.textMute}`}>Loading ticket…</div>
            ) : (
              <>
                <div className={`flex items-center gap-2 border-b ${adminTokens.borderSoft} px-5 py-3`}>
                  <button onClick={() => handleStatusChange(selectedTicketId, 'open')} className={`rounded-md px-2 py-1 text-xs ${adminTokens.bgElev2} ${adminTokens.textDim}`}>Open</button>
                  <button onClick={() => handleStatusChange(selectedTicketId, 'waiting')} className={`rounded-md px-2 py-1 text-xs ${adminTokens.bgElev2} ${adminTokens.textDim}`}>Waiting</button>
                  <button onClick={() => handleStatusChange(selectedTicketId, 'closed')} className={`rounded-md px-2 py-1 text-xs ${adminTokens.bgElev2} ${adminTokens.textDim}`}>Closed</button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className={`mb-3 text-xs ${adminTokens.textMute}`}>Conversation</div>
                  <div className="space-y-2">
                    {ticketMessages.map((message) => (
                      <div key={message.id} className={`rounded-lg border ${adminTokens.borderSoft} ${message.isInternal ? 'bg-amber-500/8' : adminTokens.bgElev2} p-3`}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className={`text-xs font-medium ${adminTokens.text}`}>{message.author?.label || 'System'}</span>
                          <span className={`font-mono text-[11px] ${adminTokens.textMute}`}>{new Date(message.createdAt).toLocaleString()}</span>
                        </div>
                        <div className={`text-sm ${adminTokens.textDim}`}>{message.body}</div>
                      </div>
                    ))}
                    {ticketMessages.length === 0 && <div className={`text-sm ${adminTokens.textMute}`}>No messages yet.</div>}
                  </div>
                </div>
                <div className={`border-t ${adminTokens.borderSoft} px-5 py-3`}>
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write reply..."
                    className={`h-24 w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text} outline-none`}
                  />
                  {macros.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {macros.slice(0, 3).map((macro) => (
                        <button
                          key={macro.id}
                          type="button"
                          onClick={() => handleApplyMacro(macro.body)}
                          className={`rounded-md border ${adminTokens.borderSoft} px-2 py-1 text-[11px] ${adminTokens.textDim}`}
                        >
                          {macro.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <label className={`inline-flex items-center gap-2 text-xs ${adminTokens.textDim}`}>
                      <input type="checkbox" checked={replyInternal} onChange={(e) => setReplyInternal(e.target.checked)} />
                      Internal note
                    </label>
                    <button
                      onClick={handleSendReply}
                      disabled={actionLoading || !replyBody.trim()}
                      className="rounded-lg bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-xs font-semibold text-[oklch(0.18_0.04_25)] disabled:opacity-60"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </>
      )}

      {showNewTicket && (
        <>
          <div className="fixed inset-0 z-40 bg-black/55" onClick={() => setShowNewTicket(false)} />
          <div className={`fixed left-1/2 top-1/2 z-50 w-[92%] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-5`}>
            <div className={`text-base font-semibold ${adminTokens.text}`}>Create support ticket</div>
            <div className="mt-3 space-y-2.5">
              <input
                value={newTicket.subject}
                onChange={(e) => setNewTicket((s) => ({ ...s, subject: e.target.value }))}
                placeholder="Subject"
                className={`w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
              />
              <textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket((s) => ({ ...s, description: e.target.value }))}
                placeholder="Description"
                className={`h-24 w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
              />
              <input
                value={newTicket.requesterUserId}
                onChange={(e) => setNewTicket((s) => ({ ...s, requesterUserId: e.target.value }))}
                placeholder="Requester user ID (optional)"
                className={`w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
              />
              <select
                value={newTicket.severity}
                onChange={(e) => setNewTicket((s) => ({ ...s, severity: e.target.value }))}
                className={`w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowNewTicket(false)} className={`rounded-lg px-3 py-1.5 text-xs ${adminTokens.bgElev2} ${adminTokens.textDim}`}>Cancel</button>
              <button
                onClick={handleCreateTicket}
                disabled={actionLoading || !newTicket.subject.trim() || !newTicket.description.trim()}
                className="rounded-lg bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-xs font-semibold text-[oklch(0.18_0.04_25)] disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

