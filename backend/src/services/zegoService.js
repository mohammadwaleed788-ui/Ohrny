import crypto from 'crypto'

const ZEGO_APP_ID = parseInt(process.env.ZEGO_APP_ID, 10)
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET

// ── Official ZegoCloud Token04 algorithm ──────────────────────────────────────
// Reference: https://github.com/ZEGOCLOUD/zego_server_assistant
// The token is AES-256-CBC encrypted JSON, NOT HMAC. ZegoCloud rejects HMAC tokens.

function makeNonce() {
  // random signed 32-bit int
  return Math.floor(Math.random() * (2147483647 - -2147483648 + 1)) + -2147483648
}

function makeRandomIv() {
  const chars =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function getAlgorithm(secret) {
  switch (secret.length) {
    case 16:
      return 'aes-128-cbc'
    case 24:
      return 'aes-192-cbc'
    case 32:
      return 'aes-256-cbc'
    default:
      throw new Error(`Invalid ServerSecret length: ${secret.length} (must be 16/24/32)`)
  }
}

function aesEncrypt(plainText, secret, iv) {
  const cipher = crypto.createCipheriv(getAlgorithm(secret), secret, iv)
  cipher.setAutoPadding(true)
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
}

/**
 * Generates a ZegoCloud Token04.
 * Binary layout (base64-encoded, prefixed with "04"):
 *   [expire: int64 BE][ivLen: int16 BE][iv][encLen: int16 BE][encrypted JSON]
 */
export function generateZegoToken(userId, effectiveSeconds = 3600, payload = '') {
  if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
    throw new Error('ZEGO_APP_ID or ZEGO_SERVER_SECRET not configured in .env')
  }

  const createTime = Math.floor(Date.now() / 1000)
  const expire = createTime + effectiveSeconds

  const tokenInfo = {
    app_id: ZEGO_APP_ID,
    user_id: String(userId),
    nonce: makeNonce(),
    ctime: createTime,
    expire,
    payload: payload || '',
  }

  const plaintext = JSON.stringify(tokenInfo)
  const iv = makeRandomIv()
  const encryptBuf = aesEncrypt(plaintext, ZEGO_SERVER_SECRET, iv)

  // Pack the binary structure
  const expireBuf = Buffer.alloc(8)
  expireBuf.writeBigInt64BE(BigInt(expire), 0)

  const ivLenBuf = Buffer.alloc(2)
  ivLenBuf.writeInt16BE(iv.length, 0)

  const encLenBuf = Buffer.alloc(2)
  encLenBuf.writeInt16BE(encryptBuf.length, 0)

  const packed = Buffer.concat([
    expireBuf,
    ivLenBuf,
    Buffer.from(iv, 'utf8'),
    encLenBuf,
    encryptBuf,
  ])

  return '04' + packed.toString('base64')
}

export { ZEGO_APP_ID }
