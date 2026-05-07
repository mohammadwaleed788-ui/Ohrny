import { PageHead } from '../components/PageHead'
import { adminTokens } from '../theme/tokens'

export function ModerationPage() {
  return (
    <div>
      <PageHead title="Content Review" sub="Manual queue for profile photos, bios, and reports" />
      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
        <div className={`mb-3 flex items-center justify-between text-sm ${adminTokens.textDim}`}>
          <span>Queue size: 87</span>
          <span>Median review: 12m</span>
        </div>
        <div className="space-y-2">
          {['Photo blur violation', 'Bio contains external handle', 'Potential catfish profile'].map((item) => (
            <div key={item} className={`rounded-lg ${adminTokens.bgElev2} px-3 py-2 text-sm ${adminTokens.text}`}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

