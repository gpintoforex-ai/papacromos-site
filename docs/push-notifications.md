# Push notifications

## Web app/PWA

The web app uses the browser Push API through `public/sw.js`. It only runs in production, on HTTPS, with a valid `VITE_VAPID_PUBLIC_KEY`.

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Add the public key to the frontend environment:

```bash
VITE_VAPID_PUBLIC_KEY='<public key>'
```

When a user is logged in and grants notification permission, the app stores the browser subscription in `web_push_subscriptions`.

On iPhone/iPad, Web Push requires iOS/iPadOS 16.4 or later and the site must be added to the Home Screen as a web app.

## Mobile app

The app uses `@capacitor/push-notifications` on native platforms. After login, Android asks for notification permission and stores the FCM token in `push_tokens`.

For a real Android build, configure Firebase Cloud Messaging:

1. Create or open the Firebase project for Papa Cromos.
2. Add the Android app id `com.papacromos.app`.
3. Download `google-services.json`.
4. Place it in `android/app/google-services.json`.
5. Run `npm run android:sync` before building the APK.

## Database

Apply the migration:

```bash
supabase db push
```

The migration creates:

- `push_tokens`: one or more active device tokens per user.
- `web_push_subscriptions`: browser Push API subscriptions per user.
- `app_notifications`: pending/sent/failed notification queue.
- Triggers for new trade offers, trade status updates and trade messages.

## Sender

Deploy the Edge Function:

```bash
supabase functions deploy send-push-notifications
```

Set these secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY='<public key>'
supabase secrets set VAPID_PRIVATE_KEY='<private key>'
supabase secrets set VAPID_SUBJECT='mailto:admin@papacromos.pt'
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<firebase service account json>'
supabase secrets set FCM_PROJECT_ID='<firebase project id>'
```

`FCM_PROJECT_ID` is optional when the service account JSON includes `project_id`.
The FCM secrets are only needed for the native Android app. The VAPID secrets are needed for web/PWA push.

Invoke the function on a schedule, for example every minute, so pending rows in `app_notifications` are delivered.
