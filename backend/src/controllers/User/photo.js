import { eq, and } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { userPhotos } from '../../../db/schema/users.js'
import { deleteS3Object } from '../../utils/s3.js'
import { recomputeProfileCompletion } from '../../services/profileCompletion.js'

export async function deletePhoto(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'Photo ID required' })

    const [photo] = await db
      .select()
      .from(userPhotos)
      .where(and(eq(userPhotos.id, id), eq(userPhotos.userId, userId)))
      .limit(1)

    if (!photo) return res.status(404).json({ error: 'Photo not found' })

    // Delete from S3 first (best-effort — don't block if it fails)
    try {
      await deleteS3Object(photo.storageKey)
    } catch (s3Err) {
      console.warn('S3 delete warning (non-fatal):', s3Err?.message)
    }

    // Hard delete from DB
    await db
      .delete(userPhotos)
      .where(and(eq(userPhotos.id, id), eq(userPhotos.userId, userId)))

    // Fewer photos → lower completion; keep the badge/filter accurate.
    await recomputeProfileCompletion(userId)

    return res.json({ success: true })
  } catch (err) {
    console.error('deletePhoto error:', err)
    return res.status(500).json({ error: 'Failed to delete photo' })
  }
}
