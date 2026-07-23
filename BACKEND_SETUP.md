# Klas Firebase + Cloudinary + WebRTC backend

## Windows we Android PWA

Klas `https://maksatdowletow.github.io/klas/` salgysynda install edilýän web programma hökmünde işleýär.

- **Windows:** Microsoft Edge ýa-da Chrome-da Klas-y açyň. Salgy setirindäki programma gurmak nyşanyny ýa-da **Sazlamalar → Klas programmasy → Gur** düwmesini basyň.
- **Android:** Chrome-da Klas-y açyň. **Sazlamalar → Klas programmasy → Gur** düwmesini ýa-da brauzeriň **Programmany gur** menýusyny saýlaň.
- Ilkinji gezek online ýagdaýda açylanda esasy programma faýllary offline ulanmak üçin keşlenýär.
- Firebase, Cloudinary we wideo jaň maglumatlary offline keşlenmeýär; bu hyzmatlara internet gerek.
- Täze wersiýa taýýar bolanda **Täzele** düwmesi görkezilýär. Açyk WebRTC jaňyny duýdansyz kesmezlik üçin programma öz-özünden täzelenmeýär.

## Firebase

Frontend resmi Firebase CDN-den Firebase JS SDK 12.16.0 ulanýar.

1. **Authentication → Sign-in method → Google** provider-i işjeňleşdiriň.
2. Email/password, telefon, anonymous we beýleki provider-leri öçürilen ýagdaýda saklaň: Klas diňe Google girişini goldaýar.
3. `maksatdowletow.github.io` domenini Authentication authorized domains sanawyna goşuň. `/klas/` ýoluny domen hökmünde goşmaň.
4. Klas Google girişini `signInWithPopup()` arkaly tamamlaýar; GitHub Pages bilen cross-origin redirect ulanylmaýar.
5. Popup netijesinden soň UI ilki `users/{uid}` ýazgysyny provision edýär, soň diňe şol agzanyň öz `profiles/{uid}` ýazgysyny barlap taýýarlaýar. Onboarding-den öň beýleki profiller açylmaýar; `blocked` agza öz profil bootstrap-yna hem girip bilmeýär. Profil hem düzgünleriň kabul edilmegi Firestore tranzaksiýasynda bile ýazylýar.
6. Cloud Firestore dörediň.
7. Repository-däki `firestore.rules` we `firestore.indexes.json` faýllaryny deploy ediň.

```bash
firebase login
firebase use project-789b5025-7a3c-4b74-88b
firebase deploy --only firestore:rules,firestore:indexes
```

Ulanyjy çykanda ýa-da Firebase elýetersiz bolanda programma ýerli `localStorage` fallback režiminde işlemegini dowam etdirýär.

### Google-only akkaunt akymy

- **Giriş / akkaunt döret** şol bir Google federated akymydyr. Ilkinji üstünlikli girişde Firebase Auth ulanyjysy awtomatik döredilýär.
- Google penjiresi desktop we mobil brauzerlerde popup görnüşinde açylýar. Popup bloklanan bolsa, brauzerde şu saýt üçin popup rugsadyny açmaly.
- `users/{uid}` private akkaunt ýazgysynda e-poçta, Google provider, rol, status, onboarding we login wagty saklanýar.
- `profiles/{uid}` diňe agzalara görünýän jemgyýet profili bolup, e-poçta saklamaýar.
- täze agza `role: user`, `status: active`, `onboardingComplete: false` bilen döredilýär; onboarding gutaranda diňe rugsatly profil meýdanlary täzelenýär.
- client rol/status ýokarlandyryp bilmeýär. Bloklanan agza Firestore jemgyýet maglumatlaryny okap ýa-da ýazyp bilmeýär.
- Firestore Rules `request.auth.token.firebase.sign_in_provider == 'google.com'` şertini server tarapynda hem barlaýar.
- Öňki Klas wersiýasyndan galan `pending` ýa-da doly bolmadyk akkaunt/profil ýazgylary ilkinji Google girişinde howpsuz görnüşde täze schema geçirilýär; `blocked` ýagdaý hiç wagt awtomatik açylmaýar.
- `npm run test:rules` Google-only giriş, iň pes rol, atomik onboarding, `blocked` hasap we profil schema düzgünlerini Firestore emulatorda barlaýar (Java 21 gerek).

Production üçin Firebase App Check-i aýratyn açmak we Google Cloud API key-ni `maksatdowletow.github.io` HTTP referrer-i hem-de gerekli Firebase API-lary bilen çäklendirmek maslahat berilýär. API key public web config-dir; service-account açary ýa-da başga secret repository-ä goýulmaly däl.

Ulanyjy üçin gizlinlik we jemgyýet düzgünleri `privacy.html` sahypasynda görkezilýär.

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

Işleýän akym:

- diňe Google bilen giriş eden iki Klas agzasynyň hakyky 1:1 çatynda **Wideoçat** düwmesi görünýär;
- jaň etmek, kabul etmek, ret etmek we tamamlamak;
- mikrofony/kamerany öçürmek we mobil enjamda öň/arqa kamerany çalyşmak;
- 45 sekunt jogapsyz jaň timeout-y, köne jaňlary arassalamak we 12 sekuntlyk network recovery;
- Firestore Rules arkaly diňe jaňa gatnaşýanlaryň SDP/ICE signaling maglumatlaryna girişmegi.

End-to-end barlag üçin iki aýratyn Google akkaunty bilen iki brauzer ýa-da iki enjam ulanyň.

GitHub Pages HTTPS bolany üçin kamera/mikrofon API-si işläp biler. Ulanyjy brauzerde kamera we mikrofon rugsadyny bermeli.

`klas-config.js` häzirki wagtda Google STUN serverlerini ulanýar. Käbir mobil operatorlarda, korporatiw torlarda ýa-da symmetric NAT şertlerinde durnukly jaň üçin aýratyn **TURN serveri** zerur bolýar. TURN credential-laryny diňe howpsuz backend arkaly bermek maslahat berilýär; uzak möhletli TURN secret-i public repository-ä goýmaň.

## Cloudinary

Brauzere diňe şu public maglumatlar gerek:

- Cloud Name: `fitojlfl`;
- Unsigned Upload Preset: `klas_unsigned`.

API Secret-i public repository-ä hiç wagt goýmaň.

`klas_unsigned` atly unsigned preset dörediň we Cloudinary Console-da çäklendiriň:

- formatlar: jpg, jpeg, png, webp, gif, mp4, webm;
- surat: iň köp 10 MB;
- wideo: iň köp 50 MB;
- custom public ID gadagan;
- asset folder: `klas`.

Bu bahalar `klas-config.js` içinde merkezi production konfigurasiýasy hökmünde sazlandy. Ulanyjy hiç zat girizmeýär: Google bilen giriş eden işjeň agza media saýlanda Klas degişli Cloudinary konfigurasiýasyny awtomatik ulanýar. Brauzer boýunça aýratyn Cloudinary override ýok.

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
