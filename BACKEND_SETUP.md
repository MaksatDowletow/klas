# Klas Firebase + Cloudinary backend

## Firebase

The frontend uses Firebase JS SDK 12.16.0 from the official Firebase CDN.

1. Enable **Authentication → Google**.
2. Add `maksatdowletow.github.io` to Authentication authorized domains.
3. Create Cloud Firestore.
4. Deploy `firestore.rules` and `firestore.indexes.json`.

```bash
firebase login
firebase use project-789b5025-7a3c-4b74-88b
firebase deploy --only firestore:rules,firestore:indexes
```

The app continues in localStorage fallback mode when the user is signed out or Firebase is unavailable.

## Cloudinary

The browser needs only:

- Cloud Name
- Unsigned Upload Preset

Never place an API Secret in this public repository.

Create an unsigned preset named `klas_unsigned` and restrict it in Cloudinary Console:

- allowed formats: jpg, jpeg, png, webp, gif, mp4, webm
- image maximum: 10 MB
- video maximum: 50 MB
- disallow custom public IDs
- asset folder: `klas`

In Klas open **Sazlamalar → Cloudinary media → Sazla** and enter the Cloud Name and preset.

## Firestore collections

- `users`
- `profiles`
- `posts/{postId}/likes`
- `posts/{postId}/comments`
- `conversations/{conversationId}/messages`
- `friendships`
- `groups`
- `events`
- `media`
- `stories`
- `notifications`
