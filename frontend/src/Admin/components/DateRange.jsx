import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import { adminTokens } from '../theme/tokens'

const PRESETS = [
  { k: '24h', label: 'Last 24 hours' },
  { k: '7d', label: 'Last 7 days' },
  { k: '30d', label: 'Last 30 days' },
  { k: '90d', label: 'Last 90 days' },
]

export function DateRange({ value = '7d', onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const activeLabel = PRESETS.find((p) => p.k === value)?.label || value

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-3 py-1.5 text-xs ${adminTokens.textDim} hover:${adminTokens.text} transition-colors`}
        onClick={() => setOpen((v) => !v)}
      >
        <Calendar className="h-3.5 w-3.5" />
        {activeLabel}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-1.5 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.85)]`}
        >
          {PRESETS.map((p) => (
            <button
              key={p.k}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                value === p.k
                  ? `${adminTokens.text} font-medium`
                  : `${adminTokens.textDim} hover:bg-[oklch(0.235_0.012_260)]`
              }`}
              onClick={() => {
                onChange(p.k)
                setOpen(false)
              }}
            >
              {value === p.k && <Check className="h-3 w-3 text-[oklch(0.72_0.15_25)]" />}
              {value !== p.k && <span className="h-3 w-3" />}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
