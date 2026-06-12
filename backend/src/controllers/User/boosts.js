import { activateBoost, cancelBoost } from '../../services/entitlementService.js'

export async function activateUserBoost(req, res) {
  try {
    const result = await activateBoost(req.user.id)
    if (!result.ok) return res.status(result.status || 400).json(result.body)
    return res.json({ ok: true, boost: result.boost })
  } catch (err) {
    console.error('activateUserBoost error:', err)
    return res.status(500).json({ error: 'Failed to activate boost' })
  }
}

export async function cancelUserBoost(req, res) {
  try {
    const result = await cancelBoost(req.user.id)
    if (!result.ok) return res.status(result.status || 400).json(result.body)
    return res.json({ ok: true, boostsLeft: result.boostsLeft })
  } catch (err) {
    console.error('cancelUserBoost error:', err)
    return res.status(500).json({ error: 'Failed to cancel boost' })
  }
}
