import crypto from 'crypto'

export function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateOpaqueRefreshToken() {
  return crypto.randomBytes(32).toString('base64url')
}
