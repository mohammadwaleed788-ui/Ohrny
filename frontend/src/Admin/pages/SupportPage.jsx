import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function SupportPage() {
  return (
    <div>
      <PageHead title="Support" sub="Inbox load, response performance, and escalation health" />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['Open tickets', '429'],
          ['First response', '18m'],
          ['CSAT', '92.6%'],
        ].map(([label, value]) => (
          <div key={label} className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
            <p className={`text-xs uppercase tracking-[0.08em] ${adminTokens.textMute}`}>{label}</p>
            <p className={`mt-2 font-mono text-2xl ${adminTokens.text}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

