import rateLimit from 'express-rate-limit'

const routesWithDedicatedLimiters = new Set([
  '/api/admin/auth/login',
  '/api/admin/auth/verify-totp',
  '/api/admin/auth/refresh',
  '/api/user/auth/send-otp',
  '/api/user/auth/verify-otp',
  '/api/user/auth/refresh',
  '/api/user/auth/check-handle',
])

export const globalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  skip: (req) => routesWithDedicatedLimiters.has(req.path),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests' },
})

export const authLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts' },
})

export const refreshLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many refresh requests' },
})

export const checkHandleLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many handle checks' },
})
