# Support Tickets — Realtime & Notifications (Admin/Web integration)

This documents what the **backend already does** for support-ticket realtime +
push, and what the **admin web app** needs to do to participate. The mobile app
is already fully wired against this.

> TL;DR for the web dev: when an admin posts a **non-internal reply**, the
> existing `POST /admin/support/tickets/:ticketId/replies` endpoint **already**
> emits the socket events and sends the user a push. You don't have to send
> anything yourself for the user to be notified. You only need sockets if you
> want the **admin UI** to receive live updates / presence.

---

## 1. What the backend does automatically

On `replySupportTicket` (admin, `isInternal !== true`) the server:

1. Inserts the reply, updates the ticket (`first_responded_at`, `last_message_at`).
2. Emits **`support:message`** to the ticket room `support:<ticketId>` (the
   live message for anyone viewing that ticket — including the mobile user).
3. Emits **`support:reply`** `{ ticketId }` to the requester's personal room
   `user:<userId>` (drives the mobile unread badges).
4. Sends an **FCM push** to the user **only if they are not currently viewing
   the ticket** (i.e. not joined to `support:<ticketId>`) — same rule as chat.
   Push payload:
   ```json
   { "notification": { "title": "Support replied", "body": "<preview>" },
     "data": { "type": "support_reply", "ticketId": "<uuid>", "ticketNo": "T-123456" } }
   ```

Internal notes (`isInternal: true`) do **not** notify the user.

Unread tracking: opening the ticket on mobile (`GET /user/support/tickets/:id`)
stamps `support_tickets.last_user_read_at = now()`. "Unread" = any non-internal
admin message newer than that. The mobile badge count comes from
`GET /user/likes/activity` → `unreadSupport`.

---

## 2. Socket server

- Same Socket.IO server as chat: `ApiConfig.socketUrl`, path `/socket.io/`,
  websocket transport.
- **Auth:** `socket.handshake.auth.token` (Bearer JWT). The current
  middleware only accepts **user** tokens (`payload.type === 'user'`). To let
  **admins** connect you must extend `src/socket/auth.js` to also accept admin
  tokens (e.g. allow `payload.type === 'admin'` and set `socket.adminId`).
  This is the only backend change needed on your side.

### Rooms
| Room | Who's in it | Purpose |
|------|-------------|---------|
| `user:<userId>` | all of a user's sockets | per-user nudges (`support:reply`) |
| `support:<ticketId>` | the ticket's requester (mobile) when viewing | live thread + presence |

### Events the server EMITS
| Event | Room | Payload | Meaning |
|------|------|---------|---------|
| `support:message` | `support:<ticketId>` | `{ id, ticketId, kind:'reply', body, createdAt, author:{type:'admin',id,label} }` | new reply in the thread |
| `support:reply` | `user:<userId>` | `{ ticketId }` | nudge → refresh badge |
| `support:presence` | `support:<ticketId>` | `{ ticketId, userId, online }` | the user opened/closed the ticket |

### Events the mobile client EMITS (so you can read presence)
| Event | Payload | When |
|------|---------|------|
| `support:open` | `{ ticketId }` | user opens the ticket screen → joins `support:<ticketId>` |
| `support:close` | `{ ticketId }` | user leaves the ticket screen |

---

## 3. What the admin web app should do (optional, for a live admin UI)

1. **Connect** to the socket with an admin JWT (after extending socket auth).
2. **Join** `support:<ticketId>` when an agent opens a ticket, to receive
   `support:message` (the user's live replies) and `support:presence` (whether
   the user is currently viewing).
3. To know **user online/offline** globally you can also rely on the existing
   presence the backend already tracks (`isUserOnline(userId)` in
   `src/socket/index.js`) — expose it via a small admin endpoint if you want a
   roster, or just use `support:presence` within a ticket.
4. You do **not** need to emit anything to notify the user — posting the reply
   through the existing admin endpoint already does it. If you ever send replies
   by a path that bypasses `replySupportTicket`, call the same helper
   (`emitSupportReply(...)` + `notifySupportReply(...)`) so users still get
   realtime + push.

---

## 4. Quick test (without the admin UI)
- Open a ticket on the mobile app → it emits `support:open`.
- `POST /admin/support/tickets/:id/replies { "body": "hi" }`.
  - If the user is viewing: they see it instantly (no push).
  - If not: they get the FCM push (`type: support_reply`) and the support
    badges (Me tab → Settings → Help & support) light up; tapping the push
    deep-links straight to that ticket.
