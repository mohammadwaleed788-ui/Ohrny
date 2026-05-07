import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function AlgorithmPage() {
  return (
    <div>
      <PageHead title="Algorithm" sub="Ranking signals and tuning impact snapshots" />
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
        <div className={`mb-3 text-xs uppercase tracking-[0.08em] ${adminTokens.textMute}`}>Signal weights</div>
        <div className="space-y-2">
          {[
            ['Compatibility', 38],
            ['Activity recency', 22],
            ['Intent overlap', 19],
            ['Trust score', 14],
            ['Other', 7],
          ].map(([label, weight]) => (
            <div key={label} className="grid grid-cols-[130px_1fr_48px] items-center gap-3 text-sm">
              <span className={adminTokens.textDim}>{label}</span>
              <div className={`h-1.5 overflow-hidden rounded ${adminTokens.bgElev2}`}>
                <div className="h-full rounded bg-[oklch(0.72_0.15_25)]" style={{ width: `${weight}%` }} />
              </div>
              <span className={`text-right font-mono ${adminTokens.text}`}>{weight}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

