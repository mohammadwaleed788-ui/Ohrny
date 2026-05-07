import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function PlansPage() {
  return (
    <div>
      <PageHead title="Plans & Limits" sub="Tier entitlements, usage caps, and upgrade pressure" />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['Free', '1,482,200 users', '2 likes/day'],
          ['Plus', '191,420 users', 'Unlimited likes'],
          ['Premium', '52,301 users', 'Priority boosts'],
        ].map(([plan, users, cap]) => (
          <div key={plan} className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
            <p className={`text-sm font-semibold ${adminTokens.text}`}>{plan}</p>
            <p className={`mt-2 text-sm ${adminTokens.textDim}`}>{users}</p>
            <p className={`mt-1 text-xs ${adminTokens.textMute}`}>{cap}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

