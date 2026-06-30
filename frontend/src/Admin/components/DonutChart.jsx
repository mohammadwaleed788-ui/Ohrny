import { adminTokens } from '../theme/tokens'

export function DonutChart({ segments = [], size = 160, showLegend = true }) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1
  const r = size / 2 - 12
  const cx = size / 2
  const cy = size / 2
  const innerR = r - 16

  const { arcs } = segments.reduce(
    (acc, s) => {
      const frac = s.value / total
      const a2 = acc.angle + frac * Math.PI * 2
      const large = frac > 0.5 ? 1 : 0

      const x1 = cx + Math.cos(acc.angle) * r
      const y1 = cy + Math.sin(acc.angle) * r
      const x2 = cx + Math.cos(a2) * r
      const y2 = cy + Math.sin(a2) * r
      const ix1 = cx + Math.cos(a2) * innerR
      const iy1 = cy + Math.sin(a2) * innerR
      const ix2 = cx + Math.cos(acc.angle) * innerR
      const iy2 = cy + Math.sin(acc.angle) * innerR

      const d = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${large} 0 ${ix2},${iy2} Z`
      acc.arcs.push({ ...s, d, pct: Math.round(frac * 100) })
      acc.angle = a2
      return acc
    },
    { angle: -Math.PI / 2, arcs: [] },
  )

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size}>
        {arcs.map((arc, i) => (
          <path key={i} d={arc.d} fill={arc.color} />
        ))}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize="18"
          fontWeight="600"
          fill="oklch(0.96 0.005 260)"
        >
          {total.toLocaleString()}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontFamily="ui-sans-serif, sans-serif"
          fontSize="10"
          fill="oklch(0.55 0.01 260)"
          letterSpacing="0.05em"
        >
          TOTAL
        </text>
      </svg>

      {showLegend && (
        <div className="flex flex-col gap-2">
          {arcs.map((arc, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: arc.color }} />
              <span className={`w-[130px] ${adminTokens.textDim}`}>{arc.label}</span>
              <span className={`font-mono tabular-nums ${adminTokens.text}`}>{arc.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
