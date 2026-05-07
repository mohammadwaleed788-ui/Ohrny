import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function RevenuePage() {
  return (
    <div>
      <PageHead title="Revenue" sub="Subscription performance and monetization health" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['MRR', '$2.46M', '+6.1%'],
          ['ARPPU', '$18.31', '+1.9%'],
          ['Refund rate', '1.4%', '-0.2%'],
          ['Trial to paid', '23.8%', '+0.7%'],
        ].map(([label, value, trend]) => (
          <div key={label} className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
            <p className={`text-xs uppercase tracking-[0.08em] ${adminTokens.textMute}`}>{label}</p>
            <p className={`mt-2 font-mono text-3xl ${adminTokens.text}`}>{value}</p>
            <p className={`mt-1 text-xs ${adminTokens.success}`}>{trend} MoM</p>
          </div>
        ))}
      </div>
    </div>
  )
}

