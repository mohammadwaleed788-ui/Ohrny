# Admin Grant Guide — Subscriptions, Super Likes & Boosts (test users)

How to **manually grant** a subscription or consumables to a user so the **mobile app treats it exactly like a RevenueCat purchase** — i.e. the profile shows the **"Your membership"** card and the membership page shows the plan as **active / CURRENT**.

The mobile app never talks to RevenueCat to read entitlements — it reads them from our own DB via `GET /api/user/auth/me` → `user.entitlements`. So whatever the admin writes to the DB is what the app shows. The trick is writing the **same shape** the RevenueCat webhook writes.

---

## 0. How the app decides "subscribed"

`getEffectiveEntitlements()` (in `src/services/entitlementService.js`) returns:

```jsonc
"entitlements": {
  "plan": "plus",                 // computed from the ACTIVE subscription row
  "activeSubscription": {         // null = free; non-null = the membership card shows
    "planId": "plus",
    "duration": "1m",             // flags the "CURRENT" term card in the app
    "status": "active",
    "startedAt": "...",
    "expiresAt": "...",
    "gracePeriodEndsAt": null
  },
  "balances": { "superLikesLeft": 5, "boostsLeft": 10 },
  "limits":   { ... }, "features": { ... }
}
```

A `user_subscriptions` row counts as the **active** subscription only if **ALL** of these hold:
- `status` is `active` **or** `grace_period`
- the plan is one of the seeded active plans (`plus` / `platin`)
- `expires_at IS NULL` **OR** `expires_at > now()` **OR** `grace_period_ends_at > now()`

So to grant: insert one such row, then refresh the user's cached plan. **No mobile change needed** — the app already reads this.

---

## 1. ✅ Preferred way — reuse the existing service functions

These are the **exact** functions the webhook uses, so the data is guaranteed identical. Import from `src/services/entitlementService.js`.

### Grant a subscription (Plus / Platin)

```js
import { db } from '../db/index.js'
import { userSubscriptions } from '../db/schema/subscriptions.js'
import { syncUserPlanCache } from '../services/entitlementService.js'
import { and, eq } from 'drizzle-orm'

async function adminGrantSubscription({
  userId,
  planId,          // 'plus' | 'platin'
  duration,        // '1w' | '1m' | '3m' | '6m'
  platform = 'ios',// 'ios' | 'android' | 'web'
  months = 12,     // how long the comp lasts
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000)

  await db.transaction(async (tx) => {
    // Expire any current active row first (mirrors the webhook).
    await tx.update(userSubscriptions)
      .set({ status: 'expired', updatedAt: now })
      .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active')))

    await tx.insert(userSubscriptions).values({
      userId,
      planId,
      duration,
      status: 'active',
      platform,
      currency: 'PKR',
      priceAtPurchase: '0',                                  // comp = free
      revenueCatProductId: `ohrny_${planId}_${duration}_${platform}`, // looks like RC
      revenueCatTransactionId: `admin_${userId}_${now.getTime()}`,    // unique → idempotent
      startedAt: now,
      expiresAt,                                             // or null for a perpetual comp
      updatedAt: now,
    })

    await syncUserPlanCache(userId, tx)   // sets users.plan from the active row
  })
}
```

### Grant Super Likes / Boosts (consumables)

`grantPurchase` already increments the balance **and** records history, and is **idempotent** by transaction id:

```js
import { grantPurchase } from '../services/entitlementService.js'

await grantPurchase({
  userId,
  type: 'super_likes',          // 'super_likes' | 'boosts'
  quantity: 5,                  // any positive number (clamped 1..1000)
  priceAtPurchase: 0,
  currency: 'PKR',
  revenueCatProductId: 'ohrny_superlikes_5_ios', // optional, for realism
  revenueCatTransactionId: `admin_${userId}_${Date.now()}`, // unique
  platform: 'ios',
  purchasedAt: new Date(),
})
```

This bumps `users.super_likes_left` / `users.boosts_left`, which the app shows on the profile stats.

---

## 2. Reference — raw SQL (if not using the functions)

### Subscription
```sql
-- expire current active row (optional but recommended)
UPDATE users SET plan = 'plus', updated_at = now() WHERE id = :userId;
UPDATE user_subscriptions SET status='expired', updated_at=now()
  WHERE user_id = :userId AND status = 'active';

INSERT INTO user_subscriptions
  (user_id, plan_id, duration, status, platform, currency, price_at_purchase,
   revenue_cat_product_id, revenue_cat_transaction_id, started_at, expires_at, updated_at)
VALUES
  (:userId, 'plus', '1m', 'active', 'ios', 'PKR', '0',
   'ohrny_plus_1m_ios', concat('admin_', :userId, '_', extract(epoch from now())::bigint),
   now(), now() + interval '365 days', now());
```

### Consumables
```sql
UPDATE users SET super_likes_left = super_likes_left + 5, updated_at = now() WHERE id = :userId;
-- or:  boosts_left = boosts_left + 10
```

> Always also `UPDATE users SET plan = '<planId>'` for subscriptions (the app prefers the active row, but keep the cached column in sync).

---

## 3. The 8 subscription products (per platform) + consumables

Product id convention: **`ohrny_{plan}_{duration}_{platform}`**

| Plan | Durations | iOS product id | Android product id |
|------|-----------|----------------|--------------------|
| `plus`   | `1w`,`1m`,`3m`,`6m` | `ohrny_plus_1w_ios` … `ohrny_plus_6m_ios` | `ohrny_plus_1w_android` … |
| `platin` | `1w`,`1m`,`3m`,`6m` | `ohrny_platin_1w_ios` … `ohrny_platin_6m_ios` | `ohrny_platin_1w_android` … |

→ 4 durations × 2 platforms = **8 products per plan** (16 total). For an admin grant you only need `planId` + `duration` + `platform`; the `revenue_cat_product_id` above is optional realism.

Consumables (one-time): **`ohrny_{superlikes|boosts}_{qty}_{platform}`**

| Type | Quantities | Example ids |
|------|-----------|-------------|
| `super_likes` | 5, 15, 30 | `ohrny_superlikes_5_ios`, `ohrny_superlikes_15_android`, … |
| `boosts`      | 1, 5, 10  | `ohrny_boosts_1_ios`, `ohrny_boosts_10_android`, … |

---

## 4. Enum cheat-sheet (use EXACTLY these values)

| Field | Allowed values |
|-------|----------------|
| `plan_id` / `users.plan` | `free`, `plus`, `platin`, `private` |
| `status` | `active`, `expired`, `cancelled`, `pending`, `grace_period` → **use `active`** |
| `platform` | `ios`, `android`, `web` |
| `duration` | `1w`, `1m`, `3m`, `6m` |
| consumable `type` | `super_likes`, `boosts` |

---

## 5. Notes

- **expires_at**: set a future date for a time-limited comp (shows "Current period ends …" in the app), or `NULL` for a perpetual comp (no expiry shown). Never set a past date — the app would treat it as expired.
- **Revoking**: to remove a comp, set the row `status='cancelled'` (or `expired`) and `UPDATE users SET plan='free'`. The app reverts to free on next `/me`.
- **One active row per user**: expire the old active row before inserting a new one (the app would otherwise pick the highest-tier active row, which is fine, but clean is better).
- **Features & limits are automatic**: granting `plan='plus'`/`'platin'` gives all that tier's features/limits — you don't set those.
- **The app updates on next `/me`**: have the test user reopen the app (or pull-to-refresh / re-login). No app rebuild needed.
- **Idempotency**: keep `revenue_cat_transaction_id` unique per grant; reusing one is treated as a duplicate (for consumables, no double-credit).
</content>
