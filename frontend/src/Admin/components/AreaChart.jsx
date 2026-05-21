import { useMemo } from 'react'

export function Sparkline({ data = [], width = 72, height = 20, color = 'oklch(0.72 0.15 25)' }) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = width / (data.length - 1 || 1)
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AreaChart({
  series = [],
  secondary,
  labels = [],
  w = 700,
  h = 240,
  yFormat = (n) => n,
  color = 'oklch(0.72 0.15 25)',
}) {
  const pad = { t: 16, r: 16, b: 28, l: 48 }
  const iw = w - pad.l - pad.r
  const ih = h - pad.t - pad.b

  const { pts, path, area, secPath, grid, gridVals } = useMemo(() => {
    if (!series.length) return { pts: [], path: '', area: '', secPath: '', grid: [], gridVals: [] }

    const allVals = [...series, ...(secondary || [])]
    const max = Math.max(...allVals) * 1.08
    const min = 0
    const step = iw / (series.length - 1 || 1)

    const toPts = (s) =>
      s.map((v, i) => [pad.l + i * step, pad.t + ih - ((v - min) / (max - min || 1)) * ih])

    const currentPts = toPts(series)
    const currentPath = currentPts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
    const currentArea = `${currentPath} L${currentPts[currentPts.length - 1][0]},${pad.t + ih} L${currentPts[0][0]},${pad.t + ih} Z`

    let secPathStr = ''
    if (secondary?.length) {
      const secPts = toPts(secondary)
      secPathStr = secPts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
    }

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => pad.t + ih * (1 - f))
    const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))

    return { pts: currentPts, path: currentPath, area: currentArea, secPath: secPathStr, grid: gridLines, gridVals: gridValues }
  }, [series, secondary, iw, ih, pad.l, pad.t])

  if (!series.length) {
    return (
      <div className="flex items-center justify-center" style={{ width: w, height: h }}>
        <span className="text-xs text-[oklch(0.55_0.01_260)]">No data</span>
      </div>
    )
  }

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {grid.map((y, i) => (
        <line
          key={i}
          x1={pad.l}
          x2={w - pad.r}
          y1={y}
          y2={y}
          stroke="oklch(0.26 0.01 260)"
          strokeWidth="1"
        />
      ))}

      <g className="text-[10px]" fill="oklch(0.55 0.01 260)" fontFamily="ui-monospace, monospace">
        {gridVals.map((v, i) => (
          <text key={i} x={pad.l - 8} y={grid[i] + 3} textAnchor="end" fontSize="10">
            {yFormat(v)}
          </text>
        ))}
      </g>

      {secPath && (
        <path
          d={secPath}
          fill="none"
          stroke="oklch(0.75 0.12 235)"
          strokeWidth="1.3"
          strokeDasharray="4 3"
          opacity="0.8"
        />
      )}

      <path d={area} fill="url(#areaGradient)" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

      {pts.map(
        (p, i) =>
          i % Math.ceil(pts.length / 8) === 0 && (
            <circle key={i} cx={p[0]} cy={p[1]} r="2.4" fill={color} stroke="oklch(0.205 0.01 260)" strokeWidth="1.5" />
          ),
      )}

      {labels.length > 0 && (
        <g fill="oklch(0.55 0.01 260)" fontFamily="ui-monospace, monospace" fontSize="10">
          {labels.map((l, i) => {
            const step = iw / (labels.length - 1 || 1)
            return (
              <text key={i} x={pad.l + i * step} y={h - 6} textAnchor="middle">
                {l}
              </text>
            )
          })}
        </g>
      )}
    </svg>
  )
}
