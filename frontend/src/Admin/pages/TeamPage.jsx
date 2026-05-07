import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function TeamPage() {
  return (
    <div>
      <PageHead title="Team" sub="Admin roles, access levels, and recent security events" />
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
        <div className="space-y-2">
          {[
            ['Elena M.', 'Founder Admin', 'Last active 4m ago'],
            ['Noah R.', 'Trust lead', 'Last active 12m ago'],
            ['Sara K.', 'Support manager', 'Last active 24m ago'],
          ].map(([name, role, active]) => (
            <div key={name} className={`flex items-center justify-between rounded-lg ${adminTokens.bgElev2} px-3 py-2`}>
              <div>
                <p className={`text-sm ${adminTokens.text}`}>{name}</p>
                <p className={`text-xs ${adminTokens.textMute}`}>{role}</p>
              </div>
              <span className={`text-xs ${adminTokens.textDim}`}>{active}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

