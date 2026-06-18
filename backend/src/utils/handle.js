// Resolve the handle to show another user. When the target has anonymousHandle
// on, their real (self-chosen) handle is replaced with a generic label until
// it's revealed — in chat, revelation happens on the mutual photo unlock (same
// gate as photos/age/distance). In discovery/likes it stays anonymous.
export function displayHandle(realHandle, { anonymous = false, revealed = false } = {}) {
  if (!anonymous || revealed) return realHandle ?? null
  return 'Anonymous'
}
