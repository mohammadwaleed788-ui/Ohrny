import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

function KPI({ label, value, delta, note, series }) {
  const isUp = (delta || '').startsWith('+')
  const max = Math.max(...series, 1)

  return (
    <div className={`relative overflow-hidden rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
      <div className={`text-[11.5px] font-semibold uppercase tracking-[0.04em] ${adminTokens.textMute}`}>{label}</div>
      <div className={`mt-2 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] ${adminTokens.text}`}>{value}</div>
      <div className={`mt-2 inline-flex items-center gap-1 font-mono text-xs ${isUp ? 'text-emerald-300' : 'text-red-300'}`}>
        {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        <span>{delta}</span>
        <span className={`ml-1 ${adminTokens.textMute}`}>
          {note}
        </span>
      </div>
      <div className="mt-3 h-9">
        <div className="flex h-full items-end gap-1">
          {series.map((point, index) => (
            <div
              key={index}
              className="min-h-3 flex-1 rounded-t bg-[oklch(0.72_0.15_25_/_0.85)]"
              style={{ height: `${Math.max(20, (point / max) * 100)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function OverviewPage() {
  const [range, setRange] = useState('7d')

  const kpis = {
    dau: { v: '284,119', d: '+4.2%', t: 'vs last 7d', series: [12, 18, 17, 20, 22, 21, 19, 23, 25, 24, 27, 28] },
    mau: { v: '1,142,873', d: '+2.8%', t: 'rolling 30d', series: [30, 31, 31, 33, 34, 34, 35, 36, 37, 38, 38, 40] },
    matches: { v: '61,204', d: '+11.6%', t: 'vs avg', series: [8, 10, 14, 12, 18, 22, 24, 26, 30, 34, 40, 46] },
    mrr: { v: '$2.46M', d: '+6.1%', t: 'MoM', series: [20, 21, 22, 22, 24, 24, 25, 26, 27, 28, 28, 29] },
  }

  const geoData = useMemo(
    () => [
      { label: 'United States', value: 36.1 },
      { label: 'United Kingdom', value: 12.5 },
      { label: 'Germany', value: 8.6 },
      { label: 'Brazil', value: 7.8 },
      { label: 'Canada', value: 5.9 },
    ],
    [],
  )

  const funnel = useMemo(
    () => [
      { label: 'App opens', v: 284119, base: 284119 },
      { label: 'Swipes started', v: 241540, base: 284119 },
      { label: '>=1 match', v: 96231, base: 284119 },
      { label: 'Sent first msg', v: 58107, base: 284119 },
      { label: 'Got a reply', v: 41782, base: 284119 },
    ],
    [],
  )

  const dauStats = useMemo(
    () => ({
      currAvg: 284119,
      prevAvg: 272705,
      currPeak: 301774,
      prevPeak: 287618,
      delta: 4.2,
    }),
    [],
  )

  return (
    <div>
      <PageHead
        title="Overview"
        sub="Wednesday, April 22 · all times UTC"
        actions={
          <div className={`inline-flex gap-1 rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-0.5`}>
            {['24h', '7d', '30d', '90d'].map((option) => (
              <button
                key={option}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  range === option
                    ? `${adminTokens.bgElev2} ${adminTokens.text}`
                    : `${adminTokens.textDim}`
                }`}
                onClick={() => setRange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Daily active users" value={kpis.dau.v} delta={kpis.dau.d} note={kpis.dau.t} series={kpis.dau.series} />
        <KPI label="Monthly active" value={kpis.mau.v} delta={kpis.mau.d} note={kpis.mau.t} series={kpis.mau.series} />
        <KPI label="Matches today" value={kpis.matches.v} delta={kpis.matches.d} note={kpis.matches.t} series={kpis.matches.series} />
        <KPI label="Monthly recurring" value={kpis.mrr.v} delta={kpis.mrr.d} note={kpis.mrr.t} series={kpis.mrr.series} />
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[2fr_1fr]">
        <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
          <div className={`flex items-start gap-3 border-b ${adminTokens.borderSoft} px-4 py-3`}>
            <div>
              <div className={`text-sm font-semibold ${adminTokens.text}`}>Daily active users</div>
              <div className={`text-xs ${adminTokens.textMute}`}>
                {range === '24h' ? 'Last 24 hours' : range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'} · vs prior{' '}
                {range}
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
                {(dauStats.currAvg / 1000).toFixed(1)}k
              </div>
              <div className={`text-xs uppercase tracking-[0.06em] ${adminTokens.textMute}`}>
                avg / day
              </div>
              <div className={`ml-auto rounded-full ${adminTokens.successBg} px-2 py-0.5 text-xs ${adminTokens.success}`}>
                {Math.abs(dauStats.delta).toFixed(1)}% vs prior
              </div>
            </div>
            <div className={`relative h-[240px] overflow-hidden rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bg}`}>
              <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(to_bottom,transparent_23%,oklch(0.26_0.01_260)_24%,transparent_25%)] [background-size:100%_40px]" />
              <div className="absolute inset-x-4 bottom-[72px] h-0.5 rounded bg-[oklch(0.72_0.15_25)] shadow-[0_-28px_0_0_oklch(0.72_0.15_25_/_0.3),0_24px_0_0_oklch(0.72_0.15_25_/_0.2)]" />
              <div className="absolute inset-x-4 bottom-[58px] h-0 border-t border-dashed border-sky-300" />
            </div>
            <div className={`mt-3 grid gap-0 border-t ${adminTokens.borderSoft} pt-3 md:grid-cols-4`}>
              <div className={`border-r ${adminTokens.borderSoft} pr-3`}>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>
                  Current avg
                </div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${adminTokens.text}`}>
                  {dauStats.currAvg.toLocaleString()}
                </div>
              </div>
              <div className={`border-r ${adminTokens.borderSoft} px-3`}>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>
                  Prior avg
                </div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${adminTokens.textMute}`}>
                  {dauStats.prevAvg.toLocaleString()}
                </div>
              </div>
              <div className={`border-r ${adminTokens.borderSoft} px-3`}>
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>
                  Peak
                </div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${adminTokens.text}`}>
                  {dauStats.currPeak.toLocaleString()}
                </div>
              </div>
              <div className="pl-3">
                <div className={`text-[11px] uppercase tracking-[0.08em] ${adminTokens.textMute}`}>
                  Δ vs prior peak
                </div>
                <div className={`mt-0.5 font-mono text-base font-semibold ${adminTokens.success}`}>
                  +{(((dauStats.currPeak - dauStats.prevPeak) / dauStats.prevPeak) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

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
                41,207
              </div>
              <div className={`text-xs ${adminTokens.textMute}`}>
                users active in last 5 min
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { l: 'iOS', v: 72, n: '29,669' },
                { l: 'Android', v: 25, n: '10,302' },
                { l: 'Web', v: 3, n: '1,236' },
              ].map((row) => (
                <div key={row.l} className="grid grid-cols-[52px_1fr_64px] items-center gap-3 text-xs">
                  <span className={adminTokens.textDim}>{row.l}</span>
                  <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                    <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${row.v}%` }} />
                    </div>
                  <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>{row.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
          <div className={`flex items-start gap-3 border-b ${adminTokens.borderSoft} px-4 py-3`}>
            <div>
              <div className={`text-sm font-semibold ${adminTokens.text}`}>Engagement funnel</div>
              <div className={`text-xs ${adminTokens.textMute}`}>Today · from app open to first reply</div>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-1.5">
              {funnel.map((step, index) => {
                const width = (step.v / step.base) * 100
                const prev = index === 0 ? step.base : funnel[index - 1].v
                const conv = ((step.v / prev) * 100).toFixed(1)
                return (
                  <div key={step.label} className={`relative grid grid-cols-[1fr_auto] items-center gap-2 overflow-hidden rounded-lg ${adminTokens.bgElev2} px-3 py-2`}>
                    <div className="absolute inset-y-0 left-0 bg-[oklch(0.72_0.15_25_/_0.2)]" style={{ width: `${width}%` }} />
                    <div className="relative flex items-center gap-2">
                      <span className={`text-sm ${adminTokens.text}`}>{step.label}</span>
                      <span className={`font-mono text-[11px] ${adminTokens.textMute}`}>{conv}%</span>
                    </div>
                    <span className={`relative font-mono text-[13px] ${adminTokens.textDim}`}>{step.v.toLocaleString()}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
          <div className={`flex items-start gap-3 border-b ${adminTokens.borderSoft} px-4 py-3`}>
            <div>
              <div className={`text-sm font-semibold ${adminTokens.text}`}>Geographic split</div>
              <div className={`text-xs ${adminTokens.textMute}`}>MAU by country</div>
            </div>
          </div>
          <div className="space-y-2 p-4">
              {geoData.map((row) => (
                <div key={row.label} className="grid grid-cols-[130px_1fr_56px] items-center gap-3 text-xs">
                  <span className={`truncate ${adminTokens.textDim}`}>{row.label}</span>
                  <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                    <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${row.value * 2.2}%` }} />
                </div>
                  <span className={`text-right font-mono tabular-nums ${adminTokens.textDim}`}>{row.value}%</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

