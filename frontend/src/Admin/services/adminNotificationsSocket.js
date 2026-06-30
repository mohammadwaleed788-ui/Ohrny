import { io } from 'socket.io-client'
import { API_BASE_URL, getAccessToken } from '../../services/apiClient'

function socketBaseUrl() {
  return API_BASE_URL.replace(/\/api\/?$/, '')
}

export function connectAdminNotificationsSocket(handlers = {}) {
  const token = getAccessToken()
  if (!token) return () => {}

  const socket = io(`${socketBaseUrl()}/admin`, {
    auth: { token },
    autoConnect: false,
  })
  let active = true
  const connectTimer = setTimeout(() => {
    if (!active) return
    socket.connect()
  }, 0)

  const eventNames = [
    'campaign:queued',
    'campaign:progress',
    'campaign:completed',
    'campaign:failed',
  ]

  for (const eventName of eventNames) {
    socket.on(eventName, (payload) => {
      handlers[eventName]?.(payload)
      handlers.onAnyCampaignEvent?.(eventName, payload)
    })
  }

  socket.on('connect', () => {
    socket.emit('notifications:subscribe')
  })

  return () => {
    active = false
    clearTimeout(connectTimer)
    for (const eventName of eventNames) {
      socket.off(eventName)
    }
    if (socket.connected || socket.active) {
      socket.disconnect()
    }
  }
}
