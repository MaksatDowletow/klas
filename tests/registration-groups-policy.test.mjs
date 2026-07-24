import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRegistrationGroupData, automaticGroupDefinitions } from '../klas-registration-groups-policy.mjs';

test('registration grouping data is normalized', () => {
  const data = normalizeRegistrationGroupData({
    school: '  Öde Abdullaýew adyndaky mekdep ',
    schoolId: ' school-1 ',
    className: ' a ',
    graduationYear: '2000',
    attendanceYears: '1990, 1991; 1991 1992'
  });
  assert.equal(data.schoolId, 'school-1');
  assert.equal(data.className, 'A');
  assert.deepEqual(data.attendanceYears, [1990, 1991, 1992]);
});

test('registration creates school, class and every attendance-year group', () => {
  const groups = automaticGroupDefinitions({
    school: 'Mekdep 1', schoolId: 'm1', className: 'B', graduationYear: 2000,
    attendanceYears: '1998,1999,2000'
  });
  assert.equal(groups.length, 5);
  assert.ok(groups.some(group => group.name.startsWith('Mekdep ·')));
  assert.ok(groups.some(group => group.name.startsWith('Klasdaşlar ·')));
  assert.equal(groups.filter(group => group.name.startsWith('Mekdep ýyly ·')).length, 3);
});

test('missing registration classification is rejected', () => {
  assert.throws(() => automaticGroupDefinitions({ school: '', className: 'A', graduationYear: 2000, attendanceYears: '1999' }), /Mekdebiň/);
  assert.throws(() => automaticGroupDefinitions({ school: 'M', className: '', graduationYear: 2000, attendanceYears: '1999' }), /Klasyňyzy/);
  assert.throws(() => automaticGroupDefinitions({ school: 'M', className: 'A', graduationYear: 2000, attendanceYears: '' }), /iň bolmanda bir/);
});
