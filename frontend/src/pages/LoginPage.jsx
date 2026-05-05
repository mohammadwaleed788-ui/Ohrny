import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Shield, Ban } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

function OtpField({ value, onChange, onComplete }) {
  const refs = useRef([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  const setAt = (index, char) => {
    const nextChar = char.replace(/\D/g, '').slice(0, 1)
    const next = [...digits]
    next[index] = nextChar
    const joined = next.join('').slice(0, 6)
    onChange(joined)
    if (nextChar && index < 5) refs.current[index + 1]?.focus()
    if (joined.length === 6) onComplete?.()
  }

  const onKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      const next = [...digits]
      next[index - 1] = ''
      onChange(next.join(''))
      refs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus()
  }

  const onPaste = (event) => {
    const raw = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!raw) return
    event.preventDefault()
    onChange(raw)
    refs.current[Math.min(raw.length - 1, 5)]?.focus()
    if (raw.length === 6) onComplete?.()
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">One-time code</p>
      <div className="flex gap-2" onPaste={onPaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (refs.current[index] = el)}
            value={digit}
            inputMode="numeric"
            maxLength={1}
            autoComplete="one-time-code"
            className="h-14 w-12 rounded-lg border border-neutral-300 bg-white text-center font-mono text-2xl font-semibold text-neutral-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            onChange={(event) => setAt(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const { login, verifyTotp, isAuthenticated, bootstrapping } = useAuth()

  const [step, setStep] = useState('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [totpToken, setTotpToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!bootstrapping && isAuthenticated) {
      navigate('/admin', { replace: true })
    }
  }, [bootstrapping, isAuthenticated, navigate])

  const stepIdx = step === 'credentials' ? 0 : 1

  const submitCredentials = async (event) => {
    event.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const result = await login(email.trim(), password)
      if (result.requireTotp) {
        setTotpToken(result.totpToken)
        setStep('totp')
        setTotp('')
      } else {
        navigate('/admin', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const submitTotp = async (event) => {
    event?.preventDefault()
    setError('')
    if (totp.length !== 6) {
      setError('Enter the 6-digit code from your authenticator.')
      return
    }
    setLoading(true)
    try {
      await verifyTotp(totpToken, totp)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (bootstrapping) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[oklch(0.17_0.008_260)] text-[oklch(0.96_0.005_260)]">
        <p className="text-sm text-[oklch(0.72_0.01_260)]">Loading…</p>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[oklch(0.17_0.008_260)] px-4 py-10 text-[oklch(0.96_0.005_260)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_70%_20%,oklch(0.72_0.15_25_/_0.14),transparent_60%),radial-gradient(40%_30%_at_15%_80%,oklch(0.72_0.14_240_/_0.10),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(oklch(0.26_0.01_260)_1px,transparent_1px),linear-gradient(90deg,oklch(0.26_0.01_260)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto w-full max-w-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[oklch(0.82_0.17_25)] to-[oklch(0.55_0.17_25)]" />
          <div>
            <div className="text-sm font-bold text-[oklch(0.96_0.005_260)]">Ohrny</div>
            <div className="font-mono text-[11px] text-[oklch(0.55_0.01_260)]">secure sign-in</div>
          </div>
        </div>

        <section className="rounded-2xl border border-[oklch(0.30_0.012_260)] bg-[oklch(0.205_0.01_260)] p-6 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2 text-xs text-[oklch(0.55_0.01_260)]">
            {['Credentials', 'Authenticator'].map((label, index) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                {index > 0 ? <div className="h-px flex-1 bg-[oklch(0.26_0.01_260)]" /> : null}
                <div
                  className={`inline-flex items-center gap-1 ${stepIdx === index ? 'text-neutral-900' : stepIdx > index ? 'text-emerald-600' : ''}`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                      stepIdx === index
                        ? 'border-transparent bg-[oklch(0.72_0.15_25_/_0.14)] text-[oklch(0.72_0.15_25)]'
                        : stepIdx > index
                          ? 'border-transparent bg-[oklch(0.78_0.14_155_/_0.14)] text-[oklch(0.78_0.14_155)]'
                          : 'border-[oklch(0.30_0.012_260)] bg-[oklch(0.235_0.012_260)] text-[oklch(0.55_0.01_260)]'
                    }`}
                  >
                    {stepIdx > index ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>

          {step === 'credentials' && (
            <form className="mt-5 space-y-4" onSubmit={submitCredentials}>
              <div>
                <h1 className="text-xl font-bold text-[oklch(0.96_0.005_260)]">Sign in to Ohrny</h1>
                <p className="mt-1 text-sm text-[oklch(0.72_0.01_260)]">
                  Restricted access. All sessions are logged and attributable.
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[oklch(0.55_0.01_260)]">
                  Work email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@ohrny.com"
                  autoComplete="username"
                  className="w-full rounded-lg border border-[oklch(0.26_0.01_260)] bg-[oklch(0.235_0.012_260)] px-3 py-2.5 text-sm text-[oklch(0.96_0.005_260)] outline-none focus:border-[oklch(0.72_0.15_25)] focus:ring-2 focus:ring-[oklch(0.72_0.15_25_/_0.14)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[oklch(0.55_0.01_260)]">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[oklch(0.26_0.01_260)] bg-[oklch(0.235_0.012_260)] px-3 py-2.5 text-sm text-[oklch(0.96_0.005_260)] outline-none focus:border-[oklch(0.72_0.15_25)] focus:ring-2 focus:ring-[oklch(0.72_0.15_25_/_0.14)]"
                />
              </label>
              {error ? (
                <div className="flex items-center gap-2 rounded-lg bg-[oklch(0.70_0.19_25_/_0.14)] px-3 py-2 text-sm text-[oklch(0.70_0.19_25)]">
                  <Ban className="h-4 w-4" />
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[oklch(0.72_0.15_25)] px-4 py-2.5 text-sm font-semibold text-[oklch(0.18_0.04_25)] hover:brightness-110 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Continue'}
                {!loading ? <ChevronRight className="h-4 w-4" /> : null}
              </button>
              <div className="flex items-center justify-between border-t border-[oklch(0.26_0.01_260)] pt-3 text-xs text-[oklch(0.55_0.01_260)]">
                <span className="inline-flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  Encrypted session
                </span>
              </div>
            </form>
          )}

          {step === 'totp' && (
            <form className="mt-5 space-y-4" onSubmit={submitTotp}>
              <div>
                <h1 className="text-xl font-bold text-[oklch(0.96_0.005_260)]">Authenticator code</h1>
                <p className="mt-1 text-sm text-[oklch(0.72_0.01_260)]">
                  Signed in as <span className="font-mono">{email || 'you@ohrny.com'}</span>. Enter your 6-digit code.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[oklch(0.26_0.01_260)] bg-[oklch(0.235_0.012_260)] px-3 py-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[oklch(0.72_0.15_25_/_0.14)] text-[oklch(0.72_0.15_25)]">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[oklch(0.96_0.005_260)]">TOTP</p>
                  <p className="text-xs text-[oklch(0.55_0.01_260)]">Code refreshes every 30s</p>
                </div>
                <span className="rounded-full bg-[oklch(0.72_0.15_25_/_0.14)] px-2 py-0.5 text-xs text-[oklch(0.72_0.15_25)]">
                  step 2 of 2
                </span>
              </div>
              <OtpField value={totp} onChange={setTotp} onComplete={() => setTimeout(() => void submitTotp(), 0)} />
              {error ? (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  <Ban className="h-4 w-4" />
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[oklch(0.72_0.15_25)] px-4 py-2.5 text-sm font-semibold text-[oklch(0.18_0.04_25)] hover:brightness-110 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Verify'}
                {!loading ? <ChevronRight className="h-4 w-4" /> : null}
              </button>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[oklch(0.26_0.01_260)] bg-[oklch(0.205_0.01_260)] px-4 py-2 text-sm text-[oklch(0.72_0.01_260)] hover:bg-[oklch(0.26_0.014_260)]"
                onClick={() => {
                  setStep('credentials')
                  setError('')
                  setTotpToken('')
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
