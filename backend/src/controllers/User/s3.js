import { generateS3Key, generateSignedUploadUrl } from '../../utils/s3.js'

function extensionFrom(fileName = '', fileType = '') {
  const fromName = String(fileName).includes('.') ? String(fileName).split('.').pop() : ''
  if (fromName) return fromName
  const fromType = String(fileType).split('/')[1]
  return fromType || 'jpg'
}

export async function generateSignedUrlForUserImage(req, res) {
  try {
    const { fileName, fileType } = req.body || {}
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'Missing file details' })
    }
    if (!String(fileType).startsWith('image/')) {
      return res.status(400).json({ error: 'Only image uploads are allowed' })
    }

    const ext = extensionFrom(fileName, fileType)
    const fileKey = generateS3Key(`users/${req.user.id}/images`, ext)
    const uploadUrl = await generateSignedUploadUrl(fileKey, fileType)

    return res.json({
      uploadUrl,
      fileKey,
    })
  } catch (error) {
    console.error('Error generating signed URL for user image:', error)
    return res.status(500).json({ error: 'Failed to generate signed URL' })
  }
}
