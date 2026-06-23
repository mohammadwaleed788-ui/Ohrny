import { API_BASE_URL, apiGet, apiPatch, apiPost } from '../../../services/apiClient'

async function request(path, options = {}, token) {
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
  return apiGet(path)
}

export function adminPost(path, body) {
  return apiPost(path, body)
}

export function adminPatch(path, body) {
  return apiPatch(path, body)
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

export async function userUploadImage(file, token) {
  const headers = new Headers({
    'Content-Type': file.type || 'image/jpeg',
    'X-File-Name': file.name || 'upload.jpg',
  })
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE_URL}/user/s3/upload-image`, {
    method: 'POST',
    headers,
    body: file,
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
