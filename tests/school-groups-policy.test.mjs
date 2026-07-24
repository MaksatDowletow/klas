import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areClassmates,
  classmatesFor,
  friendsFor,
  schoolYearGroups,
  schoolGroups
} from '../klas-school-groups-policy.mjs';

const me = { id: 'me', schoolId: 'school-1', school: '1-nji mekdep', className: 'A', graduationYear: 2000, attendanceYears: [1990, 1991] };
const sameClass = { id: 'u1', schoolId: 'school-1', school: 'Başga ýazylan at', className: 'a', graduationYear: 2000, attendanceYears: [1991], status: 'friend' };
const otherClass = { id: 'u2', schoolId: 'school-1', className: 'B', graduationYear: 2000, attendanceYears: [1991], status: 'pending' };
const otherSchool = { id: 'u3', schoolId: 'school-2', school: '2-nji mekdep', className: 'A', graduationYear: 2000, attendanceYears: [1991], status: 'friend' };

test('classmates require the same school, class and graduation year', () => {
  assert.equal(areClassmates(me, sameClass), true);
  assert.equal(areClassmates(me, otherClass), false);
  assert.equal(areClassmates(me, otherSchool), false);
  assert.deepEqual(classmatesFor(me, [sameClass, otherClass, otherSchool]).map(item => item.id), ['u1']);
});

test('missing class data never falls back to a fabricated class', () => {
  assert.equal(areClassmates({ ...me, className: '' }, { ...sameClass, className: '' }), false);
});

test('friends contain only mutually confirmed relationships', () => {
  assert.deepEqual(friendsFor([sameClass, otherClass, otherSchool]).map(item => item.id), ['u1', 'u3']);
});

test('school year groups use explicit attendance years', () => {
  const groups = schoolYearGroups([me, sameClass, otherClass, otherSchool]);
  const group = groups.find(item => item.schoolKey === 'id:school-1' && item.year === 1991);
  assert.deepEqual(group.members.map(item => item.id).sort(), ['me', 'u1', 'u2']);
  assert.equal(groups.some(item => item.year === 2000), false);
});

test('schools are grouped by stable schoolId before display name', () => {
  const groups = schoolGroups([me, sameClass, otherSchool]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(item => item.schoolKey === 'id:school-1').members.length, 2);
});
