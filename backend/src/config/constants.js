import 'dotenv/config'

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

export const PORT = Number(process.env.PORT) || 5000
export const DATABASE_URL = process.env.DATABASE_URL
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-me-jwt-secret'
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m'
export const REFRESH_TOKEN_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS) || sevenDaysMs
export const TOTP_STEP_TOKEN_TTL = process.env.TOTP_STEP_TOKEN_TTL || '5m'
export const S3_REGION = process.env.S3_REGION || 'us-east-1'
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || ''
export const S3_UPLOAD_URL_EXPIRES_SEC = Number(process.env.S3_UPLOAD_URL_EXPIRES_SEC) || 300
export const OTP_PROVIDER = String(process.env.OTP_PROVIDER || '').trim().toLowerCase()
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
export const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || ''
export const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || ''
