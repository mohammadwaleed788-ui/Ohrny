import jwt from 'jsonwebtoken'
import { ACCESS_TOKEN_TTL, JWT_SECRET, REFRESH_TOKEN_TTL_MS, TOTP_STEP_TOKEN_TTL } from '../config/constants.js'

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

function refreshTokenExpirySeconds() {
  return Math.max(1, Math.floor(REFRESH_TOKEN_TTL_MS / 1000))
}

export function signRefreshTokenUser(payload) {
  return jwt.sign(
    { type: 'user_refresh', sub: payload.id, handle: payload.handle },
    JWT_SECRET,
    { expiresIn: refreshTokenExpirySeconds() },
  )
}

export function signRefreshTokenAdmin(payload) {
  return jwt.sign(
    { type: 'admin_refresh', sub: payload.id, email: payload.email, role: payload.role },
    JWT_SECRET,
    { expiresIn: refreshTokenExpirySeconds() },
  )
}

export function signUserSignupToken(payload) {
  return jwt.sign(
    {
      type: 'user_signup',
      phone: payload.phone,
      phoneCountry: payload.phoneCountry,
      verificationId: payload.verificationId,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
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

export function verifyUserRefreshToken(token) {
  const payload = jwt.verify(token, JWT_SECRET)
  if (payload.type !== 'user_refresh') {
    const err = new Error('Invalid refresh token')
    err.statusCode = 401
    throw err
  }
  return payload
}

export function verifyAdminRefreshToken(token) {
  const payload = jwt.verify(token, JWT_SECRET)
  if (payload.type !== 'admin_refresh') {
    const err = new Error('Invalid refresh token')
    err.statusCode = 401
    throw err
  }
  return payload
}

export function verifyUserSignupToken(token) {
  const payload = jwt.verify(token, JWT_SECRET)
  if (payload.type !== 'user_signup') {
    const err = new Error('Invalid signup token')
    err.statusCode = 401
    throw err
  }
  return payload
}
