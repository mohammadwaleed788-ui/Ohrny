import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Funnel } from 'lucide-react'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import { PageHead } from '../components/PageHead'
import { AreaChart, Sparkline } from '../components/AreaChart'
import { DonutChart } from '../components/DonutChart'
import { adminTokens } from '../theme/tokens'
import { apiGet } from '../../services/apiClient'

const POLL_VISIBLE_MS = 20000
const POLL_HIDDEN_MS = 60000

const TIME_FILTER_PRESETS = [
  { id: 'today', label: 'Today', range: '24h' },
  { id: 'yesterday', label: 'Yesterday', range: '24h' },
  { id: 'this_week', label: 'This week', range: '7d' },
  { id: 'last_week', label: 'Last week', range: '7d' },
  { id: 'last_7_days', label: 'Last 7 days', range: '7d' },
  { id: 'this_month', label: 'This month', range: '30d' },
  { id: 'last_month', label: 'Last month', range: '30d' },
  { id: 'last_30_days', label: 'Last 30 days', range: '30d' },
  { id: 'this_quarter', label: 'This quarter', range: '90d' },
  { id: 'last_quarter', label: 'Last quarter', range: '90d' },
]

const REVENUE_SCOPE_OPTIONS = [
  { value: 'all', label: 'Filter revenue: All' },
  { value: 'subscriptions', label: 'Subscriptions only' },
  { value: 'consumables', label: 'Consumables only' },
]

const AGE_FILTER_OPTIONS = [
  { value: 'all', label: 'All ages' },
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35-44', label: '35-44' },
  { value: '45+', label: '45+' },
]

const GENDER_FILTER_OPTIONS = [
  { value: 'all', label: 'All genders' },
  { value: 'woman', label: 'Women' },
  { value: 'man', label: 'Men' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
]

function KPI({ label, value, delta, note, series }) {
  const isUp = (delta || '').startsWith('+')
  return (
    <div className={`relative overflow-hidden rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-[18px] pb-[14px] pt-4`}>
      <div className={`text-[11.5px] font-semibold uppercase tracking-[0.04em] ${adminTokens.textMute}`}>{label}</div>
      <div className={`mt-[10px] font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] ${adminTokens.text}`}>{value}</div>
      <div className={`mt-[10px] inline-flex items-center gap-1 font-mono text-xs ${isUp ? 'text-emerald-300' : 'text-red-300'}`}>
        {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        <span>{delta}</span>
        <span className={`ml-1 ${adminTokens.textMute}`}>{note}</span>
      </div>
      {series?.length > 0 && (
        <div className="absolute bottom-[10px] right-[14px] opacity-85">
          <Sparkline data={series} width={72} height={20} />
        </div>
      )}
    </div>
  )
}

function Panel({ title, sub, children }) {
  return (
    <div className={`rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
      <div className={`flex items-start gap-3 border-b ${adminTokens.borderSoft} px-[18px] py-[14px]`}>
        <div>
          <div className={`text-[13px] font-semibold tracking-[-0.005em] ${adminTokens.text}`}>{title}</div>
          {sub && <div className={`text-xs ${adminTokens.textMute}`}>{sub}</div>}
        </div>
      </div>
      <div className="p-[18px]">{children}</div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className={`h-14 rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
      <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-32 rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
        ))}
      </div>
      <div className={`h-56 rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
      <div className="grid gap-[14px] xl:grid-cols-[2fr_1fr]">
        <div className={`h-72 rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
        <div className={`h-72 rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev}`} />
      </div>
    </div>
  )
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatMoneyCompact(value) {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n.toFixed(0)}`
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function conversionBadgeClass(value) {
  const n = Number(value || 0)
  if (n >= 15) return 'bg-[oklch(0.78_0.14_155_/_0.18)] text-[oklch(0.78_0.14_155)]'
  if (n >= 10) return 'bg-[oklch(0.75_0.12_235_/_0.18)] text-[oklch(0.75_0.12_235)]'
  if (n >= 5) return 'bg-[oklch(0.82_0.14_80_/_0.18)] text-[oklch(0.82_0.14_80)]'
  return 'bg-[oklch(0.70_0.19_25_/_0.18)] text-[oklch(0.70_0.19_25)]'
}

const COUNTRY_ALIASES = {
  USA: 'US',
  UK: 'GB',
  SWIT: 'CH',
  SWITZERLAND: 'CH',
  PAKISTAN: 'PK',
}

const DIALING_CODE_TO_ISO = (() => {
  const map = new Map()
  for (const isoCode of getCountries()) {
    try {
      const dialing = `+${getCountryCallingCode(isoCode)}`
      // Keep first country for shared calling codes.
      if (!map.has(dialing)) map.set(dialing, isoCode)
    } catch {
      // Ignore unsupported country metadata entries.
    }
  }
  return map
})()

function normalizeCountryCode(raw) {
  const value = String(raw || '').trim()
  if (!value) return null

  const normalizedDial = value.startsWith('+') ? `+${value.slice(1).replace(/\D/g, '')}` : value
  if (DIALING_CODE_TO_ISO.has(normalizedDial)) return DIALING_CODE_TO_ISO.get(normalizedDial)
  if (value.startsWith('+')) return null

  const upper = value.toUpperCase()
  if (COUNTRY_ALIASES[upper]) return COUNTRY_ALIASES[upper]
  if (/^[A-Z]{2}$/.test(upper)) return upper
  return null
}

function countryLabel(code) {
  const countryCode = normalizeCountryCode(code)
  if (!countryCode) return String(code || 'Unknown')
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region' })
    const name = display.of(countryCode)
    return name || countryCode
  } catch {
    return countryCode
  }
}

function FilterSelect({ value, options, onChange, icon }) {
  const active = options.find((option) => option.value === value) || options[0]
  return (
    <label className={`relative inline-flex items-center gap-1.5 rounded-[7px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-3 py-1.5 text-[12px] ${adminTokens.textDim}`}>
      {icon}
      <span>{active.label}</span>
      <ChevronDown className="h-3 w-3 opacity-70" />
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FunnelMetric({ label, value, max, color, sub, rightMeta }) {
  const widthPct = max > 0 ? Math.max(2, (Number(value || 0) / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className={`flex items-center justify-between text-[13px] ${adminTokens.text}`}>
        <span>{label}</span>
        <span className="font-mono text-[22px] font-semibold leading-none tabular-nums">{Number(value || 0).toLocaleString('en-US')}</span>
      </div>
      <div className={`h-7 overflow-hidden rounded-md ${adminTokens.bgElev2}`}>
        <div className="h-full rounded-md" style={{ width: `${widthPct}%`, background: color }} />
      </div>
      <div className={`flex items-center justify-between text-[11px] ${adminTokens.textMute}`}>
        <span>{sub}</span>
        <span>{rightMeta}</span>
      </div>
    </div>
  )
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function shiftMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function buildCalendarCells(date) {
  const start = monthStart(date)
  const year = start.getFullYear()
  const month = start.getMonth()
  const firstWeekday = start.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
  while (cells.length < 35) cells.push(null)
  return cells
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

export function RevenuePage() {
  const [range, setRange] = useState('30d')
  const [timePreset, setTimePreset] = useState('this_month')
  const [timeFilterOpen, setTimeFilterOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [customFromDate, setCustomFromDate] = useState(null)
  const [customToDate, setCustomToDate] = useState(null)
  const [revenueScope, setRevenueScope] = useState('all')
  const [ageFilter, setAgeFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const inFlightRef = useRef(false)
  const pollTimerRef = useRef(null)
  const timeFilterRef = useRef(null)

  const fetchData = useCallback(async ({ range: selectedRange, from, to, revenueScope: scope, age, gender, country, silent = false }) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (!silent) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        range: selectedRange,
        revenueScope: scope,
        age,
        gender,
        country,
      })
      if (from && to) {
        params.set('from', from)
        params.set('to', to)
      }
      const result = await apiGet(`/admin/revenue?${params.toString()}`)
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
    const from = timePreset === 'custom' && customFromDate && customToDate ? toIsoDate(customFromDate) : null
    const to = timePreset === 'custom' && customFromDate && customToDate ? toIsoDate(customToDate) : null
    const id = setTimeout(() => {
      fetchData({
        range,
        from,
        to,
        revenueScope,
        age: ageFilter,
        gender: genderFilter,
        country: countryFilter,
      })
    }, 0)
    return () => clearTimeout(id)
  }, [range, timePreset, customFromDate, customToDate, revenueScope, ageFilter, genderFilter, countryFilter, fetchData])

  useEffect(() => {
    function onDocClick(event) {
      if (timeFilterRef.current && !timeFilterRef.current.contains(event.target)) {
        setTimeFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    let cancelled = false

    const schedule = () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      const pollMs = document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS
      pollTimerRef.current = setTimeout(async () => {
        if (cancelled) return
        await fetchData({
          range,
          from: timePreset === 'custom' && customFromDate && customToDate ? toIsoDate(customFromDate) : null,
          to: timePreset === 'custom' && customFromDate && customToDate ? toIsoDate(customToDate) : null,
          revenueScope,
          age: ageFilter,
          gender: genderFilter,
          country: countryFilter,
          silent: true,
        })
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
  }, [range, timePreset, customFromDate, customToDate, revenueScope, ageFilter, genderFilter, countryFilter, fetchData])

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
  const funnelMax = Math.max(
    Number(data?.funnel?.appDownloads?.v || 0),
    Number(data?.funnel?.completedProfile?.v || 0),
    Number(data?.funnel?.subscription?.v || 0),
  )

  if (loading && !data) return <LoadingSkeleton />

  if (error && !data) {
    return (
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-8 text-center`}>
        <div className={`text-sm ${adminTokens.text}`}>Failed to load revenue</div>
        <div className={`mt-1 text-xs ${adminTokens.textMute}`}>{error}</div>
        <button
          className="mt-3 rounded-lg bg-[oklch(0.72_0.15_25)] px-3 py-1.5 text-xs font-medium text-[oklch(0.18_0.04_25)]"
          onClick={() =>
            fetchData({
              range,
              from: timePreset === 'custom' && customFromDate && customToDate ? toIsoDate(customFromDate) : null,
              to: timePreset === 'custom' && customFromDate && customToDate ? toIsoDate(customToDate) : null,
              revenueScope,
              age: ageFilter,
              gender: genderFilter,
              country: countryFilter,
            })
          }
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const activePreset = TIME_FILTER_PRESETS.find((item) => item.id === timePreset)
  const activePresetLabel =
    timePreset === 'custom' && customFromDate && customToDate
      ? `${customFromDate.toLocaleDateString('en-US')} - ${customToDate.toLocaleDateString('en-US')}`
      : (activePreset?.label || 'Custom')
  const calendarCells = buildCalendarCells(calendarMonth)
  const now = new Date()
  const isCurrentCalendarMonth = now.getMonth() === calendarMonth.getMonth() && now.getFullYear() === calendarMonth.getFullYear()
  const countryOptions = [
    { value: 'all', label: 'All countries' },
    ...(data?.countries || []).map((item) => {
      const code = normalizeCountryCode(item.country)
      const normalized = code || String(item.country || '').toUpperCase()
      return { value: normalized, label: countryLabel(item.country) }
    }),
  ].filter((option, idx, arr) => arr.findIndex((x) => x.value === option.value) === idx)

  return (
    <div className={loading ? 'opacity-60 pointer-events-none transition-opacity' : ''}>
      <PageHead
        title="Revenue & subscriptions"
        sub="Subscriptions, consumables, and LTV"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative" ref={timeFilterRef}>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-[7px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-3 py-1.5 text-[12px] ${adminTokens.textDim} hover:${adminTokens.text}`}
                onClick={() => setTimeFilterOpen((value) => !value)}
              >
                {activePresetLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
              {timeFilterOpen && (
                <div className={`absolute right-0 top-full z-50 mt-1.5 flex w-[350px] overflow-hidden rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} shadow-[0_30px_70px_-25px_rgba(0,0,0,0.85)]`}>
                  <div className={`w-[145px] border-r ${adminTokens.borderSoft} bg-[oklch(0.235_0.012_260)] p-1.5`}>
                    {TIME_FILTER_PRESETS.map((preset) => {
                      const selected = preset.id === timePreset
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] ${
                            selected ? `${adminTokens.text} bg-[oklch(0.30_0.012_260)]` : `${adminTokens.textDim} hover:${adminTokens.text} hover:bg-[oklch(0.30_0.012_260_/_0.4)]`
                          }`}
                          onClick={() => {
                            setTimePreset(preset.id)
                            setRange(preset.range)
                            setCustomFromDate(null)
                            setCustomToDate(null)
                            setTimeFilterOpen(false)
                          }}
                        >
                          <span className="inline-flex h-3 w-3 items-center justify-center">
                            {selected ? <Check className="h-3 w-3 text-[oklch(0.72_0.15_25)]" /> : null}
                          </span>
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="w-[205px] p-2">
                    <div className="mb-2 flex items-center">
                      <div className={`text-[13px] font-medium ${adminTokens.text}`}>
                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          className={`inline-flex h-6 w-6 items-center justify-center rounded border ${adminTokens.borderSoft} ${adminTokens.bgElev2} ${adminTokens.textMute}`}
                          onClick={() => setCalendarMonth((value) => shiftMonth(value, -1))}
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className={`inline-flex h-6 w-6 items-center justify-center rounded border ${adminTokens.borderSoft} ${adminTokens.bgElev2} ${adminTokens.textMute}`}
                          onClick={() => setCalendarMonth((value) => shiftMonth(value, 1))}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className={`mb-1 grid grid-cols-7 text-center text-[11px] ${adminTokens.textMute}`}>
                      {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((dow) => (
                        <span key={dow}>{dow}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[12px]">
                      {calendarCells.map((day, idx) => {
                        const isToday = isCurrentCalendarMonth && day === now.getDate()
                        const cellDate = day == null ? null : new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                        const inCustomRange =
                          cellDate &&
                          customFromDate &&
                          customToDate &&
                          cellDate >= customFromDate &&
                          cellDate <= customToDate
                        return (
                          <button
                            key={`${day ?? 'x'}-${idx}`}
                            type="button"
                            disabled={day == null}
                            className={`inline-flex h-7 items-center justify-center rounded ${
                              day == null
                                ? 'opacity-0 cursor-default'
                                : inCustomRange
                                  ? 'bg-[oklch(0.72_0.15_25_/_0.24)] text-[oklch(0.93_0.01_260)]'
                                : isToday
                                  ? 'bg-[oklch(0.72_0.14_235)] text-[oklch(0.96_0.005_260)]'
                                  : `${adminTokens.textDim} hover:bg-[oklch(0.30_0.012_260_/_0.5)]`
                            }`}
                            onClick={() => {
                              if (!cellDate) return
                              if (!customFromDate || (customFromDate && customToDate)) {
                                setCustomFromDate(cellDate)
                                setCustomToDate(cellDate)
                              } else if (cellDate < customFromDate) {
                                setCustomFromDate(cellDate)
                              } else {
                                setCustomToDate(cellDate)
                              }
                              setTimePreset('custom')
                              setRange('30d')
                            }}
                          >
                            {day ?? '•'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              className={`inline-flex items-center gap-1.5 rounded-[7px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-3 py-1.5 text-[13px] font-medium ${adminTokens.textDim} hover:${adminTokens.text} transition-colors`}
              onClick={handleFinanceReport}
            >
              <Download className="h-3.5 w-3.5" />
              Finance report
            </button>
          </div>
        }
      />

      <div className={`mb-[14px] rounded-[10px] border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={revenueScope}
            options={REVENUE_SCOPE_OPTIONS}
            onChange={setRevenueScope}
            icon={<Funnel className="h-3 w-3" />}
          />
          <FilterSelect value={ageFilter} options={AGE_FILTER_OPTIONS} onChange={setAgeFilter} />
          <FilterSelect value={genderFilter} options={GENDER_FILTER_OPTIONS} onChange={setGenderFilter} />
          <FilterSelect value={countryFilter} options={countryOptions} onChange={setCountryFilter} />
        </div>
      </div>

      <div className="mb-4 grid gap-[14px] md:grid-cols-2 xl:grid-cols-5">
        <KPI label="MRR" value={data.kpis?.mrr?.v || '—'} delta={data.kpis?.mrr?.d || '+0.0%'} note={data.kpis?.mrr?.t || ''} series={data.kpis?.mrr?.series || []} />
        <KPI label="Net new MRR" value={data.kpis?.netNewMrr?.v || '—'} delta={data.kpis?.netNewMrr?.d || '+0.0%'} note={data.kpis?.netNewMrr?.t || ''} series={data.kpis?.netNewMrr?.series || []} />
        <KPI label="Conversion rate" value={data.kpis?.conversionRate?.v || '—'} delta={data.kpis?.conversionRate?.d || '+0.0pp'} note={data.kpis?.conversionRate?.t || ''} series={data.kpis?.conversionRate?.series || []} />
        <KPI label="Paying users" value={data.kpis?.payingUsers?.v || '—'} delta={data.kpis?.payingUsers?.d || '+0'} note={data.kpis?.payingUsers?.t || ''} series={data.kpis?.payingUsers?.series || []} />
        <KPI label="Churn (logo)" value={data.kpis?.churn?.v || '—'} delta={data.kpis?.churn?.d || '+0.0pp'} note={data.kpis?.churn?.t || ''} series={data.kpis?.churn?.series || []} />
      </div>

      <div className="mb-[14px]">
        <Panel title="Conversion funnel" sub="Download → completed profile → subscription">
          <div className="space-y-4">
            <FunnelMetric
              label="App downloads"
              value={data?.funnel?.appDownloads?.v || 0}
              max={funnelMax}
              color="oklch(0.72 0.14 235)"
              sub={data?.funnel?.appDownloads?.d ? `${data.funnel.appDownloads.d} vs prior period` : '—'}
              rightMeta={`${formatPercent(data?.funnel?.appDownloads?.pctOfDownloads || 0)} of downloads`}
            />
            <FunnelMetric
              label="Completed profile"
              value={data?.funnel?.completedProfile?.v || 0}
              max={funnelMax}
              color="oklch(0.82 0.14 80)"
              sub={data?.funnel?.completedProfile?.d ? `${data.funnel.completedProfile.d} vs prior period` : '—'}
              rightMeta={`${formatPercent(data?.funnel?.completedProfile?.pctOfDownloads || 0)} of downloads`}
            />
            <FunnelMetric
              label="Subscription"
              value={data?.funnel?.subscription?.v || 0}
              max={funnelMax}
              color="oklch(0.72 0.15 25)"
              sub={
                data?.funnel?.subscription?.dropFromPrev == null
                  ? '—'
                  : `-${Number(data.funnel.subscription.dropFromPrev || 0).toFixed(1)}% from previous step`
              }
              rightMeta={`${formatPercent(data?.funnel?.subscription?.pctOfDownloads || 0)} of downloads`}
            />
          </div>
        </Panel>
      </div>

      <div className="mb-[14px] grid gap-[14px] xl:grid-cols-[2fr_1fr]">
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
          <div className="flex justify-center pb-3">
            <DonutChart size={160} segments={data.planMix?.segments || []} showLegend={false} />
          </div>
          <div className="space-y-2 pt-1 text-[13px]">
            {(data.planMix?.rows || []).map((row) => (
              <div key={row.planId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 ${adminTokens.text}`}>
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: row.color }} />
                  {row.name}
                </span>
                <span className={`font-mono text-[12px] tabular-nums ${adminTokens.textDim}`}>{Number(row.count || 0).toLocaleString('en-US')}</span>
                <span className="font-mono tabular-nums text-emerald-300">{formatMoney(row.revenue || 0)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-[14px] xl:grid-cols-2">
        <Panel title="Consumables revenue" sub="Boosts, Super-likes, Read receipts">
          <div className="flex flex-col gap-[10px]">
            {(data.consumables || []).map((item) => (
              <div key={item.type} className="grid items-center gap-3 text-[12.5px]" style={{ gridTemplateColumns: '140px 1fr 70px' }}>
                <span className={`truncate ${adminTokens.textDim}`}>{item.label}</span>
                <div className={`h-[6px] overflow-hidden rounded-[3px] ${adminTokens.bgElev2}`}>
                  <div
                    className="h-full rounded-[3px] bg-[oklch(0.72_0.15_25)]"
                    style={{ width: `${maxConsumableRevenue > 0 ? (Number(item.revenue || 0) / maxConsumableRevenue) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-right font-mono tabular-nums text-emerald-300">{formatMoney(item.revenue || 0)}</span>
              </div>
            ))}
          </div>
          <div className={`mt-4 flex items-center justify-between border-t ${adminTokens.borderSoft} pt-3 text-[13px]`}>
            <span className={`${adminTokens.textMute}`}>Total this month</span>
            <span className={`font-mono text-sm ${adminTokens.text}`}>{formatMoney(data.consumablesTotal || 0)}</span>
          </div>
        </Panel>

        <Panel title="Cohort retention" sub="% of subscribers still paying after N months">
          <div className="space-y-1 text-[11px]">
            <div className={`grid grid-cols-[80px_repeat(6,minmax(0,1fr))] gap-1 font-mono ${adminTokens.textMute}`}>
              <span />
              <span>M1</span>
              <span>M2</span>
              <span>M3</span>
              <span>M4</span>
              <span>M5</span>
              <span>M6</span>
            </div>
            {(data.cohorts || []).map((row) => (
              <div key={row.cohort} className="grid grid-cols-[80px_repeat(6,minmax(0,1fr))] gap-1">
                <span className={`font-mono ${adminTokens.textMute}`}>{row.cohort}</span>
                {(row.months || []).map((value, idx) => (
                  <span
                    key={`${row.cohort}-${idx}`}
                    className="rounded-[4px] px-0 py-1.5 text-center font-mono"
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

      <div className="mt-[14px]">
        <Panel title="Revenue by country" sub={`All markets ·${range}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className={`border-b ${adminTokens.borderSoft} bg-[oklch(0.19_0.01_260)]`}>
                  <th className={`px-[14px] py-[10px] text-left text-[11px] font-medium uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Country</th>
                  <th className={`px-[14px] py-[10px] text-right text-[11px] font-medium uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Revenue</th>
                  <th className={`px-[14px] py-[10px] text-right text-[11px] font-medium uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Share of total revenue</th>
                  <th className={`px-[14px] py-[10px] text-right text-[11px] font-medium uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Paying users</th>
                  <th className={`px-[14px] py-[10px] text-right text-[11px] font-medium uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Signups</th>
                  <th className={`px-[14px] py-[10px] text-right text-[11px] font-medium uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Conversion rate</th>
                </tr>
              </thead>
              <tbody>
                {(data.countries || []).map((row) => (
                  <tr key={row.country} className={`border-b ${adminTokens.borderSoft} transition-colors hover:bg-[oklch(0.22_0.012_260_/_0.4)]`}>
                    <td className={`h-11 px-[14px] py-3 font-medium ${adminTokens.text}`}>{countryLabel(row.country)}</td>
                    <td className="h-11 px-[14px] py-3 text-right font-mono tabular-nums text-emerald-300">{formatMoneyCompact(row.revenue)}</td>
                    <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.textDim}`}>{formatPercent(row.share)}</td>
                    <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.textDim}`}>{Number(row.payingUsers || 0).toLocaleString('en-US')}</td>
                    <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.textDim}`}>{Number(row.signups || 0).toLocaleString('en-US')}</td>
                    <td className="h-11 px-[14px] py-3 text-right font-mono tabular-nums">
                      <span className={`inline-flex min-w-[54px] items-center justify-center rounded-full px-2 py-0.5 text-[12px] ${conversionBadgeClass(row.conversionRate)}`}>
                        {formatPercent(row.conversionRate)}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className={`border-t ${adminTokens.borderSoft}`}>
                  <td className={`h-11 px-[14px] py-3 font-semibold ${adminTokens.text}`}>Total</td>
                  <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.text}`}>{formatMoneyCompact(data.countriesTotal?.revenue || 0)}</td>
                  <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.textDim}`}>100%</td>
                  <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.textDim}`}>{Number(data.countriesTotal?.payingUsers || 0).toLocaleString('en-US')}</td>
                  <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.textDim}`}>{Number(data.countriesTotal?.signups || 0).toLocaleString('en-US')}</td>
                  <td className={`h-11 px-[14px] py-3 text-right font-mono tabular-nums ${adminTokens.textDim}`}>{formatPercent(data.countriesTotal?.conversionRate || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

