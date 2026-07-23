(function initialiseKlasMediaViewer(root, factory) {
  'use strict';

  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) root.KlasMediaViewer = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, root => {
  'use strict';

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const AUTO_DELAY = 5000;
  const DIRECT_VIDEO = /\.(mp4|webm|ogg|mov)(?:[?#].*)?$/i;
  const gallery = {
    items: [],
    index: 0,
    scale: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
    autoTimer: null,
    returnFocus: null,
    options: {},
    pointers: new Map(),
    gesture: null,
    pinch: null
  };
  let ui = null;
  let eventsBound = false;

  function clampScale(value) {
    const scale = Number(value) || MIN_SCALE;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  }

  function nextIndex(index, delta, length) {
    if (!length) return 0;
    return ((Number(index) + Number(delta)) % length + length) % length;
  }

  function formatCounter(index, length) {
    return length ? `${Number(index) + 1} / ${length}` : '0 / 0';
  }

  function isDirectVideo(value) {
    return DIRECT_VIDEO.test(String(value || ''));
  }

  function safeMediaUrl(value, type = 'image') {
    const input = String(value || '').trim();
    if (type === 'image' && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(input)) return input;
    try {
      const url = new URL(input);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function cloudinaryThumbnail(value, type = 'image') {
    const source = safeMediaUrl(value, type);
    if (!source || !source.includes('res.cloudinary.com/')) return source;
    try {
      const url = new URL(source);
      if (type === 'image' && url.pathname.includes('/image/upload/')) {
        url.pathname = url.pathname.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_fill,w_720,h_720,dpr_auto/');
        return url.href;
      }
      if (type === 'video' && url.pathname.includes('/video/upload/')) {
        url.pathname = url.pathname
          .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto,c_fill,w_720,h_720,dpr_auto/')
          .replace(/\.[a-z0-9]+$/i, '.jpg');
        return url.href;
      }
    } catch { /* The original HTTPS URL remains a safe fallback. */ }
    return source;
  }

  function normaliseItems(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => {
      const type = item?.type === 'video' ? 'video' : 'image';
      const src = safeMediaUrl(item?.src, type);
      if (!src) return null;
      return {
        ...item,
        id: String(item.id || `media-${index}`),
        type,
        src,
        title: String(item.title || (type === 'video' ? 'Wideo' : 'Surat')).slice(0, 180),
        description: String(item.description || '').slice(0, 500)
      };
    }).filter(Boolean);
  }

  function ensureUi() {
    if (!root?.document) return null;
    if (ui) return ui;
    const document = root.document;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="media-viewer" id="mediaViewer" hidden aria-hidden="true">
        <div class="media-viewer-shell" role="dialog" aria-modal="true" aria-labelledby="mediaViewerTitle" tabindex="-1">
          <header class="media-viewer-header">
            <div class="media-viewer-heading">
              <span class="media-viewer-kicker">MEDIA VIEWER</span>
              <h2 id="mediaViewerTitle">Media</h2>
            </div>
            <span class="media-viewer-counter" id="mediaViewerCounter">0 / 0</span>
            <button class="media-viewer-icon" type="button" data-viewer-action="close" aria-label="Viewer-i ýap">✕</button>
          </header>
          <main class="media-viewer-stage" id="mediaViewerStage">
            <button class="media-viewer-nav previous" type="button" data-viewer-action="previous" aria-label="Öňki media">‹</button>
            <div class="media-viewer-viewport" id="mediaViewerViewport">
              <div class="media-viewer-loader" id="mediaViewerLoader" role="status">Media ýüklenýär…</div>
              <img class="media-viewer-image" id="mediaViewerImage" alt="" draggable="false" hidden>
              <video class="media-viewer-video" id="mediaViewerVideo" controls playsinline preload="metadata" hidden></video>
              <div class="media-viewer-external" id="mediaViewerExternal" hidden>
                <span aria-hidden="true">🎬</span>
                <b>Bu wideo daşarky player-de açylýar</b>
                <a class="primary" id="mediaViewerExternalLink" target="_blank" rel="noopener noreferrer">Wideony aç</a>
              </div>
            </div>
            <button class="media-viewer-nav next" type="button" data-viewer-action="next" aria-label="Indiki media">›</button>
          </main>
          <footer class="media-viewer-footer">
            <div class="media-viewer-details">
              <div><b id="mediaViewerItemTitle">Media</b><small id="mediaViewerItemMeta">Surat</small></div>
              <p id="mediaViewerDescription" hidden></p>
            </div>
            <div class="media-viewer-toolbar" role="toolbar" aria-label="Media amallary">
              <button type="button" data-viewer-action="auto" aria-pressed="false" title="Awto-slaýd (Space)">▶ <span>Awto</span></button>
              <button type="button" data-viewer-action="zoom-out" data-image-control title="Kiçelt (-)">−</button>
              <button type="button" class="zoom-value" data-viewer-action="zoom-reset" data-image-control title="Ululygy dikelt (0)">100%</button>
              <button type="button" data-viewer-action="zoom-in" data-image-control title="Ulalt (+)">＋</button>
              <button type="button" data-viewer-action="rotate-left" data-image-control title="Çepe öwür (L)">↶</button>
              <button type="button" data-viewer-action="rotate-right" data-image-control title="Saga öwür (R)">↷</button>
              <button type="button" data-viewer-action="fullscreen" title="Doly ekran (F)">⛶ <span>Doly ekran</span></button>
              <button type="button" data-viewer-action="share" title="Paýlaş">↗ <span>Paýlaş</span></button>
              <button type="button" data-viewer-action="copy" title="Linki nusgala (C)">⛓ <span>Link</span></button>
              <a data-viewer-original target="_blank" rel="noopener noreferrer" title="Asyl faýly aç">↗ <span>Asyl</span></a>
              <button class="danger" type="button" data-viewer-action="delete" hidden>🗑 <span>Aýyr</span></button>
            </div>
            <div class="media-viewer-thumbnails" id="mediaViewerThumbnails" role="tablist" aria-label="Media sanawy"></div>
          </footer>
          <div class="sr-only" id="mediaViewerAnnouncement" aria-live="polite"></div>
        </div>
      </div>`);
    ui = {
      root: document.getElementById('mediaViewer'),
      shell: document.querySelector('#mediaViewer .media-viewer-shell'),
      title: document.getElementById('mediaViewerTitle'),
      counter: document.getElementById('mediaViewerCounter'),
      stage: document.getElementById('mediaViewerStage'),
      viewport: document.getElementById('mediaViewerViewport'),
      loader: document.getElementById('mediaViewerLoader'),
      image: document.getElementById('mediaViewerImage'),
      video: document.getElementById('mediaViewerVideo'),
      external: document.getElementById('mediaViewerExternal'),
      externalLink: document.getElementById('mediaViewerExternalLink'),
      itemTitle: document.getElementById('mediaViewerItemTitle'),
      itemMeta: document.getElementById('mediaViewerItemMeta'),
      description: document.getElementById('mediaViewerDescription'),
      thumbnails: document.getElementById('mediaViewerThumbnails'),
      announcement: document.getElementById('mediaViewerAnnouncement'),
      auto: document.querySelector('[data-viewer-action="auto"]'),
      zoomValue: document.querySelector('[data-viewer-action="zoom-reset"]'),
      original: document.querySelector('[data-viewer-original]'),
      deleteButton: document.querySelector('[data-viewer-action="delete"]'),
      previous: document.querySelector('[data-viewer-action="previous"]'),
      next: document.querySelector('[data-viewer-action="next"]')
    };
    bindEvents();
    return ui;
  }

  function currentItem() {
    return gallery.items[gallery.index] || null;
  }

  function isOpen() {
    return Boolean(ui && !ui.root.hidden);
  }

  function resetTransform() {
    gallery.scale = 1;
    gallery.rotation = 0;
    gallery.panX = 0;
    gallery.panY = 0;
    applyTransform();
  }

  function applyTransform() {
    if (!ui) return;
    const quarterTurn = Math.abs(gallery.rotation % 180) === 90;
    const viewportRect = ui.viewport.getBoundingClientRect();
    const imageWidth = ui.image.offsetWidth || viewportRect.width;
    const imageHeight = ui.image.offsetHeight || viewportRect.height;
    const rotationFit = quarterTurn && imageWidth && imageHeight
      ? Math.min(1, viewportRect.width / imageHeight, viewportRect.height / imageWidth)
      : 1;
    const visualScale = gallery.scale * rotationFit;
    ui.image.style.transform = `translate3d(${gallery.panX}px, ${gallery.panY}px, 0) rotate(${gallery.rotation}deg) scale(${visualScale})`;
    ui.zoomValue.textContent = `${Math.round(gallery.scale * 100)}%`;
    ui.viewport.classList.toggle('is-zoomed', gallery.scale > 1);
  }

  function clampPan() {
    if (!ui || gallery.scale <= 1) {
      gallery.panX = 0;
      gallery.panY = 0;
      return;
    }
    const rect = ui.viewport.getBoundingClientRect();
    const limitX = rect.width * (gallery.scale - 1) / 2;
    const limitY = rect.height * (gallery.scale - 1) / 2;
    gallery.panX = Math.max(-limitX, Math.min(limitX, gallery.panX));
    gallery.panY = Math.max(-limitY, Math.min(limitY, gallery.panY));
  }

  function setScale(value) {
    gallery.scale = clampScale(value);
    clampPan();
    applyTransform();
  }

  function hideMedia() {
    ui.image.hidden = true;
    ui.image.removeAttribute('src');
    ui.video.pause();
    ui.video.hidden = true;
    ui.video.removeAttribute('src');
    ui.video.load();
    ui.external.hidden = true;
  }

  function showLoadError(item) {
    ui.loader.hidden = false;
    ui.loader.textContent = 'Media ýüklenmedi. Asyl faýly açyp görüň.';
    ui.loader.dataset.state = 'error';
    ui.original.href = item.src;
  }

  function renderThumbnails() {
    const document = root.document;
    ui.thumbnails.replaceChildren();
    gallery.items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-viewer-thumbnail';
      button.dataset.viewerIndex = String(index);
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(index === gallery.index));
      button.setAttribute('aria-label', `${index + 1}: ${item.title}`);
      if (item.type === 'image' || item.src.includes('res.cloudinary.com/')) {
        const image = document.createElement('img');
        image.src = cloudinaryThumbnail(item.src, item.type);
        image.alt = '';
        image.loading = 'lazy';
        button.appendChild(image);
      } else {
        const icon = document.createElement('span');
        icon.textContent = '🎬';
        button.appendChild(icon);
      }
      if (item.type === 'video') {
        const badge = document.createElement('i');
        badge.textContent = '▶';
        button.appendChild(badge);
      }
      ui.thumbnails.appendChild(button);
    });
  }

  function updateSelection() {
    ui.thumbnails.querySelectorAll('[data-viewer-index]').forEach((button, index) => {
      const active = index === gallery.index;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active) button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  function render() {
    const item = currentItem();
    if (!ui || !item) return;
    hideMedia();
    resetTransform();
    ui.loader.hidden = false;
    ui.loader.textContent = 'Media ýüklenýär…';
    ui.loader.dataset.state = 'loading';
    ui.root.classList.toggle('is-image', item.type === 'image');
    ui.root.classList.toggle('is-video', item.type === 'video');
    ui.title.textContent = item.title;
    ui.itemTitle.textContent = item.title;
    ui.itemMeta.textContent = item.type === 'video' ? 'Wideo' : 'Surat';
    ui.counter.textContent = formatCounter(gallery.index, gallery.items.length);
    ui.announcement.textContent = `${item.title}. ${formatCounter(gallery.index, gallery.items.length)}`;
    ui.description.textContent = item.description;
    ui.description.hidden = !item.description;
    ui.original.href = item.src;
    ui.previous.disabled = gallery.items.length < 2;
    ui.next.disabled = gallery.items.length < 2;
    ui.root.querySelectorAll('[data-image-control]').forEach(button => { button.disabled = item.type !== 'image'; });
    const canDelete = typeof gallery.options.canDelete === 'function' && gallery.options.canDelete(item);
    ui.deleteButton.hidden = !canDelete;

    if (item.type === 'image') {
      ui.image.alt = item.title;
      ui.image.onload = () => { ui.loader.hidden = true; applyTransform(); };
      ui.image.onerror = () => showLoadError(item);
      ui.image.hidden = false;
      ui.image.src = item.src;
    } else if (isDirectVideo(item.src) || item.src.includes('res.cloudinary.com/')) {
      ui.video.onloadeddata = () => { ui.loader.hidden = true; };
      ui.video.onerror = () => showLoadError(item);
      ui.video.hidden = false;
      ui.video.src = item.src;
      ui.video.load();
    } else {
      ui.loader.hidden = true;
      ui.external.hidden = false;
      ui.externalLink.href = item.src;
    }
    updateSelection();
  }

  function navigate(delta) {
    if (gallery.items.length < 2) return;
    gallery.index = nextIndex(gallery.index, delta, gallery.items.length);
    render();
  }

  function stopAuto() {
    root.clearInterval(gallery.autoTimer);
    gallery.autoTimer = null;
    if (ui?.auto) {
      ui.auto.setAttribute('aria-pressed', 'false');
      ui.auto.innerHTML = '▶ <span>Awto</span>';
    }
  }

  function toggleAuto() {
    if (gallery.autoTimer) return stopAuto();
    if (gallery.items.length < 2) return;
    gallery.autoTimer = root.setInterval(() => navigate(1), AUTO_DELAY);
    ui.auto.setAttribute('aria-pressed', 'true');
    ui.auto.innerHTML = '⏸ <span>Sakla</span>';
  }

  async function toggleFullscreen() {
    try {
      if (root.document.fullscreenElement) await root.document.exitFullscreen();
      else await ui.root.requestFullscreen();
    } catch (error) {
      root.KlasRuntime?.reportError(error, 'media-viewer:fullscreen');
    }
  }

  async function copyLink() {
    const item = currentItem();
    if (!item) return;
    try {
      await root.navigator.clipboard.writeText(item.src);
      root.KlasBridge?.toast?.('Media baglanyşygy nusgalandy');
    } catch {
      root.prompt?.('Media baglanyşygy:', item.src);
    }
  }

  async function shareItem() {
    const item = currentItem();
    if (!item) return;
    if (root.navigator.share) {
      try { await root.navigator.share({ title: item.title, url: item.src }); }
      catch (error) { if (error?.name !== 'AbortError') root.KlasRuntime?.reportError(error, 'media-viewer:share'); }
    } else await copyLink();
  }

  async function deleteItem() {
    const item = currentItem();
    if (!item || typeof gallery.options.onDelete !== 'function') return;
    const deleted = await gallery.options.onDelete(item);
    if (deleted === false) return;
    gallery.items.splice(gallery.index, 1);
    if (!gallery.items.length) return close();
    gallery.index = Math.min(gallery.index, gallery.items.length - 1);
    renderThumbnails();
    render();
  }

  function rotate(delta) {
    if (currentItem()?.type !== 'image') return;
    gallery.rotation = (gallery.rotation + delta) % 360;
    applyTransform();
  }

  async function handleAction(action) {
    if (action === 'close') close();
    else if (action === 'previous') navigate(-1);
    else if (action === 'next') navigate(1);
    else if (action === 'auto') toggleAuto();
    else if (action === 'zoom-in') setScale(gallery.scale + .25);
    else if (action === 'zoom-out') setScale(gallery.scale - .25);
    else if (action === 'zoom-reset') resetTransform();
    else if (action === 'rotate-left') rotate(-90);
    else if (action === 'rotate-right') rotate(90);
    else if (action === 'fullscreen') await toggleFullscreen();
    else if (action === 'copy') await copyLink();
    else if (action === 'share') await shareItem();
    else if (action === 'delete') await deleteItem();
  }

  function runAction(action) {
    Promise.resolve(handleAction(action)).catch(error => {
      root.KlasRuntime?.reportError(error, `media-viewer:${action}`);
      root.KlasBridge?.toast?.(error?.message || 'Media amaly başartmady');
    });
  }

  function pointerDistance() {
    const points = [...gallery.pointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }

  function handlePointerDown(event) {
    if (!isOpen() || currentItem()?.type !== 'image' || event.target.closest('button,a')) return;
    ui.viewport.setPointerCapture?.(event.pointerId);
    gallery.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gallery.pointers.size === 1) {
      gallery.gesture = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, at: Date.now() };
      ui.viewport.classList.add('is-dragging');
    } else if (gallery.pointers.size === 2) {
      gallery.pinch = { distance: pointerDistance(), scale: gallery.scale };
    }
  }

  function handlePointerMove(event) {
    if (!gallery.pointers.has(event.pointerId)) return;
    gallery.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gallery.pointers.size === 2 && gallery.pinch) {
      event.preventDefault();
      const distance = pointerDistance();
      if (gallery.pinch.distance) setScale(gallery.pinch.scale * distance / gallery.pinch.distance);
      return;
    }
    if (gallery.pointers.size === 1 && gallery.gesture && gallery.scale > 1) {
      event.preventDefault();
      gallery.panX += event.clientX - gallery.gesture.lastX;
      gallery.panY += event.clientY - gallery.gesture.lastY;
      gallery.gesture.lastX = event.clientX;
      gallery.gesture.lastY = event.clientY;
      clampPan();
      applyTransform();
    }
  }

  function handlePointerUp(event) {
    if (!gallery.pointers.has(event.pointerId)) return;
    const gesture = gallery.gesture;
    gallery.pointers.delete(event.pointerId);
    if (gallery.pointers.size < 2) gallery.pinch = null;
    if (!gallery.pointers.size) {
      ui.viewport.classList.remove('is-dragging');
      gallery.gesture = null;
      if (gesture && gallery.scale === 1 && Date.now() - gesture.at < 700) {
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) navigate(dx < 0 ? 1 : -1);
      }
    }
  }

  function focusableNodes() {
    return [...ui.shell.querySelectorAll('a[href],button:not([disabled]):not([hidden]),[tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.hidden && node.offsetParent !== null);
  }

  function handleKeydown(event) {
    if (!isOpen()) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key === 'Tab') {
      const nodes = focusableNodes();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes.at(-1);
      if (event.shiftKey && root.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && root.document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    const key = event.key.toLowerCase();
    const actions = {
      escape: 'close',
      arrowleft: 'previous',
      arrowright: 'next',
      ' ': 'auto',
      '+': 'zoom-in',
      '=': 'zoom-in',
      '-': 'zoom-out',
      '0': 'zoom-reset',
      l: 'rotate-left',
      r: 'rotate-right',
      f: 'fullscreen',
      c: 'copy'
    };
    if (!actions[key]) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runAction(actions[key]);
  }

  function bindEvents() {
    if (eventsBound || !ui) return;
    eventsBound = true;
    ui.root.addEventListener('click', event => {
      const action = event.target.closest('[data-viewer-action]')?.dataset.viewerAction;
      const thumbnail = event.target.closest('[data-viewer-index]');
      if (action) runAction(action);
      else if (thumbnail) {
        gallery.index = Number(thumbnail.dataset.viewerIndex) || 0;
        render();
      } else if (event.target === ui.root) close();
    });
    ui.viewport.addEventListener('wheel', event => {
      if (currentItem()?.type !== 'image') return;
      event.preventDefault();
      setScale(gallery.scale + (event.deltaY < 0 ? .2 : -.2));
    }, { passive: false });
    ui.viewport.addEventListener('dblclick', () => {
      if (currentItem()?.type === 'image') setScale(gallery.scale > 1 ? 1 : 2.5);
    });
    ui.viewport.addEventListener('pointerdown', handlePointerDown);
    ui.viewport.addEventListener('pointermove', handlePointerMove);
    ui.viewport.addEventListener('pointerup', handlePointerUp);
    ui.viewport.addEventListener('pointercancel', handlePointerUp);
    root.document.addEventListener('keydown', handleKeydown, true);
    root.document.addEventListener('fullscreenchange', () => {
      const button = ui.root.querySelector('[data-viewer-action="fullscreen"] span');
      if (button) button.textContent = root.document.fullscreenElement ? 'Çyk' : 'Doly ekran';
    });
    root.addEventListener('resize', () => { clampPan(); applyTransform(); });
  }

  function open(items, activeId, options = {}) {
    ensureUi();
    const validItems = normaliseItems(items);
    if (!ui || !validItems.length) return false;
    gallery.items = validItems;
    const requestedIndex = validItems.findIndex(item => item.id === String(activeId || ''));
    gallery.index = requestedIndex >= 0 ? requestedIndex : 0;
    gallery.options = options || {};
    gallery.returnFocus = root.document.activeElement;
    renderThumbnails();
    render();
    ui.root.hidden = false;
    ui.root.setAttribute('aria-hidden', 'false');
    root.document.body.classList.add('media-viewer-open', 'overlay-open');
    root.requestAnimationFrame(() => ui.shell.focus({ preventScroll: true }));
    return true;
  }

  function close() {
    if (!ui || ui.root.hidden) return;
    stopAuto();
    hideMedia();
    if (root.document.fullscreenElement === ui.root) root.document.exitFullscreen().catch(() => {});
    ui.root.hidden = true;
    ui.root.setAttribute('aria-hidden', 'true');
    root.document.body.classList.remove('media-viewer-open');
    if (!root.document.querySelector('#appModal.open, #lightbox.open')) root.document.body.classList.remove('overlay-open');
    const target = gallery.returnFocus;
    gallery.returnFocus = null;
    root.requestAnimationFrame(() => target?.focus?.({ preventScroll: true }));
  }

  return {
    MIN_SCALE,
    MAX_SCALE,
    clampScale,
    nextIndex,
    formatCounter,
    isDirectVideo,
    safeMediaUrl,
    cloudinaryThumbnail,
    normaliseItems,
    open,
    close,
    isOpen,
    navigate
  };
});
