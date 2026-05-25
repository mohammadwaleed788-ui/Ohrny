import { API_BASE_URL, getAccessToken } from '../../services/apiClient'

async function request(path, options = {}, token = getAccessToken()) {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
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

export function adminGet(path) {
  return request(path)
}

export function adminPost(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
}

export function adminPatch(path, body) {
  return request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
}

export function userGet(path, token) {
  return request(path, { method: 'GET' }, token)
}

export function userPost(path, body, token) {
  return request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }, token)
}

export function userPatch(path, body, token) {
  return request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }, token)
}

