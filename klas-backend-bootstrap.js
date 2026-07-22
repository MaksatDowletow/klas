const statusNode = document.getElementById('backendStatus');
const styleHref = 'klas-livechat.css?v=20260722-live1';
if (![...document.styleSheets].some(sheet => sheet.href?.includes('klas-livechat.css'))) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleHref;
  document.head.appendChild(link);
}
try {
  await import('./klas-backend-ui.js');
  await import('./klas-backend-video.js');
} catch (error) {
  console.error('Klas backend başlangyjy başartmady', error);
  window.KlasBridge?.setCloudMode(false);
  if (statusNode) {
    statusNode.textContent = 'Ýerli režim · Firebase elýetersiz';
    statusNode.classList.add('error');
  }
  const authButton = document.getElementById('authBtn');
  if (authButton) {
    authButton.disabled = true;
    authButton.title = error?.message || 'Firebase modullary ýüklenmedi';
  }
}
