import { parsePhoneNumberFromString } from 'libphonenumber-js'

export function normalizePhoneE164(phoneCountry, phone) {
  const country = String(phoneCountry || '+1').trim()
  const withPlus = country.startsWith('+') ? country : `+${country}`
  const digits = String(phone || '').replace(/\D/g, '')
  const raw = `${withPlus}${digits}`
  const parsed = parsePhoneNumberFromString(raw)

  if (!parsed || !parsed.isValid()) {
    return null
  }

  return {
    phoneE164: parsed.number,
    phoneCountry: `+${parsed.countryCallingCode}`,
    phone: parsed.nationalNumber,
  }
}
