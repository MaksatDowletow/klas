(function initialiseKlasContactSync(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) root.KlasContactSync = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const MAX_CONTACTS = 1000;
  const MAX_VCARD_BYTES = 5 * 1024 * 1024;
  const SUMMARY_VERSION = 1;
  const SUMMARY_KEY = 'klas-contact-sync-summary';
  const TURKMEN_FOLD = Object.freeze({
    ä: 'a',
    ç: 'c',
    ň: 'n',
    ö: 'o',
    ş: 's',
    ü: 'u',
    ý: 'y',
    ž: 'z'
  });

  function cleanText(value, limit = 160) {
    return String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function firstValue(value) {
    const list = Array.isArray(value) ? value : [value];
    return list.map(item => cleanText(item)).find(Boolean) || '';
  }

  function listValues(value, limit, itemLimit) {
    const list = Array.isArray(value) ? value : [value];
    return [...new Set(list
      .map(item => cleanText(item, itemLimit))
      .filter(Boolean))]
      .slice(0, limit);
  }

  function normalizeName(value) {
    return cleanText(value, 200)
      .toLocaleLowerCase('tk-TM')
      .replace(/[äçňöşüýž]/g, character => TURKMEN_FOLD[character] || character)
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function canonicalName(value) {
    const normalized = normalizeName(value);
    if (!normalized) return '';
    return normalized.split(' ').sort((left, right) => left.localeCompare(right)).join(' ');
  }

  function normalizePhone(value) {
    const cleaned = cleanText(value, 60).replace(/[^\d+*#,;]/g, '');
    return cleaned.replace(/(?!^)\+/g, '').slice(0, 40);
  }

  function normalizeEmail(value) {
    const cleaned = cleanText(value, 254);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : '';
  }

  function sanitizeContact(contact = {}) {
    const name = firstValue(contact.name || contact.fullName || contact.fn);
    const emails = listValues(contact.email || contact.emails, 5, 254)
      .map(normalizeEmail)
      .filter(Boolean);
    const phones = listValues(contact.tel || contact.phone || contact.phones, 5, 60)
      .map(normalizePhone)
      .filter(Boolean);
    return Object.freeze({
      name,
      emails: Object.freeze([...new Set(emails)]),
      phones: Object.freeze([...new Set(phones)])
    });
  }

  function sanitizeContacts(contacts) {
    if (!Array.isArray(contacts)) return [];
    return contacts
      .slice(0, MAX_CONTACTS)
      .map(sanitizeContact)
      .filter(contact => contact.name || contact.emails.length || contact.phones.length);
  }

  function decodeQuotedPrintable(value) {
    try {
      const encoded = String(value || '')
        .replace(/%(?![0-9a-f]{2})/gi, '%25')
        .replace(/=([0-9a-f]{2})/gi, '%$1');
      return decodeURIComponent(encoded);
    } catch {
      return String(value || '').replace(/=([0-9a-f]{2})/gi, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16)));
    }
  }

  function decodeBase64(value) {
    try {
      let binary = '';
      if (typeof atob === 'function') binary = atob(String(value || '').replace(/\s+/g, ''));
      else if (typeof Buffer !== 'undefined') return Buffer.from(String(value || ''), 'base64').toString('utf8');
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
      return '';
    }
  }

  function decodeVCardValue(value, metadata = '') {
    let decoded = String(value || '');
    if (/ENCODING=(?:QUOTED-PRINTABLE|QP)/i.test(metadata)) decoded = decodeQuotedPrintable(decoded);
    else if (/ENCODING=(?:B|BASE64)/i.test(metadata)) decoded = decodeBase64(decoded);
    return decoded
      .replace(/\\n/gi, ' ')
      .replace(/\\([,;:\\])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function nameFromStructuredValue(value) {
    const [family = '', given = '', additional = '', prefix = '', suffix = ''] =
      String(value || '').split(';').map(part => cleanText(part));
    return [prefix, given, additional, family, suffix].filter(Boolean).join(' ');
  }

  function parseVCard(input) {
    const source = String(input || '');
    if (source.length > MAX_VCARD_BYTES) throw new Error('VCF faýly 5 MB-dan uly bolmaly däl.');
    const unfolded = source
      .replace(/\r\n|\r/g, '\n')
      .replace(/=\n/g, '')
      .replace(/\n[ \t]/g, '');
    const cards = [...unfolded.matchAll(/BEGIN:VCARD\s*\n([\s\S]*?)\nEND:VCARD/gi)];
    if (!cards.length) throw new Error('VCF faýlynda kontakt tapylmady.');
    if (cards.length > MAX_CONTACTS) throw new Error('Bir gezekde iň köp 1000 kontakt kabul edilýär.');

    const contacts = cards.map(match => {
      const values = { names: [], structuredNames: [], emails: [], phones: [] };
      match[1].split('\n').forEach(line => {
        const separator = line.indexOf(':');
        if (separator < 1) return;
        const metadata = line.slice(0, separator);
        const property = metadata.split(';')[0].split('.').at(-1).toUpperCase();
        const value = decodeVCardValue(line.slice(separator + 1), metadata);
        if (!value) return;
        if (property === 'FN') values.names.push(value);
        else if (property === 'N') values.structuredNames.push(nameFromStructuredValue(value));
        else if (property === 'EMAIL') values.emails.push(value);
        else if (property === 'TEL') values.phones.push(value);
      });
      return sanitizeContact({
        name: values.names[0] || values.structuredNames[0] || '',
        emails: values.emails,
        phones: values.phones
      });
    });
    return contacts.filter(contact => contact.name || contact.emails.length || contact.phones.length);
  }

  function personKey(person = {}) {
    return String(person.uid || person.id || '').trim();
  }

  function matchContacts(contacts, people) {
    const safeContacts = sanitizeContacts(contacts);
    const members = Array.isArray(people) ? people.filter(person => personKey(person) && canonicalName(person.name)) : [];
    const memberIndex = new Map();
    members.forEach(person => {
      const key = canonicalName(person.name);
      const list = memberIndex.get(key) || [];
      list.push(person);
      memberIndex.set(key, list);
    });

    const matches = [];
    const unmatched = [];
    const ambiguous = [];
    const matchedMembers = new Set();
    safeContacts.forEach(contact => {
      const candidates = memberIndex.get(canonicalName(contact.name)) || [];
      if (candidates.length !== 1) {
        (candidates.length > 1 ? ambiguous : unmatched).push(contact);
        return;
      }
      const person = candidates[0];
      const key = personKey(person);
      if (matchedMembers.has(key)) return;
      matchedMembers.add(key);
      matches.push(Object.freeze({ contact, person, reason: 'exact-name' }));
    });
    return Object.freeze({
      selected: Object.freeze(safeContacts),
      matches: Object.freeze(matches),
      unmatched: Object.freeze(unmatched),
      ambiguous: Object.freeze(ambiguous)
    });
  }

  function createSummary(result, source = 'device', now = new Date()) {
    return Object.freeze({
      version: SUMMARY_VERSION,
      source: source === 'vcard' ? 'vcard' : 'device',
      selectedCount: Number(result?.selected?.length) || 0,
      matchedCount: Number(result?.matches?.length) || 0,
      unmatchedCount: Number(result?.unmatched?.length) || 0,
      ambiguousCount: Number(result?.ambiguous?.length) || 0,
      syncedAt: new Date(now).toISOString()
    });
  }

  function validateSummary(value) {
    if (!value || value.version !== SUMMARY_VERSION) return null;
    const syncedAt = new Date(value.syncedAt);
    if (Number.isNaN(syncedAt.getTime())) return null;
    return Object.freeze({
      version: SUMMARY_VERSION,
      source: value.source === 'vcard' ? 'vcard' : 'device',
      selectedCount: Math.max(0, Number(value.selectedCount) || 0),
      matchedCount: Math.max(0, Number(value.matchedCount) || 0),
      unmatchedCount: Math.max(0, Number(value.unmatchedCount) || 0),
      ambiguousCount: Math.max(0, Number(value.ambiguousCount) || 0),
      syncedAt: syncedAt.toISOString()
    });
  }

  function readSummary(storage, key = SUMMARY_KEY) {
    try {
      return validateSummary(JSON.parse(storage?.getItem(key) || 'null'));
    } catch {
      return null;
    }
  }

  function writeSummary(storage, summary, key = SUMMARY_KEY) {
    try {
      const safe = validateSummary(summary);
      if (!safe || !storage) return false;
      storage.setItem(key, JSON.stringify(safe));
      return true;
    } catch {
      return false;
    }
  }

  function removeSummary(storage, key = SUMMARY_KEY) {
    try {
      storage?.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function pickerSupported(navigatorObject) {
    return Boolean(navigatorObject?.contacts && typeof navigatorObject.contacts.select === 'function');
  }

  async function pickContacts(navigatorObject) {
    if (!pickerSupported(navigatorObject)) {
      throw new Error('Bu brauzer kontakt saýlaýjysyny goldamaýar. VCF faýlyny saýlaň.');
    }
    const desired = ['name', 'email', 'tel'];
    let properties = desired;
    if (typeof navigatorObject.contacts.getProperties === 'function') {
      const supported = await navigatorObject.contacts.getProperties();
      properties = desired.filter(property => supported.includes(property));
    }
    if (!properties.length) throw new Error('Brauzer paýlaşylýan kontakt meýdanlaryny goldamaýar.');
    const selected = await navigatorObject.contacts.select(properties, { multiple: true });
    return sanitizeContacts(selected);
  }

  function preferredInviteChannel(contact) {
    const safe = sanitizeContact(contact);
    if (safe.phones[0]) return Object.freeze({ type: 'sms', target: safe.phones[0] });
    if (safe.emails[0]) return Object.freeze({ type: 'email', target: safe.emails[0] });
    return Object.freeze({ type: 'share', target: '' });
  }

  return Object.freeze({
    MAX_CONTACTS,
    MAX_VCARD_BYTES,
    SUMMARY_KEY,
    cleanText,
    normalizeName,
    canonicalName,
    sanitizeContact,
    sanitizeContacts,
    parseVCard,
    matchContacts,
    createSummary,
    readSummary,
    writeSummary,
    removeSummary,
    pickerSupported,
    pickContacts,
    preferredInviteChannel
  });
});
