import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function UsersPage() {
  return (
    <div>
      <PageHead title="Users" sub="User growth, retention, and lifecycle insights" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
          <p className={`text-sm font-semibold ${adminTokens.text}`}>Acquisition</p>
          <div className={`mt-3 grid grid-cols-2 gap-3 text-sm ${adminTokens.textDim}`}>
            <div className={`rounded-lg ${adminTokens.bgElev2} p-3`}>
              <p>New users (7d)</p>
              <p className={`mt-1 font-mono text-xl ${adminTokens.text}`}>43,102</p>
            </div>
            <div className={`rounded-lg ${adminTokens.bgElev2} p-3`}>
              <p>CAC</p>
              <p className={`mt-1 font-mono text-xl ${adminTokens.text}`}>$4.72</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
          <p className={`text-sm font-semibold ${adminTokens.text}`}>Retention</p>
          <div className={`mt-3 grid grid-cols-2 gap-3 text-sm ${adminTokens.textDim}`}>
            <div className={`rounded-lg ${adminTokens.bgElev2} p-3`}>
              <p>D1</p>
              <p className={`mt-1 font-mono text-xl ${adminTokens.text}`}>41.8%</p>
            </div>
            <div className={`rounded-lg ${adminTokens.bgElev2} p-3`}>
              <p>D30</p>
              <p className={`mt-1 font-mono text-xl ${adminTokens.text}`}>18.4%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

