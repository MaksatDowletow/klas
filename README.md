# Klas

Türkmen dilindäki mekdep jemgyýeti we synpdaşlar platformasy. Production frontend GitHub Pages-de işleýär; Google-only Firebase Authentication, Cloud Firestore realtime maglumatlary, Cloudinary media, WebRTC wideo jaň we Windows/Android PWA goldawy bar.

## Run locally

Open `index.html` in a browser, or serve the folder through any static web server.

Esasy runtime faýllary:

- `index.html`
- `klas-v4.css`
- `klas-backend-core.js`
- `klas-backend-ui.js`
- `firestore.rules`
- `service-worker.js`

## Authentication

Klas diňe Google provider-i we popup giriş akymyny ulanýar. Ilkinji üstünlikli Google giriş Firebase Authentication akkauntyny we `users/{uid}` + `profiles/{uid}` ýazgylaryny döredýär. Email/password, telefon we cross-origin redirect giriş akymlary ýok. Firestore maglumatlary diňe Google token-li, `active` ýagdaýly Klas agzalaryna açyk; öňki schema-daky doly bolmadyk akkaunt/profil ýazgylary girişde howpsuz täzelenýär.

Deployment we Firebase Console sazlamalary üçin `BACKEND_SETUP.md`, gizlinlik beýany üçin `privacy.html` faýlyna serediň.
