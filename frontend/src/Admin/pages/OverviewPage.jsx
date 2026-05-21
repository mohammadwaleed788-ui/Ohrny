import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { PageHead } from '../components/PageHead'
import { AreaChart, Sparkline } from '../components/AreaChart'
import { DateRange } from '../components/DateRange'
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

function BarRow({ label, value, maxPct, rightLabel, rightSub, labelWidth = 130 }) {
  return (
    <div className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: `${labelWidth}px 1fr auto` }}>
      <span className={`truncate ${adminTokens.textDim}`}>{label}</span>
      <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
        <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${Math.min(100, maxPct)}%` }} />
      </div>
      <div className="flex items-center gap-2">
        {rightLabel && <span className={`font-mono tabular-nums ${adminTokens.textDim}`}>{rightLabel}</span>}
        {rightSub && <span className={`font-mono tabular-nums ${adminTokens.textMute}`}>{rightSub}</span>}
      </div>
    </div>
  )
}

function Panel({ title, sub, badge, actions, children }) {
  return (
    <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
      <div className={`flex items-start gap-3 border-b ${adminTokens.borderSoft} px-4 py-3`}>
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${adminTokens.text}`}>{title}</div>
          {sub && <div className={`text-xs ${adminTokens.textMute}`}>{sub}</div>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {badge}
          {actions}
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
        <div className={`h-80 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
        <div className={`h-80 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
      </div>
    </div>
  )
}

export function OverviewPage() {
  const [range, setRange] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAllCities, setShowAllCities] = useState(false)
  const [citySearch, setCitySearch] = useState('')

  const fetchData = useCallback(async (r) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiGet(`/admin/overview?range=${r}`)
      setData(result)
    } catch (err) {
      console.error('Overview fetch error:', err)
      setError(err.message || 'Failed to load overview data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(range)
  }, [range, fetchData])

  const handleRangeChange = (newRange) => {
    setRange(newRange)
  }

  const dauChart = data?.dauChart
  const dauStats = useMemo(() => {
    if (!dauChart?.current?.length) return { currAvg: 0, prevAvg: 0, delta: 0, currPeak: 0, prevPeak: 0 }
    const sum = (a) => a.reduce((s, v) => s + v, 0)
    const avg = (a) => (a.length ? Math.round(sum(a) / a.length) : 0)
    const peak = (a) => (a.length ? Math.max(...a) : 0)
    const currAvg = avg(dauChart.current)
    const prevAvg = avg(dauChart.prior || [])
    const delta = prevAvg ? ((currAvg - prevAvg) / prevAvg) * 100 : 0
    return { currAvg, prevAvg, delta, currPeak: peak(dauChart.current), prevPeak: peak(dauChart.prior || []) }
  }, [dauChart])

  const demographics = data?.demographics
  const filteredCities = useMemo(() => {
    if (!demographics?.cities) return []
    if (!citySearch) return demographics.cities
    return demographics.cities.filter((c) => c.label?.toLowerCase().includes(citySearch.toLowerCase()))
  }, [demographics?.cities, citySearch])

  if (loading && !data) return <LoadingSkeleton />

  if (error && !data) {
    return (
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-8 text-center`}>
        <div className={`text-sm ${adminTokens.text}`}>Failed to load overview</div>
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

  const { kpis, liveUsers, funnel, geo } = data

  const topCities = demographics?.cities?.slice(0, 6) || []

  return (
    <div className={loading ? 'opacity-60 pointer-events-none transition-opacity' : ''}>
      <PageHead
        title="Overview"
        sub={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · all times UTC`}
        actions={<DateRange value={range} onChange={handleRangeChange} />}
      />

      {/* Primary KPI Row */}
      <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Daily active users" value={kpis.dau.v} delta={kpis.dau.d} note={kpis.dau.t} series={kpis.dau.series} />
        <KPI label="Monthly active" value={kpis.mau.v} delta={kpis.mau.d} note={kpis.mau.t} series={kpis.mau.series} />
        <KPI label="Matches today" value={kpis.matchesToday.v} delta={kpis.matchesToday.d} note={kpis.matchesToday.t} series={kpis.matchesToday.series} />
        <KPI label="Monthly recurring" value={kpis.mrr.v} delta={kpis.mrr.d} note={kpis.mrr.t} series={kpis.mrr.series} />
      </div>

      {/* DAU Chart + Live Users */}
      <div className="mb-3 grid gap-3 xl:grid-cols-[2fr_1fr]">
        <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
          <div className={`flex items-start gap-3 border-b ${adminTokens.borderSoft} px-4 py-3`}>
            <div>
              <div className={`text-sm font-semibold ${adminTokens.text}`}>Daily active users</div>
              <div className={`text-xs ${adminTokens.textMute}`}>
                {range === '24h' ? 'Last 24 hours' : range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'} · vs prior {range}
              </div>
            </div>
            <div className={`ml-auto flex items-center gap-4 text-xs ${adminTokens.textDim}`}>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3.5 rounded bg-[oklch(0.72_0.15_25)]" /> Current
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0 w-3.5 border-t border-dashed border-sky-300" /> Prior
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="mb-2 flex items-baseline gap-4">
              <div className={`font-mono text-[30px] font-semibold tracking-[-0.02em] ${adminTokens.text}`}>
                {dauStats.currAvg >= 1000 ? (dauStats.currAvg / 1000).toFixed(1) + 'k' : dauStats.currAvg}
              </div>
              <div className={`text-xs uppercase tracking-[0.06em] ${adminTokens.textMute}`}>
                avg / {range === '24h' ? 'hour' : 'day'}
              </div>
              <div className={`ml-auto rounded-full px-2 py-0.5 text-xs font-mono ${dauStats.delta >= 0 ? `${adminTokens.successBg} ${adminTokens.success}` : 'bg-red-500/14 text-red-300'}`}>
                {dauStats.delta >= 0 ? '▲' : '▼'} {Math.abs(dauStats.delta).toFixed(1)}% vs prior
              </div>
            </div>

            <div className="overflow-x-auto">
              <AreaChart
                series={dauChart.current}
                secondary={dauChart.prior}
                labels={dauChart.labels}
                w={700}
                h={240}
                yFormat={(n) => (n >= 1000 ? (n / 1000).toFixed(0) + 'k' : String(n))}
              />
            </div>

            <div className={`mt-3 grid gap-0 border-t ${adminTokens.borderSoft} pt-3 md:grid-cols-4`}>
              <div className={`border-r ${adminTokens.borderSoft} pr-3`}>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>Current avg</div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${adminTokens.text}`}>{dauStats.currAvg.toLocaleString()}</div>
              </div>
              <div className={`border-r ${adminTokens.borderSoft} px-3`}>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>Prior avg</div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${adminTokens.textMute}`}>{dauStats.prevAvg.toLocaleString()}</div>
              </div>
              <div className={`border-r ${adminTokens.borderSoft} px-3`}>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>Peak</div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${adminTokens.text}`}>{dauStats.currPeak.toLocaleString()}</div>
              </div>
              <div className="pl-3">
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>Δ vs prior peak</div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${dauStats.currPeak >= dauStats.prevPeak ? adminTokens.success : 'text-red-300'}`}>
                  {dauStats.prevPeak ? `${dauStats.currPeak >= dauStats.prevPeak ? '+' : ''}${(((dauStats.currPeak - dauStats.prevPeak) / dauStats.prevPeak) * 100).toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Users Panel */}
        <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
          <div className={`flex items-center gap-2 border-b ${adminTokens.borderSoft} px-4 py-3`}>
            <div className={`text-sm font-semibold ${adminTokens.text}`}>Now on Ohrny</div>
            <div className={`text-xs ${adminTokens.textMute}`}>live · updated 2s ago</div>
            <div className={`ml-auto rounded-full ${adminTokens.successBg} px-2 py-0.5 text-xs ${adminTokens.success}`}>
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              LIVE
            </div>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <div>
              <div className={`font-mono text-4xl font-semibold tracking-[-0.02em] ${adminTokens.text}`}>
                {liveUsers.total.toLocaleString()}
              </div>
              <div className={`text-xs ${adminTokens.textMute}`}>users active in last 5 min</div>
            </div>
            <div className="space-y-2.5">
              {[
                { l: 'iOS', v: liveUsers.platforms.ios, pct: liveUsers.total ? Math.round((liveUsers.platforms.ios / liveUsers.total) * 100) : 0 },
                { l: 'Android', v: liveUsers.platforms.android, pct: liveUsers.total ? Math.round((liveUsers.platforms.android / liveUsers.total) * 100) : 0 },
                { l: 'Web', v: liveUsers.platforms.web, pct: liveUsers.total ? Math.round((liveUsers.platforms.web / liveUsers.total) * 100) : 0 },
              ].map((row) => (
                <div key={row.l} className="grid grid-cols-[52px_1fr_64px] items-center gap-3 text-xs">
                  <span className={adminTokens.textDim}>{row.l}</span>
                  <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                    <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>{row.v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPI Row */}
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <KPI label="LTV (blended)" value={kpis.ltv.v} delta={kpis.ltv.d} note={kpis.ltv.t} series={[]} />
        <KPI label="ARPU (7d)" value={kpis.arpu.v} delta={kpis.arpu.d} note={kpis.arpu.t} series={[]} />
        <KPI label="Open reports" value={kpis.openReports.v} delta={kpis.openReports.d} note={kpis.openReports.t} series={[]} />
      </div>

      {/* Funnel + Geo */}
      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        <Panel title="Engagement funnel" sub={`Today · from app open to planned date`} badge={<span className={`rounded-full border ${adminTokens.borderSoft} px-2 py-0.5 text-[11px] ${adminTokens.textDim}`}>{range}</span>}>
          <div className="space-y-1.5">
            {funnel.map((step, index) => {
              const width = step.base ? (step.v / step.base) * 100 : 0
              const prev = index === 0 ? step.base : funnel[index - 1].v
              const conv = prev ? ((step.v / prev) * 100).toFixed(1) : '0.0'
              return (
                <div key={step.label} className={`relative grid grid-cols-[1fr_auto] items-center gap-2 overflow-hidden rounded-lg ${adminTokens.bgElev2} px-3 py-2`}>
                  <div className="absolute inset-y-0 left-0 bg-[oklch(0.72_0.15_25_/_0.2)]" style={{ width: `${width}%` }} />
                  <div className="relative flex items-center gap-2">
                    <span className={`text-sm ${adminTokens.text}`}>{step.label}</span>
                    <span className={`font-mono text-[11px] ${adminTokens.textMute}`}>{conv}% ↓</span>
                  </div>
                  <span className={`relative font-mono text-[13px] ${adminTokens.textDim}`}>{step.v.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="Geographic split" sub="MAU by country" actions={
          <button className={`text-xs ${adminTokens.textDim} hover:${adminTokens.text}`}>View all →</button>
        }>
          <div className="space-y-2">
            {geo.map((row) => (
              <BarRow key={row.label} label={row.label} maxPct={row.pct * 2.4} rightLabel={row.value >= 1000 ? `${(row.value / 1000).toFixed(0)}k` : String(row.value)} rightSub={`${row.pct}%`} />
            ))}
          </div>
        </Panel>
      </div>

      {/* Age + Gender */}
      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        <Panel title="Age distribution" sub={`MAU by age bucket`} badge={<span className={`rounded-full border ${adminTokens.borderSoft} px-2 py-0.5 text-[11px] ${adminTokens.textDim}`}>{range}</span>}>
          <div className="space-y-2">
            {demographics.ageBuckets.map((a) => (
              <div key={a.label} className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: '52px 1fr 64px 44px' }}>
                <span className={`font-mono ${adminTokens.textDim}`}>{a.label}</span>
                <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                  <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${(a.pct / 35) * 100}%` }} />
                </div>
                <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>
                  {a.n >= 1000 ? `${(a.n / 1000).toFixed(0)}k` : a.n}
                </span>
                <span className={`text-right font-mono tabular-nums ${adminTokens.textMute}`}>{a.pct}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Gender" sub="Self-reported · MAU">
          <div className="space-y-4">
            <div className="flex gap-3">
              {demographics.genderSplit.map((g) => (
                <div key={g.label} style={{ flex: g.pct, minWidth: 60 }}>
                  <div className="h-2 rounded" style={{ background: g.color }} />
                  <div className={`mt-1.5 text-[11.5px] font-medium ${adminTokens.text}`}>{g.label}</div>
                  <div className={`font-mono text-[11px] ${adminTokens.textMute}`}>
                    {g.pct}% · {g.n >= 1000 ? `${(g.n / 1000).toFixed(0)}k` : g.n}
                  </div>
                </div>
              ))}
            </div>

            {demographics.orientation.length > 0 && (
              <>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>Orientation</div>
                <div className="space-y-2">
                  {demographics.orientation.map((o) => (
                    <BarRow key={o.label} label={o.label} maxPct={(o.pct / 80) * 100} rightLabel={`${o.pct}%`} labelWidth={110} />
                  ))}
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Relationship Status + Intent */}
      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        <Panel title="Relationship status" sub="Self-reported · MAU">
          <div className="space-y-2">
            {demographics.relStatus.map((r) => (
              <div key={r.label} className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: '140px 1fr 60px auto' }}>
                <span className={`truncate ${adminTokens.textDim}`}>{r.label}</span>
                <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                  <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${(r.pct / 60) * 100}%` }} />
                </div>
                <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>
                  {r.n >= 1000 ? `${(r.n / 1000).toFixed(0)}k` : r.n}
                </span>
                <span className={`font-mono tabular-nums ${adminTokens.textMute}`}>{r.pct}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="What people are here for" sub="Relationship intent · self-selected at onboarding">
          <div className="space-y-2">
            {demographics.relIntent.map((r) => (
              <BarRow key={r.label} label={r.label} maxPct={(r.pct / 45) * 100} rightLabel={`${r.pct}%`} labelWidth={140} />
            ))}
          </div>
        </Panel>
      </div>

      {/* Top Cities */}
      <div className="mb-3">
        <Panel
          title="Top cities"
          sub="MAU concentration"
          actions={
            <button
              className={`text-xs ${adminTokens.textDim} hover:${adminTokens.text}`}
              onClick={() => setShowAllCities(true)}
            >
              All cities →
            </button>
          }
        >
          <div className="space-y-2">
            {topCities.map((c) => (
              <div key={c.label} className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: '110px 1fr 60px auto' }}>
                <span className={`truncate ${adminTokens.textDim}`}>{c.label}</span>
                <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                  <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${(c.pct / 5) * 100}%` }} />
                </div>
                <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>
                  {c.n >= 1000 ? `${(c.n / 1000).toFixed(1)}k` : c.n}
                </span>
                <span className={`font-mono tabular-nums ${adminTokens.textMute}`}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* All Cities Modal */}
      {showAllCities && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-8" onClick={() => setShowAllCities(false)}>
          <div
            className={`flex max-h-[85vh] w-full max-w-[680px] flex-col rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center gap-3 border-b ${adminTokens.borderSoft} px-5 py-3.5`}>
              <div>
                <div className={`text-[15px] font-semibold ${adminTokens.text}`}>All cities</div>
                <div className={`mt-0.5 text-xs ${adminTokens.textMute}`}>
                  {demographics.cities.length} cities · MAU concentration
                </div>
              </div>
              <div className="flex-1" />
              <div className={`flex items-center gap-2 rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-2.5 py-1.5`}>
                <Search className={`h-3.5 w-3.5 ${adminTokens.textMute}`} />
                <input
                  className={`w-44 bg-transparent text-xs ${adminTokens.text} placeholder:${adminTokens.textMute} outline-none`}
                  placeholder="Search city"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${adminTokens.bgElev2} ${adminTokens.textDim} hover:${adminTokens.text}`}
                onClick={() => setShowAllCities(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3.5">
              <div className="space-y-2">
                {filteredCities.map((c) => (
                  <div key={c.label} className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: '140px 1fr 64px 48px' }}>
                    <span className={`truncate ${adminTokens.textDim}`}>{c.label}</span>
                    <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                      <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${(c.pct / 5) * 100}%` }} />
                    </div>
                    <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>
                      {c.n >= 1000 ? `${(c.n / 1000).toFixed(1)}k` : c.n}
                    </span>
                    <span className={`text-right font-mono tabular-nums ${adminTokens.textMute}`}>{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`flex items-center gap-2 border-t ${adminTokens.borderSoft} px-5 py-3`}>
              <span className={`text-xs ${adminTokens.textMute}`}>Last refresh: just now</span>
              <div className="flex-1" />
              <button
                className="rounded-lg bg-[oklch(0.72_0.15_25)] px-3.5 py-1.5 text-xs font-medium text-[oklch(0.18_0.04_25)]"
                onClick={() => setShowAllCities(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
