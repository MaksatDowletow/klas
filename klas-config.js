/**
 * Klas production configuration.
 * Firebase web config is intentionally public. Never add Cloudinary API Secret here.
 */
window.KLAS_CONFIG = Object.freeze({
  firebase: Object.freeze({
    apiKey: 'AIzaSyDn9b_0m15W5tk6fYq4PQwToJLwHHuFVYg',
    authDomain: 'project-789b5025-7a3c-4b74-88b.firebaseapp.com',
    projectId: 'project-789b5025-7a3c-4b74-88b',
    storageBucket: 'project-789b5025-7a3c-4b74-88b.firebasestorage.app',
    messagingSenderId: '608095045728',
    appId: '1:608095045728:web:aadf57f6b130927868db05'
  }),
  cloudinary: Object.freeze({
    cloudName: '',
    uploadPreset: 'klas_unsigned',
    maxImageBytes: 10 * 1024 * 1024,
    maxVideoBytes: 50 * 1024 * 1024
  }),
  app: Object.freeze({
    version: '5.0.0',
    firebaseSdkVersion: '12.16.0',
    allowLocalFallback: true
  })
});
