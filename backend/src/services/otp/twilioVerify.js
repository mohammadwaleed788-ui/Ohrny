import twilio from 'twilio'
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID,
} from '../../config/constants.js'

let client = null

function getClient() {
  if (!client) {
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  }
  return client
}

function mapTwilioSendError(err) {
  const status = Number(err?.status) || 500
  if (status === 429) return { status: 429, error: 'Too many attempts, try later' }
  if (status >= 400 && status < 500) return { status: 500, error: 'Failed to send code' }
  return { status: 500, error: 'Failed to send code' }
}

function mapTwilioCheckError(err) {
  const status = Number(err?.status) || 500
  if (status === 429) return { status: 429, error: 'Too many attempts, try later' }
  if (status >= 400 && status < 500) return { status: 401, error: 'Invalid code' }
  return { status: 500, error: 'Verification failed' }
}

export async function sendVerification(phoneE164) {
  try {
    const api = getClient()
    await api.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({
      to: phoneE164,
      channel: 'sms',
    })
  } catch (err) {
    throw mapTwilioSendError(err)
  }
}

export async function checkVerification(phoneE164, code) {
  try {
    const api = getClient()
    const result = await api.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({
      to: phoneE164,
      code: String(code).trim(),
    })

    if (result?.status !== 'approved') {
      throw { status: 401, error: 'Invalid code' }
    }
  } catch (err) {
    if (err?.status && err?.error) throw err
    throw mapTwilioCheckError(err)
  }
}
