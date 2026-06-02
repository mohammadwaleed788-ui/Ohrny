import crypto from 'crypto'

const ZEGO_APP_ID = parseInt(process.env.ZEGO_APP_ID, 10)
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET

/**
 * Generates a ZegoCloud Token04 for a user.
 * See: https://www.zegocloud.com/docs/authentication-and-kit-token
 */
export function generateZegoToken(userId, effectiveSeconds = 3600, payload = '') {
  if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
    throw new Error('ZEGO_APP_ID or ZEGO_SERVER_SECRET not configured in .env')
  }

  const createTime = Math.floor(Date.now() / 1000)

  const tokenInfo = {
    app_id: ZEGO_APP_ID,
    user_id: String(userId),
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: createTime,
    expire: createTime + effectiveSeconds,
    payload,
  }

  const tokenInfoStr = JSON.stringify(tokenInfo)

  const hmac = crypto.createHmac('sha256', ZEGO_SERVER_SECRET)
  hmac.update(tokenInfoStr)
  const mac = hmac.digest()

  const infoBytes = Buffer.from(tokenInfoStr, 'utf8')
  const buf = Buffer.allocUnsafe(4 + mac.length + 4 + infoBytes.length)

  let offset = 0
  buf.writeUInt32BE(mac.length, offset); offset += 4
  mac.copy(buf, offset);               offset += mac.length
  buf.writeUInt32BE(infoBytes.length, offset); offset += 4
  infoBytes.copy(buf, offset)

  return '04' + buf.toString('base64')
}

export { ZEGO_APP_ID }
