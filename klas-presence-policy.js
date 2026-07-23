(function initialiseKlasPresencePolicy(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) root.KlasPresencePolicy = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  function toMillis(value) {
    return value?.toMillis?.()
      || value?.seconds * 1000
      || (value instanceof Date ? value.getTime() : Date.parse(value || ''))
      || 0;
  }

  function aggregate(sessions, { now = Date.now(), staleMs = 105000 } = {}) {
    const result = new Map();
    for (const session of sessions || []) {
      const uid = String(session?.uid || '');
      const updatedAt = toMillis(session?.updatedAt);
      if (!uid || !updatedAt) continue;
      const current = result.get(uid) || {
        online: false,
        lastSeen: null,
        timestamp: 0
      };
      if (updatedAt > current.timestamp) {
        current.lastSeen = session.updatedAt;
        current.timestamp = updatedAt;
      }
      const age = Math.max(0, now - updatedAt);
      if (session.state === 'online' && age <= staleMs) current.online = true;
      result.set(uid, current);
    }
    return result;
  }

  return Object.freeze({ aggregate, toMillis });
});
