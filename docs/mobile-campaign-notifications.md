# Mobile Integration: Campaign Notifications

This guide describes how the mobile app should integrate with backend-admin campaign pushes.

## Scope
- Architecture is hybrid:
  - Backend/admin use sockets for control-plane progress updates.
  - Device delivery is FCM/APNS push.
- User preference scope is a single toggle:
  - `campaignNotificationsEnabled` in user privacy settings.

## FCM Payload Contract (Campaign)

Backend sends campaign pushes with:

- `notification.title`: campaign title
- `notification.body`: campaign body
- `data.type`: `"campaign"`
- `data.campaignId`: campaign UUID string
- `data.deeplink`: app deeplink string (may be empty)

Example:

```json
{
  "notification": {
    "title": "Weekend Boost",
    "body": "Open Ohrny now to see new matches."
  },
  "data": {
    "type": "campaign",
    "campaignId": "8f2c3f1e-8c3c-4f5e-b6a0-4bd58ef3f602",
    "deeplink": "ohrny://discover"
  }
}
```

## Mobile Handling Changes

Update your existing notification data router in `FirebaseMessagingService._handleNotificationData(...)`:

- Add a `case 'campaign':`
  - Read `deeplink`.
  - If deeplink is present and valid, navigate to deeplink destination.
  - If deeplink is missing/invalid, fallback to `AppRoutes.discover`.

Pseudo behavior:

```text
if type == campaign:
  if deeplink exists:
    open deeplink route
  else:
    go discover
```

## Foreground / Background / Terminated Behavior

- Foreground: local notification/banner behavior remains handled by existing `onMessage`.
- Background/terminated: tap flow still comes through:
  - `onMessageOpenedApp` for background
  - `getInitialMessage` for cold launch
- Campaign path should work in both branches through `_handleNotificationData`.

## Toggle Contract

Backend now accepts the single preference in user privacy updates:

- `campaignNotificationsEnabled: boolean`

Recommended app behavior:

- Include this field in privacy settings read/write.
- If app exposes a notifications settings UI, bind one switch to this field.

## QA Checklist

Test on both iOS and Android:

1. **Toggle ON + immediate campaign**
   - User receives push.
   - Tap opens deeplink target.
2. **Toggle OFF + immediate campaign**
   - User does not receive campaign push.
3. **Scheduled campaign**
   - Push arrives at scheduled window.
4. **Missing deeplink**
   - Tap falls back to discover.
5. **Cold launch tap**
   - App launches and routes correctly.
6. **Foreground receive**
   - Banner/local notification behavior remains consistent with current app policy.

## Notes

- Existing support/message/like notification types are unchanged.
- Campaign delivery is FCM-based; socket connection state on mobile should not be required for receiving campaign push.
