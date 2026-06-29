import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download } from 'lucide-react'
import { PageHead } from '../components/PageHead'
import { AreaChart, Sparkline } from '../components/AreaChart'
import { DateRange } from '../components/DateRange'
import { DonutChart } from '../components/DonutChart'
import { adminTokens } from '../theme/tokens'
import { apiGet } from '../../services/apiClient'

const POLL_VISIBLE_MS = 20000
const POLL_HIDDEN_MS = 60000

function KPI({ label, value, delta, note, series }) {
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
      {series?.length > 0 && (
        <div className="mt-3">
          <Sparkline data={series} width={120} height={28} />
        </div>
      )}
    </div>
  )
}

function Panel({ title, sub, children }) {
  return (
    <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
      <div className={`flex items-start gap-3 border-b ${adminTokens.borderSoft} px-4 py-3`}>
        <div>
          <div className={`text-sm font-semibold ${adminTokens.text}`}>{title}</div>
          {sub && <div className={`text-xs ${adminTokens.textMute}`}>{sub}</div>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-32 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-[2fr_1fr]">
        <div className={`h-72 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
        <div className={`h-72 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
      </div>
    </div>
  )
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function RevenuePage() {
  const [range, setRange] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const inFlightRef = useRef(false)
  const pollTimerRef = useRef(null)

  const fetchData = useCallback(async (r, { silent = false } = {}) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (!silent) setLoading(true)
    setError(null)
    try {
      const result = await apiGet(`/admin/revenue?range=${r}`)
      setData(result)
    } catch (err) {
      console.error('Revenue fetch error:', err)
      setError(err.message || 'Failed to load revenue data')
    } finally {
      inFlightRef.current = false
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      fetchData(range)
    }, 0)
    return () => clearTimeout(id)
  }, [range, fetchData])

  useEffect(() => {
    let cancelled = false

    const schedule = () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      const pollMs = document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS
      pollTimerRef.current = setTimeout(async () => {
        if (cancelled) return
        await fetchData(range, { silent: true })
        schedule()
      }, pollMs)
    }

    const onVisibilityChange = () => {
      schedule()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [range, fetchData])

  const handleFinanceReport = useCallback(() => {
    if (!data) return
    const lines = [
      ['Metric', 'Value'],
      ['MRR', data?.kpis?.mrr?.v || '—'],
      ['Net new MRR', data?.kpis?.netNewMrr?.v || '—'],
      ['Paying users', data?.kpis?.payingUsers?.v || '—'],
      ['Churn', data?.kpis?.churn?.v || '—'],
      ['Consumables total', formatMoney(data?.consumablesTotal || 0)],
    ]
    const csv = lines.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revenue-report-${range}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [data, range])

  const maxConsumableRevenue = data?.consumables?.length
    ? Math.max(...data.consumables.map((item) => Number(item.revenue || 0)))
    : 0

  if (loading && !data) return <LoadingSkeleton />

  if (error && !data) {
    return (
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-8 text-center`}>
        <div className={`text-sm ${adminTokens.text}`}>Failed to load revenue</div>
        <div className={`mt-1 text-xs ${adminTokens.textMute}`}>{error}</div>
        <button
          className="mt-3 rounded-lg bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-xs font-medium text-[oklch(0.18_0.04_25)]"
          onClick={() => fetchData(range)}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className={loading ? 'opacity-60 pointer-events-none transition-opacity' : ''}>
      <PageHead
        title="Revenue & subscriptions"
        sub="Subscriptions, consumables, and LTV"
        actions={
          <>
            <DateRange value={range} onChange={setRange} />
            <button
              className={`inline-flex items-center gap-1.5 rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-3 py-1.5 text-xs ${adminTokens.textDim} hover:${adminTokens.text} transition-colors`}
              onClick={handleFinanceReport}
            >
              <Download className="h-3.5 w-3.5" />
              Finance report
            </button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="MRR" value={data.kpis?.mrr?.v || '—'} delta={data.kpis?.mrr?.d || '+0.0%'} note={data.kpis?.mrr?.t || ''} series={data.kpis?.mrr?.series || []} />
        <KPI label="Net new MRR" value={data.kpis?.netNewMrr?.v || '—'} delta={data.kpis?.netNewMrr?.d || '+0.0%'} note={data.kpis?.netNewMrr?.t || ''} series={data.kpis?.netNewMrr?.series || []} />
        <KPI label="Paying users" value={data.kpis?.payingUsers?.v || '—'} delta={data.kpis?.payingUsers?.d || '+0'} note={data.kpis?.payingUsers?.t || ''} series={data.kpis?.payingUsers?.series || []} />
        <KPI label="Churn (logo)" value={data.kpis?.churn?.v || '—'} delta={data.kpis?.churn?.d || '+0.0pp'} note={data.kpis?.churn?.t || ''} series={data.kpis?.churn?.series || []} />
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[2fr_1fr]">
        <Panel title="MRR over time" sub={`All subscription tiers · ${range}`}>
          <div className="overflow-x-auto">
            <AreaChart
              series={data.mrrChart?.current || []}
              secondary={data.mrrChart?.prior || []}
              labels={data.mrrChart?.labels || []}
              w={780}
              h={260}
              yFormat={(n) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`)}
            />
          </div>
          <div className={`mt-3 flex items-center gap-4 text-xs ${adminTokens.textDim}`}>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-3.5 rounded bg-[oklch(0.72_0.15_25)]" /> Current
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-3.5 border-t border-dashed border-sky-300" /> Prior
            </span>
          </div>
        </Panel>

        <Panel title="Plan mix" sub="Active subscribers">
          <div className="flex justify-center pb-2">
            <DonutChart size={170} segments={data.planMix?.segments || []} />
          </div>
          <div className="space-y-2 pt-1">
            {(data.planMix?.rows || []).map((row) => (
              <div key={row.planId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 ${adminTokens.text}`}>
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: row.color }} />
                  {row.name}
                </span>
                <span className={`font-mono tabular-nums ${adminTokens.textDim}`}>{Number(row.count || 0).toLocaleString('en-US')}</span>
                <span className="font-mono tabular-nums text-emerald-300">{formatMoney(row.revenue || 0)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Consumables revenue" sub="Boosts, Super-likes, Read receipts">
          <div className="space-y-2.5">
            {(data.consumables || []).map((item) => (
              <div key={item.type} className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: '120px 1fr auto' }}>
                <span className={`truncate ${adminTokens.textDim}`}>{item.label}</span>
                <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                  <div
                    className="h-full rounded bg-[oklch(0.72_0.15_25)]"
                    style={{ width: `${maxConsumableRevenue > 0 ? (Number(item.revenue || 0) / maxConsumableRevenue) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-mono tabular-nums text-emerald-300">{formatMoney(item.revenue || 0)}</span>
              </div>
            ))}
          </div>
          <div className={`mt-4 flex items-center justify-between border-t ${adminTokens.borderSoft} pt-3`}>
            <span className={`text-xs ${adminTokens.textMute}`}>Total this month</span>
            <span className={`font-mono text-sm ${adminTokens.text}`}>{formatMoney(data.consumablesTotal || 0)}</span>
          </div>
        </Panel>

        <Panel title="Cohort retention" sub="% of subscribers still paying after N months">
          <div className="space-y-1.5 text-[11px]">
            <div className={`grid grid-cols-[70px_repeat(6,minmax(0,1fr))] gap-1.5 font-mono ${adminTokens.textMute}`}>
              <span />
              <span>M1</span>
              <span>M2</span>
              <span>M3</span>
              <span>M4</span>
              <span>M5</span>
              <span>M6</span>
            </div>
            {(data.cohorts || []).map((row) => (
              <div key={row.cohort} className="grid grid-cols-[70px_repeat(6,minmax(0,1fr))] gap-1.5">
                <span className={`font-mono ${adminTokens.textMute}`}>{row.cohort}</span>
                {(row.months || []).map((value, idx) => (
                  <span
                    key={`${row.cohort}-${idx}`}
                    className="rounded px-0 py-1.5 text-center font-mono"
                    style={{
                      background: value == null ? 'transparent' : `oklch(${0.3 + (value / 100) * 0.45} ${0.05 + (value / 100) * 0.12} 25 / ${0.3 + (value / 100) * 0.65})`,
                      color: value == null ? 'oklch(0.55 0.01 260)' : 'oklch(0.96 0.005 260)',
                    }}
                  >
                    {value == null ? '—' : `${value}%`}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

