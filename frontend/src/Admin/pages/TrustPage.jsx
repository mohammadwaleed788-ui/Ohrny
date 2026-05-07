import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

const queues = [
  ['Harassment', 142, 'high'],
  ['Scam risk', 71, 'high'],
  ['Minor safety', 38, 'medium'],
  ['Impersonation', 23, 'medium'],
]

export function TrustPage() {
  return (
    <div>
      <PageHead title="Trust & Safety" sub="Risk queues, policy enforcement, and SLA status" />
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
        <div className="grid gap-2">
          {queues.map(([label, count, severity]) => (
            <div key={label} className={`flex items-center justify-between rounded-lg ${adminTokens.bgElev2} px-3 py-2`}>
              <span className={adminTokens.text}>{label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${severity === 'high' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {count} open
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

