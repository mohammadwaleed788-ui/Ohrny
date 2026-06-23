import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { adminTokens } from '../../theme/tokens'
import {
  ADMIN_TABS,
  ROLE_PRESET_KEYS,
  ROLE_PRESETS,
  TAB_LABELS,
  TEAM_MANAGEMENT_TAB,
} from '../../config/adminPermissions'

const ASSIGNABLE_TABS = ADMIN_TABS.filter((tab) => tab !== TEAM_MANAGEMENT_TAB)

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  teamRolePreset: 'moderator',
  tabPermissions: [...ROLE_PRESETS.moderator.defaultTabs],
}

export function MemberFormModal({ open, member, onClose, onSave, saving, error }) {
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!open) return
    if (member) {
      setForm({
        name: member.name || '',
        email: member.email || '',
        password: '',
        teamRolePreset: member.teamRolePreset || 'moderator',
        tabPermissions: member.tabPermissions || [...ROLE_PRESETS.moderator.defaultTabs],
      })
      return
    }
    setForm(EMPTY_FORM)
  }, [open, member])

  const disableSave = useMemo(
    () => saving || !form.name.trim() || !form.email.trim() || form.tabPermissions.length === 0,
    [form.email, form.name, form.tabPermissions.length, saving],
  )

  if (!open) return null

  const selectPreset = (presetKey) => {
    setForm((current) => ({
      ...current,
      teamRolePreset: presetKey,
      tabPermissions: [...ROLE_PRESETS[presetKey].defaultTabs],
    }))
  }

  const toggleTab = (tabId) => {
    setForm((current) => {
      const hasTab = current.tabPermissions.includes(tabId)
      const tabPermissions = hasTab
        ? current.tabPermissions.filter((tab) => tab !== tabId)
        : [...current.tabPermissions, tabId]
      return { ...current, tabPermissions }
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      teamRolePreset: form.teamRolePreset,
      tabPermissions: form.tabPermissions,
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border ${adminTokens.borderStrong} ${adminTokens.bgElev} shadow-2xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className={`flex items-center justify-between border-b ${adminTokens.borderSoft} px-5 py-4`}>
          <h2 className={`text-base font-semibold ${adminTokens.text}`}>
            {member ? 'Edit team member' : 'Add team member'}
          </h2>
          <button
            type="button"
            className={`grid h-8 w-8 place-items-center rounded-md border ${adminTokens.borderSoft} ${adminTokens.textDim} hover:bg-[oklch(0.26_0.014_260)]`}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="max-h-[80vh] overflow-y-auto p-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={`w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2.5 text-sm ${adminTokens.text}`}
                required
              />
            </label>

            <label className="block space-y-1">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Work email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                disabled={Boolean(member)}
                className={`w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2.5 text-sm ${adminTokens.text} disabled:opacity-60`}
                required
              />
            </label>

            <label className="block space-y-1">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>
                {member ? 'New password (optional)' : 'Password'}
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className={`w-full rounded-lg border ${adminTokens.borderSoft} ${adminTokens.bgElev2} px-3 py-2.5 text-sm ${adminTokens.text}`}
                required={!member}
                minLength={8}
                autoComplete={member ? 'new-password' : 'new-password'}
              />
            </label>

            <div>
              <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Role preset</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_PRESET_KEYS.map((presetKey) => {
                  const preset = ROLE_PRESETS[presetKey]
                  const selected = form.teamRolePreset === presetKey
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-left ${
                        selected
                          ? 'border-[oklch(0.72_0.15_25)] bg-[oklch(0.72_0.15_25_/_0.12)]'
                          : `${adminTokens.borderSoft} ${adminTokens.bgElev2} hover:bg-[oklch(0.26_0.014_260)]`
                      }`}
                      onClick={() => selectPreset(presetKey)}
                    >
                      <div className={`text-sm font-medium ${adminTokens.text}`}>{preset.label}</div>
                      <div className={`text-xs ${adminTokens.textMute}`}>{preset.description}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${adminTokens.textMute}`}>Tab access</p>
              <div className="grid grid-cols-2 gap-2">
                {ASSIGNABLE_TABS.map((tabId) => {
                  const checked = form.tabPermissions.includes(tabId)
                  return (
                    <label
                      key={tabId}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${adminTokens.borderSoft} ${adminTokens.bgElev2}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTab(tabId)}
                      />
                      <span className={`text-sm ${adminTokens.text}`}>{TAB_LABELS[tabId] || tabId}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {error ? (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
            ) : null}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className={`rounded-lg border ${adminTokens.borderSoft} px-4 py-2 text-sm ${adminTokens.textDim}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disableSave}
              className="rounded-lg bg-[oklch(0.72_0.15_25)] px-4 py-2 text-sm font-semibold text-[oklch(0.18_0.04_25)] disabled:opacity-60"
            >
              {saving ? 'Saving…' : member ? 'Save changes' : 'Create member'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
