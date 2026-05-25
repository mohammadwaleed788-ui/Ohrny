import { op } from './operatedTheme'

export function StatusDot({ status }) {
  const color = status === 'active' ? 'bg-[oklch(0.78_0.14_155)]' : status === 'paused' ? 'bg-[oklch(0.82_0.14_80)]' : 'bg-[oklch(0.55_0.01_260)]'
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
}

export function Chip({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: `${op.bgElev2} ${op.dim} border ${op.borderSoft}`,
    ok: `${op.okBg} ${op.ok}`,
    warn: `${op.warnBg} ${op.warn}`,
    bad: `${op.badBg} ${op.bad}`,
    accent: `${op.accentBg} ${op.accent}`,
  }
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>{children}</span>
}

export function Button({ children, tone = 'default', className = '', ...props }) {
  const tones = {
    default: `${op.bgElev} ${op.dim} border ${op.borderSoft} ${op.hover} hover:${op.text}`,
    primary: 'border-transparent bg-[oklch(0.72_0.15_25)] text-[oklch(0.18_0.04_25)] hover:brightness-110',
    ghost: `border-transparent bg-transparent ${op.dim} hover:${op.text}`,
    danger: `${op.badBg} ${op.bad} border-transparent hover:brightness-110`,
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
