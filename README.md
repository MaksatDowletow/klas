# Klas

Türkmen dilindäki mekdep jemgyýeti we synpdaşlar platformasy. Production frontend GitHub Pages-de işleýär; Google-only Firebase Authentication, Cloud Firestore realtime maglumatlary, Cloudinary media, WebRTC wideo jaň we Windows/Android PWA goldawy bar.

## Run locally

Open `index.html` in a browser, or serve the folder through any static web server.

Esasy runtime faýllary:

- `index.html`
- `klas-runtime.js`
- `klas-presence-policy.js`
- `klas-contact-sync.js`
- `klas-design-system.css`
- `klas-media-viewer.js`
- `klas-media-viewer.css`
- `klas-v4.css`
- `klas-backend-core.js`
- `klas-backend-ui.js`
- `firestore.rules`
- `service-worker.js`

## Authentication

Klas diňe Google provider-i we popup giriş akymyny ulanýar. Popup üstünlikli geçenden soň UI ilki `users/{uid}` hasabyny döredýär, diňe şondan soň şol ulanyjynyň öz `profiles/{uid}` ýazgysyny barlap/taýýarlaýar we bootstrap doly gutarýança garaşýar. Täze hasabyň profil tassyklamasy we jemgyýet düzgünleriniň kabul edilmegi bir atomik tranzaksiýada ýazylýar. Email/password, telefon we cross-origin redirect giriş akymlary ýok. Firestore maglumatlary diňe Google token-li, `active` ýagdaýly Klas agzalaryna açyk; onboarding-den öň diňe öz profil bootstrap okalyşy rugsatly, `blocked` hasap bolsa öz profilini hem okap ýa-da özüni açyp bilmeýär.

Deployment we Firebase Console sazlamalary üçin `BACKEND_SETUP.md`, gizlinlik beýany üçin `privacy.html` faýlyna serediň.

## Architecture and tests

`klas-runtime.js` hash routing, wersiýalanan ýerli state, runtime eventleri, diagnostika we global error boundary üçin merkezi şertnamadyr. Öňki plain JSON maglumatlary ýitirilmezden täze storage envelope formatyna awtomatik geçirilýär. `klas-design-system.css` esasy CSS-den soň ýüklenýän token/accessibility gatlagydyr.

`klas-media-viewer.js` Media merkezi we postlardaky surat/wideolar üçin aýratyn fullscreen viewer berýär: thumbnail lenta, zoom/pan/pinch, touch swipe, öwürmek, awto-slaýd, link/Share, asyl faýl we klawiatura dolandyryşy. Cloudinary suratlary grid-de awtomatik optimizirlenen thumbnail bilen görkezilýär; asyl faýl diňe viewer açylanda ýüklenýär.

Cloudinary `fitojlfl / klas_unsigned` merkezi production konfigurasiýasydyr. Ulanyjy Cloud Name ýa-da preset girizmeýär; media ýüklemesi işjeň Google agzalary üçin awtomatik işleýär we brauzer boýunça aýratyn override ulanylmaýar.

Firestore 1:1 çaty ähli production giriş nokatlarynda — synpdaş, onlaýn avatar, global gözleg we **Täze çat** modal — şol bir deterministik dialogy açýar. Täze dialog diňe iki işjeň, onboarding-i tamamlanan agzanyň arasynda döredilýär; habarlary, typing ýagdaýyny we `Görüldi` belgisini diňe şol iki gatnaşyjy okap/ýazyp bilýär.

Online ýagdaý profil baýdagyndan aýratyn `presenceSessions/{sessionId}` realtime sessiýalary arkaly hasaplanýar. Her brauzer tab-y öz heartbeat-ini berýär; başga tab-yň ýapylmagy işjeň sessiýany öçürmeýär. Logout/pagehide ýagdaýy derrew `offline` ýazýar, duýdansyz ýapylan ýa-da interneti kesilen sessiýa bolsa 105 sekuntdan soň UI-da awtomatik könelýär. Synpdaşlar, global gözleg, sag panel we çat sözbaşysy şol bir realtime çeşmäni ulanýar.

Kontakt sinhronizasiýasy Android Chromium/PWA-da Contact Picker API arkaly, beýleki brauzerlerde `.vcf` import arkaly işleýär. Ulanyjy her gezek kontaktlary özi saýlaýar. `klas-contact-sync.js` VCF maglumatyny lokally parse edýär, Turkmen atlaryny normalizasiýa edýär we diňe bir ýeke-täk doly at gabat gelen ýagdaýynda işjeň Klas profilini görkezýär. Telefon/e-poçta maglumatlary tora ugradylmaýar ýa-da persistent storage-da saklanmaýar; diňe sanlar we soňky barlag wagty saklanýar.

Arhitektura serhedi we howpsuzlyk düzgünleri `ARCHITECTURE.md` faýlynda. Lokal regression testleri:

```sh
node --test tests/*.test.js
```
