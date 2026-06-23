import { useEffect, useState } from 'react'
import { adminGet } from '../core/operatedApi.js'
import { op } from '../theme/operatedTheme.js'

export function DashboardView({ persona }) {
  const [data, setData] = useState({ stats: persona.stats || {}, activity: [] })
  const stats = data.stats || {}

  useEffect(() => {
    let cancelled = false
    adminGet(`/admin/operated/personas/${persona.id}/stats`)
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [persona.id])

  return (
    <div className={`h-full min-h-0 flex-1 space-y-4 overflow-y-auto p-4 ${op.scrollbar}`}>
      <div className="grid grid-cols-4 gap-4">
        {[
          ['Matches (lifetime)', stats.matches, '+12 this week'],
          ['Active conversations', stats.active, '+3 today'],
          ['Messages sent today', stats.msgsToday, 'pace - on track'],
          ['Reply rate', `${stats.replyRate}%`, '+2.3pp vs 7d'],
        ].map(([label, value, delta]) => (
          <div key={label} className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
            <div className={`text-xs ${op.mute}`}>{label}</div>
            <div className={`mt-2 text-3xl font-bold ${op.text}`}>{value}</div>
            <div className={`mt-1 text-xs ${op.ok}`}>{delta}</div>
          </div>
        ))}
      </div>

      {/*
      <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev}`}>
        <div className={`border-b ${op.borderSoft} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Recent activity</h2>
          <p className={`mt-1 text-xs ${op.mute}`}>Every action on this persona is attributable.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className={`${op.mute}`}>
            <tr className={`border-b ${op.borderSoft}`}>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {data.activity.map((item) => (
              <tr key={item.id} className={`border-b ${op.borderSoft} last:border-b-0`}>
                <td className={`px-4 py-3 font-mono text-xs ${op.mute}`}>{item.time ? new Date(item.time).toLocaleString() : ''}</td>
                <td className={`px-4 py-3 ${op.text}`}>{item.actor}</td>
                <td className="px-4 py-3"><Chip tone={item.kind === 'flag' ? 'warn' : item.kind === 'sent' ? 'accent' : 'neutral'}>{item.kind}</Chip></td>
                <td className={`px-4 py-3 ${op.dim}`}>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
        <h2 className={`text-sm font-semibold ${op.text}`}>Team access</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {['Elena M.', 'Jordan P.', 'Priya V.', 'Kai L.'].map((name, index) => (
            <div key={name} className={`flex items-center gap-2 rounded-full ${op.bgElev2} px-3 py-1.5 text-sm ${op.text}`}>
              <span className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white" style={avatarGradient((persona.hue + index * 45) % 360)}>{name[0]}</span>
              {name}
            </div>
          ))}
          <Button><Plus className="h-4 w-4" /> Add teammate</Button>
        </div>
      </section>
      */}
    </div>
  )
}
