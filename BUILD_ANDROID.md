# Build Android APK for Physical Device Testing

This guide walks you through building a **development APK** that you can install on your Android phone to test Firebase Analytics, FCM push notifications, and all native features.

---

## Prerequisites

1. **Expo account** — sign up at [expo.dev](https://expo.dev) (free)
2. **Android phone** with USB debugging enabled
3. **EAS CLI** installed (we'll do this below)

---

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

If that's slow, use npx instead (no install needed):
```bash
npx eas-cli --version
```

---

## Step 2: Login to Expo

```bash
npx eas login
```

Enter your Expo account email and password.

---

## Step 3: Configure the project (one-time)

```bash
cd NGAPP/app
npx eas build:configure
```

This links your project to your Expo account. Just press Enter to accept defaults.

---

## Step 4: Build the development APK

```bash
npx eas build --profile development --platform android
```

**What this does:**
- Builds a custom APK with Firebase, notifications, and all native code baked in
- Takes ~10-15 minutes (runs on Expo's cloud servers, not your Mac)
- Outputs a download link when done

**While it builds:**
- You'll see a URL like `https://expo.dev/accounts/.../builds/...`
- Open it in your browser to watch the build progress
- The build runs on Expo's servers (free tier: 30 builds/month)

---

## Step 5: Install on your phone

Once the build finishes:

**Option A: Direct download (easiest)**
1. Open the build URL on your phone's browser
2. Tap "Download" → install the APK
3. Android will warn "Install unknown apps" → allow it for your browser

**Option B: USB transfer**
1. Download the APK to your Mac
2. Connect phone via USB
3. Copy APK to phone's Downloads folder
4. Open Files app on phone → tap the APK → install

---

## Step 6: Run the app

1. Open the "Tuka" app on your phone
2. On your Mac, in the project folder:
   ```bash
   npx expo start --dev-client
   ```
3. Scan the QR code with the Tuka app (not Expo Go)
4. The app loads your code from the dev server

**Now you can:**
- Edit code on your Mac → save → app reloads instantly on your phone
- Test Firebase Analytics (check Firebase console → Analytics → Events)
- Test FCM push notifications (send from Firebase console → Cloud Messaging)
- Test all native features (camera, biometrics, etc.)

---

## Troubleshooting

**"Build failed" — check the logs**
- Open the build URL → click "View logs"
- Common issues:
  - Missing `google-services.json` → make sure it's in `NGAPP/app/`
  - Package name mismatch → check `app.json` android.package matches Firebase

**"App won't install"**
- Enable "Install unknown apps" in Android settings
- Make sure you downloaded the APK, not the AAB (app bundle)

**"Can't connect to dev server"**
- Phone and Mac must be on the same WiFi
- Check the IP in the QR code matches your Mac's IP: `ipconfig getifaddr en0`

---

## Production APK (for Play Store submission)

When you're ready to submit to Google Play:

```bash
npx eas build --profile production --platform android
```

This creates an **AAB (Android App Bundle)** — the format Google Play requires.

---

## iOS Build (later)

Same process for iOS:

```bash
npx eas build --profile development --platform ios
```

But you need:
- Apple Developer account ($99/year)
- Provisioning profile + signing certificate (EAS can auto-generate these)

---

## Cost

- **Development builds**: Free (30/month on free tier)
- **Production builds**: Free (30/month on free tier)
- **Expo account**: Free
- **EAS hosting**: Free for builds, $29/month if you want priority builds (optional)

---

## Next Steps After First Build

1. **Test Firebase Analytics**
   - Open app → sign up → trade a card
   - Firebase Console → Analytics → Events → see `sign_up`, `purchase`, etc.

2. **Test FCM Push**
   - Firebase Console → Cloud Messaging → "Send your first message"
   - Target: your FCM token (check backend logs for the token)
   - Send → notification appears on your phone

3. **Test Deep Links**
   - Create a link: `tuka://open?utm_source=facebook&utm_campaign=test`
   - Open it on your phone → app opens → check Firebase for `deep_link_open` event

4. **Iterate Fast**
   - Keep the dev build installed on your phone
   - Edit code → save → app reloads in ~2 seconds
   - No need to rebuild unless you change native config (app.json, plugins, etc.)
