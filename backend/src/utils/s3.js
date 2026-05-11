import crypto from 'crypto'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  S3_BUCKET_NAME,
  S3_REGION,
  S3_UPLOAD_URL_EXPIRES_SEC,
} from '../config/constants.js'

const s3 = new S3Client({ region: S3_REGION })

export function generateS3Key(prefix = 'users/images', extension = 'jpg') {
  const ext = String(extension || 'jpg').toLowerCase()
  return `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`
}

export async function generateSignedUploadUrl(key, contentType, expiresIn = S3_UPLOAD_URL_EXPIRES_SEC) {
  if (!S3_BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not configured')
  }
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

export async function deleteS3Object(key) {
  if (!S3_BUCKET_NAME) throw new Error('S3_BUCKET_NAME is not configured')
  const command = new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key })
  return s3.send(command)
}
