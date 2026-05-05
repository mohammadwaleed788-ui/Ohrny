import jwt from 'jsonwebtoken'
import { ACCESS_TOKEN_TTL, JWT_SECRET, TOTP_STEP_TOKEN_TTL } from '../config/constants.js'

export function signAccessTokenAdmin(payload) {
  return jwt.sign(
    { type: 'admin', sub: payload.id, email: payload.email, role: payload.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  )
}

export function signAccessTokenUser(payload) {
  return jwt.sign(
    { type: 'user', sub: payload.id, handle: payload.handle },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  )
}

/** Short-lived token to complete TOTP after password check */
export function signTotpStepToken(adminId) {
  return jwt.sign(
    { type: 'admin_totp', sub: adminId },
    JWT_SECRET,
    { expiresIn: TOTP_STEP_TOKEN_TTL },
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function verifyTotpStepToken(token) {
  const payload = jwt.verify(token, JWT_SECRET)
  if (payload.type !== 'admin_totp') {
    const err = new Error('Invalid step token')
    err.statusCode = 401
    throw err
  }
  return payload
}
