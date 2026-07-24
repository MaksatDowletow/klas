'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const contacts = require('../klas-contact-sync.js');

test('normalizes Turkmen names and ignores word order', () => {
  assert.equal(contacts.normalizeName('  AÝLAR   Rejepowa '), 'aylar rejepowa');
  assert.equal(contacts.canonicalName('Rejepowa, Aýlar'), contacts.canonicalName('Aýlar Rejepowa'));
  assert.equal(contacts.normalizeName('Şöhrat Çaryýew'), 'sohrat caryyew');
});

test('parses standard, folded and quoted-printable vCards', () => {
  const parsed = contacts.parseVCard([
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Rejepowa;Aýlar;;;',
    'FN:Aýlar Rejepow',
    ' a',
    'TEL;TYPE=CELL:+993 61 12 34 56',
    'EMAIL:aYlar@example.com',
    'END:VCARD',
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=A4hri Ata=C3=BDewa',
    'TEL:+99362123456',
    'END:VCARD'
  ].join('\r\n'));

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], {
    name: 'Aýlar Rejepowa',
    emails: ['aYlar@example.com'],
    phones: ['+99361123456']
  });
  assert.equal(parsed[1].name, 'Mähri Ataýewa');
  assert.deepEqual(parsed[1].phones, ['+99362123456']);
});

test('rejects invalid and oversized vCard input', () => {
  assert.throws(() => contacts.parseVCard('not a vcard'), /kontakt tapylmady/);
  assert.throws(() => contacts.parseVCard('x'.repeat(contacts.MAX_VCARD_BYTES + 1)), /5 MB/);
});

test('matches only a unique exact full name and de-duplicates members', () => {
  const selected = [
    { name: ['Rejepowa Aýlar'], tel: ['+99361111111'] },
    { name: ['Aýlar Rejepowa'], email: ['duplicate@example.com'] },
    { name: ['Serdar Ataýew'], email: ['serdar@example.com'] },
    { name: ['Mähri Annaýewa'], tel: ['+99362222222'] }
  ];
  const people = [
    { id: 'aylar', uid: 'u1', name: 'Aýlar Rejepowa' },
    { id: 'serdar-1', uid: 'u2', name: 'Serdar Ataýew' },
    { id: 'serdar-2', uid: 'u3', name: 'Serdar Ataýew' }
  ];
  const result = contacts.matchContacts(selected, people);

  assert.equal(result.selected.length, 4);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].person.uid, 'u1');
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.ambiguous.length, 1);
});

test('persistent summary contains counts only and no contact identifiers', () => {
  const result = contacts.matchContacts(
    [{ name: 'Aýlar Rejepowa', tel: '+99361111111', email: 'aylar@example.com' }],
    [{ id: 'aylar', uid: 'secret-user-id', name: 'Aýlar Rejepowa' }]
  );
  const summary = contacts.createSummary(result, 'device', new Date('2026-07-24T08:00:00Z'));
  const serialized = JSON.stringify(summary);

  assert.deepEqual(Object.keys(summary), [
    'version',
    'source',
    'selectedCount',
    'matchedCount',
    'unmatchedCount',
    'ambiguousCount',
    'syncedAt'
  ]);
  assert.doesNotMatch(serialized, /9936|example\.com|Aýlar|secret-user-id/);

  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  assert.equal(contacts.writeSummary(storage, summary), true);
  assert.deepEqual(contacts.readSummary(storage), summary);
  assert.equal(contacts.removeSummary(storage), true);
  assert.equal(contacts.readSummary(storage), null);
});

test('uses only picker-supported minimum contact fields', async () => {
  let request = null;
  const navigatorObject = {
    contacts: {
      getProperties: async () => ['name', 'tel', 'address', 'icon'],
      select: async (properties, options) => {
        request = { properties, options };
        return [{ name: ['Maksat Dowletow'], tel: ['+993 65 000000'], address: ['private'] }];
      }
    }
  };
  const selected = await contacts.pickContacts(navigatorObject);

  assert.deepEqual(request, { properties: ['name', 'tel'], options: { multiple: true } });
  assert.deepEqual(selected, [{
    name: 'Maksat Dowletow',
    emails: [],
    phones: ['+99365000000']
  }]);
  assert.equal(contacts.pickerSupported({}), false);
});
