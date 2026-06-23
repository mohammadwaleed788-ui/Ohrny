import bcrypt from 'bcrypt'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { adminUsers } from '../../../db/schema/admin.js'
import {
  ROLE_PRESET_KEYS,
  ROLE_PRESETS,
  resolvePresetBackendRole,
  resolveTabsForAdmin,
  validateAssignableTabs,
} from '../../config/adminPermissions.js'

const MIN_PASSWORD_LENGTH = 8

function serializeMember(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    teamRolePreset: row.teamRolePreset ?? null,
    tabPermissions: resolveTabsForAdmin(row),
    isActive: row.isActive,
    totpEnabled: row.totpEnabled,
    lastLoginAt: row.lastLoginAt,
    lastLoginIp: row.lastLoginIp,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function validatePassword(password) {
  const value = String(password || '')
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
  }
  return { ok: true, value }
}

function validatePreset(presetKey) {
  if (!ROLE_PRESET_KEYS.includes(presetKey)) {
    return { ok: false, error: 'Invalid role preset' }
  }
  return { ok: true, presetKey }
}

async function countActiveSuperAdmins(excludeId = null) {
  const conditions = [eq(adminUsers.role, 'super_admin'), eq(adminUsers.isActive, true)]
  if (excludeId) conditions.push(ne(adminUsers.id, excludeId))
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(adminUsers)
    .where(and(...conditions))
  return Number(row?.count || 0)
}

export async function listTeamMembers(req, res) {
  try {
    const rows = await db
      .select()
      .from(adminUsers)
      .orderBy(adminUsers.createdAt)

    return res.json({
      members: rows.map(serializeMember),
      presets: ROLE_PRESETS,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load team members' })
  }
}

export async function createTeamMember(req, res) {
  try {
    const { name, email, password, teamRolePreset, tabPermissions } = req.body || {}

    if (!name || !email || !password || !teamRolePreset) {
      return res.status(400).json({ error: 'Name, email, password, and role preset are required' })
    }

    const presetCheck = validatePreset(teamRolePreset)
    if (!presetCheck.ok) return res.status(400).json({ error: presetCheck.error })

    const passwordCheck = validatePassword(password)
    if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error })

    const tabsCheck = validateAssignableTabs(tabPermissions)
    if (!tabsCheck.ok) return res.status(400).json({ error: tabsCheck.error })

    const normalizedEmail = String(email).trim().toLowerCase()
    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, normalizedEmail))
      .limit(1)

    if (existing) {
      return res.status(409).json({ error: 'Email already in use' })
    }

    const backendRole = resolvePresetBackendRole(teamRolePreset)
    const passwordHash = await bcrypt.hash(passwordCheck.value, 10)

    const [created] = await db
      .insert(adminUsers)
      .values({
        name: String(name).trim().slice(0, 80),
        email: normalizedEmail,
        passwordHash,
        role: backendRole,
        teamRolePreset,
        tabPermissions: tabsCheck.tabs,
        totpEnabled: false,
      })
      .returning()

    return res.status(201).json({ member: serializeMember(created) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to create team member' })
  }
}

export async function updateTeamMember(req, res) {
  try {
    const { id } = req.params
    const { name, password, teamRolePreset, tabPermissions, isActive } = req.body || {}

    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)
    if (!row) return res.status(404).json({ error: 'Member not found' })

    if (row.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin accounts cannot be edited from team management' })
    }

    const updates = { updatedAt: new Date() }

    if (name !== undefined) {
      const trimmed = String(name).trim()
      if (!trimmed) return res.status(400).json({ error: 'Name is required' })
      updates.name = trimmed.slice(0, 80)
    }

    if (teamRolePreset !== undefined) {
      const presetCheck = validatePreset(teamRolePreset)
      if (!presetCheck.ok) return res.status(400).json({ error: presetCheck.error })
      updates.teamRolePreset = teamRolePreset
      updates.role = resolvePresetBackendRole(teamRolePreset)
    }

    if (tabPermissions !== undefined) {
      const tabsCheck = validateAssignableTabs(tabPermissions)
      if (!tabsCheck.ok) return res.status(400).json({ error: tabsCheck.error })
      updates.tabPermissions = tabsCheck.tabs
    }

    if (password !== undefined && String(password).length > 0) {
      const passwordCheck = validatePassword(password)
      if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error })
      updates.passwordHash = await bcrypt.hash(passwordCheck.value, 10)
    }

    if (isActive !== undefined) {
      if (id === req.admin.id && isActive === false) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' })
      }
      updates.isActive = Boolean(isActive)
    }

    const [updated] = await db
      .update(adminUsers)
      .set(updates)
      .where(eq(adminUsers.id, id))
      .returning()

    return res.json({ member: serializeMember(updated) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update team member' })
  }
}

export async function deactivateTeamMember(req, res) {
  try {
    const { id } = req.params

    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)
    if (!row) return res.status(404).json({ error: 'Member not found' })

    if (row.role === 'super_admin') {
      const activeSuperAdmins = await countActiveSuperAdmins(id)
      if (activeSuperAdmins === 0) {
        return res.status(400).json({ error: 'Cannot deactivate the last active super admin' })
      }
      return res.status(403).json({ error: 'Super admin accounts cannot be deactivated from team management' })
    }

    if (id === req.admin.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' })
    }

    const [updated] = await db
      .update(adminUsers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning()

    return res.json({ member: serializeMember(updated) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to deactivate team member' })
  }
}
