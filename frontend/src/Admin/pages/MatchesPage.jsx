import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

const matchRows = [
  { segment: '18-24 · US', matchRate: '13.8%', quality: '71', chatsStarted: '46.2%' },
  { segment: '25-34 · US', matchRate: '11.1%', quality: '77', chatsStarted: '51.0%' },
  { segment: '18-24 · EU', matchRate: '9.7%', quality: '73', chatsStarted: '44.4%' },
  { segment: '35-44 · Global', matchRate: '7.4%', quality: '81', chatsStarted: '58.3%' },
]

export function MatchesPage() {
  return (
    <div>
      <PageHead title="Matches" sub="Conversion and quality trends across key cohorts" />

      <div className="mb-3 grid gap-3 md:grid-cols-3">
        {[
          ['Match rate', '11.6%', '+0.8%'],
          ['Chat start rate', '49.2%', '+1.4%'],
          ['Median time to match', '2m 41s', '-12s'],
        ].map(([label, value, delta]) => (
          <div key={label} className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
            <p className={`text-xs uppercase tracking-[0.08em] ${adminTokens.textMute}`}>{label}</p>
            <p className={`mt-2 font-mono text-3xl ${adminTokens.text}`}>{value}</p>
            <p className={`mt-1 text-xs ${adminTokens.success}`}>{delta} vs last 7d</p>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
        <div className={`border-b ${adminTokens.borderSoft} px-4 py-3 text-sm font-semibold ${adminTokens.text}`}>Top segments</div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead className={adminTokens.textMute}>
              <tr className="text-left">
                <th className="px-2 py-2 font-medium">Segment</th>
                <th className="px-2 py-2 font-medium">Match rate</th>
                <th className="px-2 py-2 font-medium">Quality score</th>
                <th className="px-2 py-2 font-medium">Chat starts</th>
              </tr>
            </thead>
            <tbody>
              {matchRows.map((row) => (
                <tr key={row.segment} className={`border-t ${adminTokens.borderSoft}`}>
                  <td className={`px-2 py-2 ${adminTokens.text}`}>{row.segment}</td>
                  <td className={`px-2 py-2 font-mono ${adminTokens.textDim}`}>{row.matchRate}</td>
                  <td className={`px-2 py-2 font-mono ${adminTokens.textDim}`}>{row.quality}</td>
                  <td className={`px-2 py-2 font-mono ${adminTokens.textDim}`}>{row.chatsStarted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

