import { useCallback, useEffect, useMemo, useState } from 'react'
import { MoreHorizontal, Plus, UserPlus } from 'lucide-react'
import { PageHead } from '../../components/PageHead'
import { adminTokens } from '../../theme/tokens'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../services/apiClient'
import { ROLE_PRESETS, formatRoleLabel, isSuperAdmin } from '../../config/adminPermissions'
import { MemberFormModal } from './MemberFormModal'

function maskEmail(email) {
  if (!email) return '—'
  const [local, domain] = email.split('@')
  if (!domain) return email
  const maskedLocal = local.length <= 2 ? `${local[0] || ''}••` : `${local.slice(0, 2)}•••`
  return `${maskedLocal}@${domain}`
}

function formatLastActive(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function Avatar({ name, seed = 0, size = 32 }) {
  const letters = (name || '?').split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  const hue = Math.abs(seed) % 360
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, oklch(0.65 0.11 ${hue}), oklch(0.45 0.11 ${hue + 60}))`,
      }}
    >
      {letters}
    </span>
  )
}

function hashId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i) * (i + 1)) % 360
  return hash
}

const FILTERS = [
  ['all', 'All'],
  ...Object.entries(ROLE_PRESETS).map(([key, preset]) => [key, preset.label]),
  ['super_admin', 'Super admin'],
]

export function TeamPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet('/admin/team')
      setMembers(data.members || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const filteredMembers = useMemo(() => {
    if (filter === 'all') return members
    if (filter === 'super_admin') return members.filter((member) => member.role === 'super_admin')
    return members.filter((member) => member.teamRolePreset === filter)
  }, [filter, members])

  const activeCount = members.filter((member) => member.isActive).length

  const openCreate = () => {
    setEditingMember(null)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (member) => {
    setEditingMember(member)
    setFormError('')
    setModalOpen(true)
    setMenuOpenId(null)
  }

  const handleSave = async (payload) => {
    setSaving(true)
    setFormError('')
    try {
      if (editingMember) {
        const body = {
          name: payload.name,
          teamRolePreset: payload.teamRolePreset,
          tabPermissions: payload.tabPermissions,
        }
        if (payload.password) body.password = payload.password
        await apiPatch(`/admin/team/${editingMember.id}`, body)
      } else {
        await apiPost('/admin/team', payload)
      }
      setModalOpen(false)
      setEditingMember(null)
      await loadMembers()
    } catch (err) {
      setFormError(err.message || 'Failed to save member')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (member) => {
    setMenuOpenId(null)
    try {
      if (member.isActive) {
        await apiDelete(`/admin/team/${member.id}`)
      } else {
        await apiPatch(`/admin/team/${member.id}`, { isActive: true })
      }
      await loadMembers()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <PageHead
        title="Team"
        sub={`${members.length} members · ${activeCount} active`}
        actions={(
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg bg-[oklch(0.72_0.15_25)] px-3 py-2 text-sm font-semibold text-[oklch(0.18_0.04_25)]"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Add member
          </button>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Members', members.length],
          ['Active', activeCount],
          ['Suspended', members.length - activeCount],
          ['With 2FA', members.filter((member) => member.totpEnabled).length],
        ].map(([label, value]) => (
          <div key={label} className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} p-4`}>
            <div className={`text-[11px] uppercase tracking-[0.12em] ${adminTokens.textMute}`}>{label}</div>
            <div className={`mt-1 text-2xl font-semibold ${adminTokens.text}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev}`}>
        <div className={`flex flex-wrap items-center gap-2 border-b ${adminTokens.borderSoft} p-3`}>
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-3 py-1 text-xs ${
                filter === key
                  ? 'bg-[oklch(0.72_0.15_25_/_0.14)] text-[oklch(0.72_0.15_25)]'
                  : `${adminTokens.bgElev2} ${adminTokens.textDim}`
              }`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={`border-b ${adminTokens.borderSoft} text-left ${adminTokens.textMute}`}>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tabs</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium w-12" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className={`px-4 py-8 text-center ${adminTokens.textDim}`}>Loading team members…</td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`px-4 py-8 text-center ${adminTokens.textDim}`}>No members found.</td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const roleLabel = isSuperAdmin(member)
                    ? 'Super admin'
                    : ROLE_PRESETS[member.teamRolePreset]?.label || formatRoleLabel(member)
                  const canManage = !isSuperAdmin(member)

                  return (
                    <tr key={member.id} className={`border-b ${adminTokens.borderSoft} last:border-b-0`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.name} seed={hashId(member.id)} />
                          <div>
                            <div className={`font-medium ${adminTokens.text}`}>{member.name}</div>
                            <div className={`font-mono text-xs ${adminTokens.textMute}`}>{maskEmail(member.email)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[oklch(0.72_0.15_25_/_0.14)] px-2 py-0.5 text-xs text-[oklch(0.72_0.15_25)]">
                          {roleLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          member.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {member.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${adminTokens.textDim}`}>
                        {isSuperAdmin(member) ? 'All tabs' : `${member.tabPermissions?.length || 0} tabs`}
                      </td>
                      <td className={`px-4 py-3 font-mono text-xs ${adminTokens.textMute}`}>
                        {formatLastActive(member.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="relative">
                            <button
                              type="button"
                              className={`grid h-8 w-8 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.textDim}`}
                              onClick={() => setMenuOpenId((current) => (current === member.id ? null : member.id))}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpenId === member.id ? (
                              <div className={`absolute right-0 top-9 z-20 min-w-[160px] rounded-lg border ${adminTokens.borderStrong} ${adminTokens.bgElev} p-1 shadow-xl`}>
                                <button
                                  type="button"
                                  className={`block w-full rounded-md px-3 py-2 text-left text-sm ${adminTokens.text} hover:bg-[oklch(0.26_0.014_260)]`}
                                  onClick={() => openEdit(member)}
                                >
                                  Edit member
                                </button>
                                <button
                                  type="button"
                                  className={`block w-full rounded-md px-3 py-2 text-left text-sm ${adminTokens.text} hover:bg-[oklch(0.26_0.014_260)]`}
                                  onClick={() => toggleActive(member)}
                                >
                                  {member.isActive ? 'Suspend' : 'Reactivate'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className={`text-xs ${adminTokens.textMute}`}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && members.length === 1 ? (
        <div className={`mt-4 flex items-center gap-2 rounded-xl border ${adminTokens.borderSoft} ${adminTokens.bgElev} px-4 py-3 text-sm ${adminTokens.textDim}`}>
          <UserPlus className="h-4 w-4" />
          Add your first team member to grant scoped admin access.
        </div>
      ) : null}

      <MemberFormModal
        open={modalOpen}
        member={editingMember}
        onClose={() => {
          setModalOpen(false)
          setEditingMember(null)
          setFormError('')
        }}
        onSave={handleSave}
        saving={saving}
        error={formError}
      />
    </div>
  )
}
