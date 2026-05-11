import {
  OTP_PROVIDER,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID,
} from '../../config/constants.js'
import { sendVerification, checkVerification } from './twilioVerify.js'

function hasTwilioConfig() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID)
}

export function resolveOtpProvider() {
  const env = String(process.env.NODE_ENV || '').trim().toLowerCase()
  const inProduction = env === 'production'

  if (OTP_PROVIDER === 'twilio') {
    if (!hasTwilioConfig()) {
      throw { status: 500, error: 'OTP provider not configured' }
    }
    return 'twilio'
  }

  if (OTP_PROVIDER === 'mock') {
    if (inProduction) {
      throw { status: 500, error: 'OTP provider not configured' }
    }
    return 'mock'
  }

  if (hasTwilioConfig()) return 'twilio'
  if (!inProduction) return 'mock'
  throw { status: 500, error: 'OTP provider not configured' }
}

export async function sendOtpWithProvider(provider, phoneE164) {
  if (provider === 'twilio') {
    await sendVerification(phoneE164)
  }
}

export async function verifyOtpWithProvider(provider, phoneE164, code) {
  if (provider === 'twilio') {
    await checkVerification(phoneE164, code)
  }
}
