# Klas Firebase + Cloudinary + WebRTC backend

## Firebase

Frontend resmi Firebase CDN-den Firebase JS SDK 12.16.0 ulanýar.

1. **Authentication → Google** provider-i işjeňleşdiriň.
2. `maksatdowletow.github.io` domenini Authentication authorized domains sanawyna goşuň.
3. Cloud Firestore dörediň.
4. Repository-däki `firestore.rules` we `firestore.indexes.json` faýllaryny deploy ediň.

```bash
firebase login
firebase use project-789b5025-7a3c-4b74-88b
firebase deploy --only firestore:rules,firestore:indexes
```

Ulanyjy çykanda ýa-da Firebase elýetersiz bolanda programma ýerli `localStorage` fallback režiminde işlemegini dowam etdirýär.

## Janly hat çaty

Firestore gurluşy:

- `conversations/{conversationId}`
- `conversations/{conversationId}/messages/{messageId}`
- `conversations/{conversationId}/typing/{uid}`

Işleýän funksiýalar:

- realtime habarlar;
- ýazýar/typing ýagdaýy;
- online we last-seen;
- unread sanagy;
- `Görüldi` belgisi;
- diňe çata gatnaşýan iki ulanyja okamak/ýazmak rugsady.

## Wideoçat

Wideoçat WebRTC ulanýar, Firestore diňe signaling maglumatlaryny saklaýar:

- `calls/{callId}` — offer, answer we jaň statusy;
- `calls/{callId}/callerCandidates`;
- `calls/{callId}/calleeCandidates`.

GitHub Pages HTTPS bolany üçin kamera/mikrofon API-si işläp biler. Ulanyjy brauzerde kamera we mikrofon rugsadyny bermeli.

`klas-config.js` häzirki wagtda Google STUN serverlerini ulanýar. Käbir mobil operatorlarda, korporatiw torlarda ýa-da symmetric NAT şertlerinde durnukly jaň üçin aýratyn **TURN serveri** zerur bolýar. TURN credential-laryny diňe howpsuz backend arkaly bermek maslahat berilýär; uzak möhletli TURN secret-i public repository-ä goýmaň.

## Cloudinary

Brauzere diňe şu public maglumatlar gerek:

- Cloud Name;
- Unsigned Upload Preset.

API Secret-i public repository-ä hiç wagt goýmaň.

`klas_unsigned` atly unsigned preset dörediň we Cloudinary Console-da çäklendiriň:

- formatlar: jpg, jpeg, png, webp, gif, mp4, webm;
- surat: iň köp 10 MB;
- wideo: iň köp 50 MB;
- custom public ID gadagan;
- asset folder: `klas`.

Klas-da **Sazlamalar → Cloudinary media → Sazla** bölüminde Cloud Name we preset giriziň.

## Esasy Firestore kolleksiýalary

- `users`
- `profiles`
- `posts/{postId}/likes`
- `posts/{postId}/comments`
- `conversations/{conversationId}/messages`
- `conversations/{conversationId}/typing`
- `calls/{callId}`
- `friendships`
- `groups`
- `events`
- `media`
- `stories`
- `notifications`
