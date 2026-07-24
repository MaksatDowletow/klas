'use strict';

(() => {
  const installButtons = [
    document.getElementById('pwaInstallTopBtn'),
    document.getElementById('pwaInstallBtn')
  ].filter(Boolean);
  const statusNode = document.getElementById('pwaInstallStatus');
  let deferredPrompt = null;
  let waitingWorker = null;
  let registration = null;
  let refreshing = false;
  let updateTimer = 0;

  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const setStatus = text => { if (statusNode) statusNode.textContent = text; };
  const setButtons = ({ visible, label = 'Gur', mode = 'install' }) => {
    installButtons.forEach(button => {
      button.hidden = !visible;
      button.dataset.pwaAction = mode;
      button.disabled = false;
      if (button.id === 'pwaInstallBtn') button.textContent = label;
      else button.setAttribute('aria-label', mode === 'update' ? 'Klas-y täzele' : 'Klas-y programma hökmünde gur');
    });
  };
  const toast = text => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(window.__pwaToastTimer);
    window.__pwaToastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  };

  function showUpdate(worker){
    if (!worker) return;
    waitingWorker = worker;
    deferredPrompt = null;
    setStatus('Täze Klas wersiýasy taýýar. Täzelemek üçin düwmä basyň.');
    setButtons({ visible: true, label: 'Täzele', mode: 'update' });
  }

  async function checkForUpdate(){
    if (!registration || !navigator.onLine) return;
    try {
      await registration.update();
      if (registration.waiting) showUpdate(registration.waiting);
    } catch (error) {
      console.warn('Klas PWA täzeleniş barlagy başartmady', error);
    }
  }

  async function handleAction(){
    if (waitingWorker) {
      setStatus('Klas täzelenýär…');
      installButtons.forEach(button => { button.disabled = true; });
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice.outcome === 'accepted') {
      setStatus('Klas gurulýar…');
      setButtons({ visible: false });
    } else {
      setStatus('Programmany soňrak hem gurup bilersiňiz.');
    }
  }

  installButtons.forEach(button => button.addEventListener('click', handleAction));

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (isStandalone() || waitingWorker) return;
    deferredPrompt = event;
    setStatus('Windows ýa-da Android üçin Klas programmasy taýýar.');
    setButtons({ visible: true, label: 'Gur', mode: 'install' });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setButtons({ visible: false });
    setStatus('Klas programma hökmünde guruldy.');
    toast('Klas üstünlikli guruldy');
  });

  window.addEventListener('online', () => {
    setStatus(isStandalone() ? 'Programma görnüşinde açyk · online' : 'Offline režim taýýar · online');
    checkForUpdate();
  });
  window.addEventListener('offline', () => setStatus('Offline režim · käbir Firebase maglumatlary elýetersiz'));
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate();
  });

  if (isStandalone()) {
    setStatus('Programma görnüşinde açyk');
    setButtons({ visible: false });
  } else {
    setStatus('Offline režim taýýarlanýar…');
  }

  if (!('serviceWorker' in navigator)) {
    setStatus('Bu brauzer PWA gurmagy goldamaýar.');
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('./service-worker.js', {
        scope: './',
        updateViaCache: 'none'
      });
      if (registration.waiting) showUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      await checkForUpdate();
      clearInterval(updateTimer);
      updateTimer = window.setInterval(checkForUpdate, 30 * 60 * 1000);
      if (!waitingWorker && !deferredPrompt) {
        setStatus(isStandalone() ? 'Programma görnüşinde açyk' : 'Offline režim taýýar');
      }
    } catch (error) {
      console.error('Klas PWA service worker başartmady', error);
      window.KlasRuntime?.reportError(error, 'pwa:service-worker');
      setStatus('Offline režim işjeňleşmedi.');
    }
  });
})();
