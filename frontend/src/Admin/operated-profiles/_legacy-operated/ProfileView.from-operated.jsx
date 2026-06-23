import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, Eye, Loader2, Plus, X } from 'lucide-react'
import { Button, Chip } from './operatedStyles.jsx'
import { avatarGradient, op } from './operatedTheme'
import { userUploadImage } from './operatedApi'

function Field({ label, children }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-[0.08em] text-[oklch(0.55_0.01_260)]">
      {label}
      {children}
    </label>
  )
}

const inputClass = `rounded-md border ${op.borderSoft} ${op.bgMain} px-3 py-2 text-sm normal-case tracking-normal ${op.text} outline-none`
const s3PublicBaseUrl = (import.meta.env.VITE_S3_PUBLIC_BASE_URL || 'https://ohrny-storage.s3.us-east-1.amazonaws.com').replace(/\/+$/, '')

function photoUrlFromKey(storageKey) {
  if (!storageKey) return ''
  if (/^https?:\/\//i.test(storageKey)) return storageKey
  return `${s3PublicBaseUrl}/${String(storageKey).replace(/^\/+/, '')}`
}

function photoSrc(photo) {
  if (photo?.url) return photo.url
  return photoUrlFromKey(photo?.storageKey)
}

function normalizedBlur(photo) {
  if (!photo?.isBlurred) return 0
  const value = Number(photo?.blurAmount)
  if (!Number.isFinite(value)) return 70
  return Math.max(0, Math.min(100, value))
}

export function ProfileView({ persona, onSave, userToken }) {
  const [draft, setDraft] = useState(persona)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const replaceAtRef = useRef(null)

  useEffect(() => {
    setDraft(persona)
    setError('')
  }, [persona])

  const interests = Array.isArray(draft.interests) ? draft.interests : []
  const photosList = useMemo(() => {
    if (!Array.isArray(draft.photosList)) return []
    return [...draft.photosList]
      .filter((photo) => photo?.storageKey && String(photo.storageKey).trim())
      .sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))
      .slice(0, 6)
  }, [draft.photosList])
  const photoCount = photosList.length
  const hue = Number.isFinite(Number(draft.hue)) ? Number(draft.hue) : 12
  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))
  const removeInterest = (interest) => set('interests', interests.filter((item) => item !== interest))
  const sharedBlurEnabled = Boolean(photosList[0]?.isBlurred)
  const sharedBlurAmount = sharedBlurEnabled ? normalizedBlur(photosList[0]) : 0
  const applyPhotos = (nextPhotos) => {
    const withKeys = nextPhotos.filter((photo) => photo?.storageKey && String(photo.storageKey).trim())
    setDraft((prev) => ({
      ...prev,
      photosList: withKeys.map((photo, index) => ({
        ...photo,
        position: index + 1,
        isMain: index === 0,
      })),
      photos: withKeys.length,
    }))
  }
  const applyBlurToAllPhotos = (isBlurred, blurAmount = 0) => {
    applyPhotos(photosList.map((photo) => ({
      ...photo,
      isBlurred,
      blurAmount: isBlurred ? Math.max(0, Math.min(100, Number(blurAmount) || 0)) : 0,
    })))
  }

  const triggerPhotoPicker = (replaceAt = null) => {
    replaceAtRef.current = replaceAt
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const uploadFiles = async (files) => {
    const list = Array.from(files || [])
    if (!list.length) return

    const startIndex = Number.isInteger(replaceAtRef.current) ? replaceAtRef.current : photosList.length
    const maxAllowed = Math.max(0, 6 - startIndex)
    if (maxAllowed <= 0) {
      setError('You can upload up to 6 photos.')
      return
    }

    const queue = list.slice(0, maxAllowed)
    const nextPhotos = [...photosList]
    setUploading(true)
    setError('')
    try {
      for (let index = 0; index < queue.length; index += 1) {
        const file = queue[index]
        const { fileKey } = await userUploadImage(file, userToken)

        const position = startIndex + index
        nextPhotos[position] = {
          ...(nextPhotos[position] || {}),
          storageKey: fileKey,
          blurAmount: sharedBlurEnabled ? sharedBlurAmount : 0,
          isBlurred: sharedBlurEnabled,
        }
      }
      applyPhotos(nextPhotos)
    } catch (err) {
      setError(err.message || 'Image upload failed')
    } finally {
      setUploading(false)
      replaceAtRef.current = null
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(draft)
    } catch (err) {
      setError(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`grid h-full min-h-0 flex-1 grid-cols-[1fr_320px] gap-4 overflow-y-auto p-4 ${op.scrollbar}`}>
      <div className="space-y-4">
        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Identity</h2>
          <p className={`mt-1 text-xs ${op.mute}`}>Publicly visible on the profile. Users see exactly what you enter here.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Display name"><input className={inputClass} value={draft.name || draft.handle || ''} onChange={(event) => set('name', event.target.value)} /></Field>
            <Field label="Age"><input className={inputClass} type="number" value={draft.age || 18} onChange={(event) => set('age', Number(event.target.value))} /></Field>
            <Field label="Gender"><select className={inputClass} value={draft.gender || 'Woman'} onChange={(event) => set('gender', event.target.value)}><option>Woman</option><option>Man</option><option>Non-binary</option></select></Field>
            <Field label="Orientation"><select className={inputClass} value={Array.isArray(draft.orientation) ? draft.orientation[0] || 'everyone' : draft.orientation || 'everyone'} onChange={(event) => set('orientation', [event.target.value])}><option value="women">Women</option><option value="men">Men</option><option value="everyone">Everyone</option><option value="nonbinary">Non-binary</option></select></Field>
            <Field label="City"><input className={inputClass} value={draft.city || ''} onChange={(event) => set('city', event.target.value)} /></Field>
            <Field label="Height"><input className={inputClass} value={draft.height || ''} onChange={(event) => set('height', event.target.value)} /></Field>
          </div>
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Photos <span className={`font-normal ${op.mute}`}>- {photoCount} of 6</span></h2>
          <p className={`mt-1 text-xs ${op.mute}`}>First photo is the cover. Upload licensed assets only.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => uploadFiles(event.target.files)}
          />
          <div className="mt-4 grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, index) => {
              const photo = photosList[index]
              const filled = Boolean(photo?.storageKey)
              return (
                <button
                  key={index}
                  type="button"
                  className={`relative grid aspect-[3/4] place-items-center overflow-hidden rounded-lg border ${op.borderSoft} text-xs ${filled ? '' : op.mute}`}
                  onClick={() => triggerPhotoPicker(index)}
                  disabled={uploading || saving}
                >
                  {filled ? (
                    <img
                      src={photoSrc(photo)}
                      alt={`Photo ${index + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ filter: normalizedBlur(photo) ? `blur(${Math.round(normalizedBlur(photo) / 12)}px)` : undefined }}
                      loading="lazy"
                    />
                  ) : <span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> upload</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => triggerPhotoPicker()} disabled={uploading || saving}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? 'Uploading...' : 'Add photo'}
            </Button>
          </div>
          {!!photosList.length && (
            <div className={`mt-4 space-y-2 rounded-md border ${op.borderSoft} ${op.bgMain} p-3`}>
              <div className={`text-xs font-semibold uppercase tracking-[0.08em] ${op.mute}`}>Photo blur controls (applies to all)</div>
              <div className="flex items-center gap-3">
                <label className={`inline-flex items-center gap-2 text-xs ${op.text}`}>
                  <input
                    type="checkbox"
                    checked={sharedBlurEnabled}
                    onChange={(event) => applyBlurToAllPhotos(event.target.checked, event.target.checked ? (sharedBlurAmount || 70) : 0)}
                  />
                  Blur enabled for all photos
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sharedBlurAmount}
                  disabled={!sharedBlurEnabled}
                  onChange={(event) => applyBlurToAllPhotos(true, Number(event.target.value))}
                  className="w-48"
                />
                <span className={`w-10 text-right text-xs font-mono ${op.mute}`}>{sharedBlurAmount}</span>
              </div>
            </div>
          )}
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Bio & prompts</h2>
          <div className="mt-4 space-y-3">
            <Field label="Bio">
              <textarea className={`${inputClass} min-h-24 resize-none`} value={draft.bio || ''} maxLength={280} onChange={(event) => set('bio', event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Work"><input className={inputClass} value={draft.work || ''} onChange={(event) => set('work', event.target.value)} /></Field>
              <Field label="Education"><input className={inputClass} value={draft.edu || ''} onChange={(event) => set('edu', event.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <Chip key={interest}>{interest}<X className="h-3 w-3 cursor-pointer" onClick={() => removeInterest(interest)} /></Chip>
              ))}
            </div>
          </div>
        </section>

        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Relationship & lifestyle</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Relationship status"><select className={inputClass} value={draft.relStatus || 'single'} onChange={(event) => set('relStatus', event.target.value)}><option value="single">Single</option><option value="in_relationship">In relationship</option><option value="complicated">Complicated</option><option value="prefer_not_say">Private</option></select></Field>
            <Field label="Intent"><select className={inputClass} value={draft.intent || 'serious'} onChange={(event) => set('intent', event.target.value)}><option value="serious">Long-term</option><option value="dating">Dating</option><option value="figuring_out">Figuring it out</option><option value="casual">Casual</option></select></Field>
            <Field label="Drinks"><select className={inputClass} value={draft.drinks || ''} onChange={(event) => set('drinks', event.target.value)}><option value="">Unset</option><option>Yes</option><option>Socially</option><option>Sometimes</option><option>Rarely</option><option>No</option></select></Field>
            <Field label="Smokes"><select className={inputClass} value={draft.smokes || ''} onChange={(event) => set('smokes', event.target.value)}><option value="">Unset</option><option>No</option><option>Socially</option><option>Yes</option></select></Field>
          </div>
        </section>

        <div className="flex gap-2">
          <Button tone="primary" onClick={save} disabled={saving || uploading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
          <Button><Eye className="h-4 w-4" /> Preview as user</Button>
          <Button tone="danger" className="ml-auto">Archive persona</Button>
        </div>
        {error && <p className={`text-sm ${op.bad}`}>{error}</p>}
      </div>

      <aside className="space-y-4">
        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Live preview</h2>
          <div className={`mt-3 overflow-hidden rounded-[28px] border ${op.border} ${op.bgMain} p-2`}>
            <div className="relative aspect-[9/13] overflow-hidden rounded-[22px]" style={!photosList[0]?.storageKey ? avatarGradient(hue) : undefined}>
              {photosList[0]?.storageKey && (
                <img
                  src={photoSrc(photosList[0])}
                  alt={`${draft.name || draft.handle} main photo`}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ filter: normalizedBlur(photosList[0]) ? `blur(${Math.round(normalizedBlur(photosList[0]) / 12)}px)` : undefined }}
                  loading="lazy"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4">
                <div className="text-xl font-bold text-white">{draft.name || draft.handle}, {draft.age}</div>
                <div className="text-sm text-white/75">{draft.city || 'Unknown city'}</div>
              </div>
            </div>
            <div className={`space-y-3 p-3 text-sm ${op.dim}`}>
              <p>{draft.bio || 'No bio yet.'}</p>
              <div className="flex flex-wrap gap-1.5">{interests.slice(0, 6).map((interest) => <Chip key={interest}>{interest}</Chip>)}</div>
            </div>
          </div>
        </section>
        <section className={`rounded-lg border ${op.borderSoft} ${op.bgElev} p-4`}>
          <h2 className={`text-sm font-semibold ${op.text}`}>Governance</h2>
          <div className={`mt-3 space-y-2 text-sm ${op.dim}`}>
            <div className="flex justify-between"><span>Created by</span><span className={op.text}>{draft.createdBy}</span></div>
            <div className="flex justify-between"><span>Team</span><span className={op.text}>{draft.team}</span></div>
            <div className="flex justify-between"><span>Verified badge</span><Chip tone="ok">on</Chip></div>
            <div className="flex justify-between"><span>Disclosure</span><Chip tone="warn">required</Chip></div>
          </div>
          <p className={`mt-4 border-t ${op.borderSoft} pt-3 text-xs leading-5 ${op.mute}`}>Every message is attributed to the team member who sent it. Required disclosure remains part of Ohrny policy.</p>
        </section>
      </aside>
    </div>
  )
}
