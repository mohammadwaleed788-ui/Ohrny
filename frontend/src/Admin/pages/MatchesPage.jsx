import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { PageHead } from '../components/PageHead'
import { AreaChart, Sparkline } from '../components/AreaChart'
import { DateRange } from '../components/DateRange'
import { DonutChart } from '../components/DonutChart'
import { adminTokens } from '../theme/tokens'
import { apiGet } from '../../services/apiClient'

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
      <div className="grid gap-3 xl:grid-cols-2">
        <div className={`h-72 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
        <div className={`h-72 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
      </div>
    </div>
  )
}

export function MatchesPage() {
  const [range, setRange] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async (r) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiGet(`/admin/matches?range=${r}`)
      setData(result)
    } catch (err) {
      console.error('Matches fetch error:', err)
      setError(err.message || 'Failed to load matches data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(range)
  }, [range, fetchData])

  if (loading && !data) return <LoadingSkeleton />

  if (error && !data) {
    return (
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-8 text-center`}>
        <div className={`text-sm ${adminTokens.text}`}>Failed to load matches</div>
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

  const { kpis, chart, quality, cohort, outcomes } = data

  return (
    <div className={loading ? 'opacity-60 pointer-events-none transition-opacity' : ''}>
      <PageHead
        title="Matches & conversations"
        sub="How users meet, reply, and actually talk"
        actions={<DateRange value={range} onChange={setRange} />}
      />

      {/* KPI Row */}
      <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Matches / day" value={kpis.matchesPerDay.v} delta={kpis.matchesPerDay.d} note={kpis.matchesPerDay.t} series={kpis.matchesPerDay.series} />
        <KPI label="Reply rate" value={kpis.replyRate.v} delta={kpis.replyRate.d} note={kpis.replyRate.t} series={kpis.replyRate.series} />
        <KPI label="Msgs / match" value={kpis.msgsPerMatch.v} delta={kpis.msgsPerMatch.d} note={kpis.msgsPerMatch.t} series={kpis.msgsPerMatch.series} />
        <KPI label="→ off-platform" value={kpis.offPlatform.v} delta={kpis.offPlatform.d} note={kpis.offPlatform.t} series={kpis.offPlatform.series} />
      </div>

      {/* Chart + Quality Donut */}
      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        <Panel title="Matches vs messages" sub={`Daily totals · ${range}`}>
          <div className="overflow-x-auto">
            <AreaChart
              series={chart.matches}
              secondary={chart.messages}
              labels={chart.labels}
              w={700}
              h={260}
              yFormat={(n) => (n >= 1000 ? (n / 1000).toFixed(0) + 'k' : String(n))}
            />
          </div>
          <div className={`mt-3 flex items-center gap-4 text-xs ${adminTokens.textDim}`}>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-3.5 rounded bg-[oklch(0.72_0.15_25)]" /> Matches
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-3.5 border-t border-dashed border-sky-300" /> Messages
            </span>
          </div>
        </Panel>

        <Panel title="Match quality distribution" sub="By conversation engagement depth">
          <div className="flex items-center justify-center py-4">
            <DonutChart
              size={180}
              segments={[
                { label: 'Excellent (20+ msgs)', value: quality.excellent, color: 'oklch(0.78 0.14 155)' },
                { label: 'Good (10-19 msgs)', value: quality.good, color: 'oklch(0.72 0.15 25)' },
                { label: 'Fair (3-9 msgs)', value: quality.fair, color: 'oklch(0.82 0.14 80)' },
                { label: 'Low (<3 msgs)', value: quality.low, color: 'oklch(0.55 0.06 260)' },
              ]}
            />
          </div>
        </Panel>
      </div>

      {/* Cohort + Outcomes */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Cohort breakdown" sub="Match distribution by age bucket">
          <div className="space-y-2.5">
            {cohort.map((c) => (
              <div key={c.age} className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: '56px 1fr 40px' }}>
                <span className={`font-mono ${adminTokens.textDim}`}>{c.age}</span>
                <div className={`flex h-2 gap-0.5 overflow-hidden rounded`}>
                  <div className="rounded-l" style={{ width: `${c.m}%`, background: 'oklch(0.65 0.11 235)' }} />
                  <div className="rounded-r" style={{ width: `${c.f}%`, background: 'oklch(0.72 0.15 25)' }} />
                </div>
                <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>{c.pct}%</span>
              </div>
            ))}
          </div>
          <div className={`mt-4 flex items-center justify-end gap-3 text-[11px] ${adminTokens.textMute}`}>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'oklch(0.65 0.11 235)' }} /> Men
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'oklch(0.72 0.15 25)' }} /> Women
            </span>
          </div>
        </Panel>

        <Panel title="Conversation outcomes" sub={`Of ${formatNum(outcomes[0]?.base || 0)} matches in period`}>
          <div className="space-y-1.5">
            {outcomes.map((step) => {
              const width = step.base ? (step.v / step.base) * 100 : 0
              const pct = step.base ? ((step.v / step.base) * 100).toFixed(1) : '0.0'
              return (
                <div key={step.label} className={`relative grid grid-cols-[1fr_auto] items-center gap-2 overflow-hidden rounded-lg ${adminTokens.bgElev2} px-3 py-2`}>
                  <div className="absolute inset-y-0 left-0 bg-[oklch(0.72_0.15_25_/_0.2)]" style={{ width: `${width}%` }} />
                  <div className="relative flex items-center gap-2">
                    <span className={`text-sm ${adminTokens.text}`}>{step.label}</span>
                    <span className={`font-mono text-[11px] ${adminTokens.textMute}`}>{pct}%</span>
                  </div>
                  <span className={`relative font-mono text-[13px] ${adminTokens.textDim}`}>{step.v.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function formatNum(n) {
  return n.toLocaleString('en-US')
}
