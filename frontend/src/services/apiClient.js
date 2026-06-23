const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'


let accessToken = null
let refreshInFlight = null

export const ADMIN_REFRESH_STORAGE_KEY = 'ohrny_admin_refresh'
export const ADMIN_ACCESS_STORAGE_KEY = 'ohrny_admin_access'

export function setAccessToken(token) {
  accessToken = token || null
  try {
    if (token) localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, token)
    else localStorage.removeItem(ADMIN_ACCESS_STORAGE_KEY)
  } catch {
    /* private mode / SSR */
  }
}

export function getAccessToken() {
  if (accessToken) return accessToken
  try {
    const fromStore = localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY)
    accessToken = fromStore || null
  } catch {
    accessToken = null
  }
  return accessToken
}

export function getStoredRefreshToken() {
  return localStorage.getItem(ADMIN_REFRESH_STORAGE_KEY)
}

export function setStoredRefreshToken(token) {
  if (token) localStorage.setItem(ADMIN_REFRESH_STORAGE_KEY, token)
  else localStorage.removeItem(ADMIN_REFRESH_STORAGE_KEY)
}

export function clearAdminTokens() {
  accessToken = null
  try {
    localStorage.removeItem(ADMIN_ACCESS_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  setStoredRefreshToken(null)
}

async function refreshAdminSession() {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) throw new Error('No refresh token')

  const res = await fetch(`${API_BASE_URL}/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) throw new Error('Refresh failed')

  const data = await res.json()
  if (data.accessToken) setAccessToken(data.accessToken)
  if (data.refreshToken) setStoredRefreshToken(data.refreshToken)
  return data
}

async function ensureFreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = refreshAdminSession().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function fetchWithAuth(path, options = {}, { retryOn401 = true } = {}) {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && retryOn401 && getStoredRefreshToken()) {
    try {
      await ensureFreshAccessToken()
      const retryHeaders = new Headers(options.headers)
      if (!retryHeaders.has('Content-Type') && options.body && typeof options.body === 'string') {
        retryHeaders.set('Content-Type', 'application/json')
      }
      const retryToken = getAccessToken()
      if (retryToken) {
        retryHeaders.set('Authorization', `Bearer ${retryToken}`)
      }
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: retryHeaders })
    } catch {
      clearAdminTokens()
    }
  }

  return res
}

export async function apiGet(path, options = {}) {
  const res = await fetchWithAuth(path, { method: 'GET', ...options })
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function apiPost(path, body, options = {}) {
  const res = await fetchWithAuth(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function apiPatch(path, body, options = {}) {
  const res = await fetchWithAuth(path, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function apiDelete(path, options = {}) {
  const res = await fetchWithAuth(path, {
    ...options,
    method: 'DELETE',
  })
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}

export { API_BASE_URL }
