import 'dotenv/config'

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

export const PORT = Number(process.env.PORT) || 5000
export const DATABASE_URL = process.env.DATABASE_URL
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-me-jwt-secret'
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m'
export const REFRESH_TOKEN_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS) || sevenDaysMs
export const TOTP_STEP_TOKEN_TTL = process.env.TOTP_STEP_TOKEN_TTL || '5m'
