# Klas architecture

Klas is a static, zero-build web application deployed to GitHub Pages. Dynamic member data is provided by Firebase Authentication and Cloud Firestore; media is uploaded directly to Cloudinary; calls use WebRTC; a service worker provides the Windows/Android PWA shell.

## Runtime layers

1. `klas-config.js` contains public client configuration only. Secrets must never be committed.
2. `klas-runtime.js` owns shared routing contracts, versioned browser storage, runtime events, diagnostics, and the global error boundary.
3. `klas-v4-*.js` renders the local/demo experience and remains the offline fallback.
4. `klas-bridge.js` is the compatibility boundary between local state and authenticated cloud state.
5. `klas-presence-policy.js` deterministically aggregates multi-tab heartbeat sessions and expires stale sessions.
6. `klas-backend-*.js` owns Google-only authentication, Firestore subscriptions, Cloudinary uploads, live chat, notifications, and WebRTC calls.
7. `klas-pwa.js` and `service-worker.js` own installation, offline shell caching, and safe application updates.
8. `klas-design-system.css` is the shared token, accessibility-state, and component-polish layer.
9. `klas-media-viewer.js` + `klas-media-viewer.css` provide an isolated photo/video gallery surface. The module owns fullscreen, zoom/pan, rotation, swipe/pinch, slideshow, keyboard controls, sharing, and Cloudinary thumbnail transformation without changing the legacy story lightbox.
10. `klas-contact-sync.js` owns device Contact Picker capability detection, bounded VCF parsing, Turkmen name canonicalization, unique-name member matching, and privacy-safe sync summaries.

## State contract

The local state key remains `klas-v4-state`. Legacy plain JSON is still readable. New writes use an envelope:

```json
{
  "marker": "klas-store",
  "schema": 1,
  "savedAt": "ISO-8601 timestamp",
  "data": {}
}
```

This permits future migrations without deleting a member's local fallback data. Authenticated Firestore data is never merged into the demo snapshot; `klas-bridge.js` switches explicitly between local and cloud modes.

## Runtime events

- `klas:statechange` — a local or cloud collection changed.
- `klas:pagechange` — the active hash-routed page changed.
- `klas:error` — the global boundary captured an unexpected client error.
- `klas:diagnostics` — online and storage health was rechecked.
- `klas-auth` and `klas-account` — Firebase authentication/account lifecycle events.
- `klas-presence` — the effective realtime online-member set changed.

## Security boundaries

- Authentication is Google popup only.
- Firestore Rules are the authorization boundary; UI checks are convenience, not security.
- Profile/member data requires a Google token and an active Klas account.
- `presenceSessions/{sessionId}` is session-scoped: only its Google UID owner may write it, while active onboarded members may read the online set. Heartbeat freshness, rather than the legacy profile flag, determines the effective status; multiple tabs remain independent.
- Browser media uploads use one centrally defined, constrained unsigned Cloudinary preset. Members do not configure provider values per browser, and the Cloudinary API secret is never exposed.
- Contact phone numbers and email addresses stay in ephemeral browser memory only. The picker always requires a user gesture; VCF files are size/count bounded; matching uses public member names locally; Firestore has no contact collection.
- User-provided URLs are HTTPS-only, and rendered text must be escaped before insertion into HTML.

## Verification

Run before every release:

```sh
node --test tests/*.test.js
for file in klas-*.js; do node --check "$file"; done
node --check service-worker.js
```

The Pages workflow repeats syntax, contract, JSON, authentication, responsive, and artifact checks before deployment. Firebase rules have a separate emulator-backed workflow.
