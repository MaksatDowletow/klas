import fs from 'node:fs';

const rulesPath = 'firestore.rules';
let rules = fs.readFileSync(rulesPath, 'utf8');
rules = rules.replace(/^\s*&& data\.get\('attendanceYears'.*\.difference\(\[.*$/m, '');
fs.writeFileSync(rulesPath, rules);

const testPath = 'tests/registration-auto-grouping.test.js';
fs.writeFileSync(testPath, `'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../klas-auth-policy.js');

test('registration requires school, class and attendance years', () => {
  assert.throws(() => policy.normalizeProfile({ fullName:'A B', shortName:'A', school:'', className:'A', graduationYear:2000, attendanceYears:[1990], avatarURL:'' }), /Mekdebi/);
  assert.throws(() => policy.normalizeProfile({ fullName:'A B', shortName:'A', school:'Mekdep', className:'', graduationYear:2000, attendanceYears:[1990], avatarURL:'' }), /Klasy/);
  assert.throws(() => policy.normalizeProfile({ fullName:'A B', shortName:'A', school:'Mekdep', className:'A', graduationYear:2000, attendanceYears:[], avatarURL:'' }), /iň bolmanda bir/);
});

test('registration normalizes automatic grouping fields', () => {
  const profile = policy.normalizeProfile({ fullName:'A B', shortName:'A', school:'  Mekdep  ', schoolId:' school-1 ', className:' a ', graduationYear:'2000', attendanceYears:['1991',1990,1991], avatarURL:'' });
  assert.equal(profile.school, 'Mekdep');
  assert.equal(profile.schoolId, 'school-1');
  assert.equal(profile.className, 'A');
  assert.deepEqual(profile.attendanceYears, [1990,1991]);
});
`);

console.log('Registration grouping rules and tests finalized.');
