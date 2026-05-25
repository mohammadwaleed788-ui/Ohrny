import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ADMIN_ACCESS_STORAGE_KEY,
  ADMIN_REFRESH_STORAGE_KEY,
  apiGet,
  apiPost,
  clearAdminTokens,
  getAccessToken,
  getStoredRefreshToken,
  setAccessToken,
  setStoredRefreshToken,
} from '../services/apiClient.js'

/* Context files intentionally export both Provider and useAuth. */
/* eslint-disable react-refresh/only-export-components */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  const applySession = useCallback((payload) => {
    setAccessToken(payload.accessToken)
    setStoredRefreshToken(payload.refreshToken)
    setAdmin(payload.admin ?? null)
  }, [])

  const clearSession = useCallback(() => {
    clearAdminTokens()
    setAdmin(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!getStoredRefreshToken()) {
        if (!cancelled) setBootstrapping(false)
        return
      }

      getAccessToken() // restore access token from localStorage into memory

      try {
        try {
          const me = await apiGet('/admin/auth/me')
          if (cancelled) return
          setAdmin(me.admin ?? null)
          return
        } catch (e) {
          if (e.status !== 401) throw e
        }

        const data = await apiPost('/admin/auth/refresh', {
          refreshToken: getStoredRefreshToken(),
        })
        if (cancelled) return
        applySession(data)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [applySession, clearSession])

  useEffect(() => {
    const syncLogoutAcrossWindows = (event) => {
      if (
        event.key === ADMIN_ACCESS_STORAGE_KEY ||
        event.key === ADMIN_REFRESH_STORAGE_KEY
      ) {
        if (!event.newValue) clearSession()
      }
    }

    const verifyStoredSession = () => {
      if (admin && !getStoredRefreshToken()) clearSession()
    }

    window.addEventListener('storage', syncLogoutAcrossWindows)
    window.addEventListener('focus', verifyStoredSession)
    document.addEventListener('visibilitychange', verifyStoredSession)

    return () => {
      window.removeEventListener('storage', syncLogoutAcrossWindows)
      window.removeEventListener('focus', verifyStoredSession)
      document.removeEventListener('visibilitychange', verifyStoredSession)
    }
  }, [admin, clearSession])

  const login = useCallback(
    async (email, password) => {
      const data = await apiPost('/admin/auth/login', { email, password })

      if (data.requireTotp && data.totpToken) {
        return { requireTotp: true, totpToken: data.totpToken }
      }

      applySession(data)
      return { requireTotp: false }
    },
    [applySession],
  )

  const verifyTotp = useCallback(
    async (totpToken, code) => {
      const data = await apiPost('/admin/auth/verify-totp', { totpToken, code })
      applySession(data)
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken()
    try {
      if (refreshToken && getAccessToken()) {
        await apiPost('/admin/auth/logout', { refreshToken })
      }
    } catch {
      /* still clear locally */
    }
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({
      admin,
      isAuthenticated: Boolean(admin),
      bootstrapping,
      login,
      verifyTotp,
      logout,
    }),
    [admin, bootstrapping, login, verifyTotp, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
