import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function ExperimentsPage() {
  return (
    <div>
      <PageHead title="Experiments" sub="Active tests and rollout confidence signals" />
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
        <div className="space-y-2">
          {[
            ['New profile card layout', 'Running', '+2.1% match rate'],
            ['Soft paywall at swipe limit', 'Ramp 40%', '+4.4% paid conversion'],
            ['Prompted icebreakers', 'Paused', '-0.3% chat starts'],
          ].map(([name, status, impact]) => (
            <div key={name} className={`rounded-lg ${adminTokens.bgElev2} px-3 py-2`}>
              <p className={`text-sm ${adminTokens.text}`}>{name}</p>
              <p className={`mt-1 text-xs ${adminTokens.textDim}`}>{status} · {impact}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

