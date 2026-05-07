import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function NotificationsPage() {
  return (
    <div>
      <PageHead title="Notifications" sub="Push, email, and in-app delivery performance" />
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
        <div className="space-y-2">
          {[
            ['Push delivery', '98.7%'],
            ['Email open rate', '41.2%'],
            ['In-app CTR', '14.9%'],
          ].map(([label, value]) => (
            <div key={label} className={`flex items-center justify-between rounded-lg ${adminTokens.bgElev2} px-3 py-2`}>
              <span className={adminTokens.text}>{label}</span>
              <span className={`font-mono ${adminTokens.textDim}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

