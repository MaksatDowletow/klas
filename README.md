# Klas

Türkmen dilindäki mekdep jemgyýeti we synpdaşlar platformasy. Production frontend GitHub Pages-de işleýär; Google-only Firebase Authentication, Cloud Firestore realtime maglumatlary, Cloudinary media, WebRTC wideo jaň we Windows/Android PWA goldawy bar.

## Run locally

Open `index.html` in a browser, or serve the folder through any static web server.

Esasy runtime faýllary:

- `index.html`
- `klas-runtime.js`
- `klas-design-system.css`
- `klas-media-viewer.js`
- `klas-media-viewer.css`
- `klas-v4.css`
- `klas-backend-core.js`
- `klas-backend-ui.js`
- `firestore.rules`
- `service-worker.js`

## Authentication

Klas diňe Google provider-i we popup giriş akymyny ulanýar. Ilkinji üstünlikli Google giriş Firebase Authentication akkauntyny we `users/{uid}` + `profiles/{uid}` ýazgylaryny döredýär. Email/password, telefon we cross-origin redirect giriş akymlary ýok. Firestore maglumatlary diňe Google token-li, `active` ýagdaýly Klas agzalaryna açyk; öňki schema-daky doly bolmadyk akkaunt/profil ýazgylary girişde howpsuz täzelenýär.

Deployment we Firebase Console sazlamalary üçin `BACKEND_SETUP.md`, gizlinlik beýany üçin `privacy.html` faýlyna serediň.

## Architecture and tests

`klas-runtime.js` hash routing, wersiýalanan ýerli state, runtime eventleri, diagnostika we global error boundary üçin merkezi şertnamadyr. Öňki plain JSON maglumatlary ýitirilmezden täze storage envelope formatyna awtomatik geçirilýär. `klas-design-system.css` esasy CSS-den soň ýüklenýän token/accessibility gatlagydyr.

`klas-media-viewer.js` Media merkezi we postlardaky surat/wideolar üçin aýratyn fullscreen viewer berýär: thumbnail lenta, zoom/pan/pinch, touch swipe, öwürmek, awto-slaýd, link/Share, asyl faýl we klawiatura dolandyryşy. Cloudinary suratlary grid-de awtomatik optimizirlenen thumbnail bilen görkezilýär; asyl faýl diňe viewer açylanda ýüklenýär.

Cloudinary `fitojlfl / klas_unsigned` merkezi production konfigurasiýasydyr. Ulanyjy Cloud Name ýa-da preset girizmeýär; media ýüklemesi işjeň Google agzalary üçin awtomatik işleýär we brauzer boýunça aýratyn override ulanylmaýar.

Arhitektura serhedi we howpsuzlyk düzgünleri `ARCHITECTURE.md` faýlynda. Lokal regression testleri:

```sh
node --test tests/*.test.js
```
