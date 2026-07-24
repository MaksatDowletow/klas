const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function cleanText(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

export function cleanClassName(value) {
  return cleanText(value, 12).toLocaleUpperCase('tk-TM');
}

export function cleanYears(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(year => Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR))]
    .sort((a, b) => a - b)
    .slice(0, 20);
}

export function schoolIdentity(person = {}) {
  const schoolId = cleanText(person.schoolId, 120);
  if (schoolId) return `id:${schoolId}`;
  const school = cleanText(person.school || person.schoolName, 120)
    .toLocaleLowerCase('tk-TM')
    .replace(/[^a-z0-9äçňöşüýž]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return school ? `name:${school}` : '';
}

export function normalizeMember(person = {}) {
  const graduationYear = Number(person.graduationYear);
  return {
    ...person,
    school: cleanText(person.school || person.schoolName, 120),
    schoolId: cleanText(person.schoolId, 120),
    schoolKey: schoolIdentity(person),
    className: cleanClassName(person.className || person.class),
    graduationYear: Number.isInteger(graduationYear) && graduationYear >= MIN_YEAR && graduationYear <= MAX_YEAR ? graduationYear : null,
    attendanceYears: cleanYears(person.attendanceYears),
    status: cleanText(person.status, 20)
  };
}

export function areClassmates(first, second) {
  const a = normalizeMember(first);
  const b = normalizeMember(second);
  return Boolean(a.schoolKey && b.schoolKey && a.schoolKey === b.schoolKey
    && a.className && b.className && a.className === b.className
    && a.graduationYear && b.graduationYear && a.graduationYear === b.graduationYear);
}

export function areMutualFriends(person) {
  return normalizeMember(person).status === 'friend';
}

export function classmatesFor(current, members = []) {
  return members.map(normalizeMember).filter(member => member.id !== current?.id && areClassmates(current, member));
}

export function friendsFor(members = []) {
  return members.map(normalizeMember).filter(areMutualFriends);
}

export function schoolYearGroups(members = []) {
  const groups = new Map();
  members.map(normalizeMember).forEach(member => {
    if (!member.schoolKey) return;
    member.attendanceYears.forEach(year => {
      const key = `${member.schoolKey}:${year}`;
      if (!groups.has(key)) groups.set(key, { key, schoolKey: member.schoolKey, school: member.school, year, members: [] });
      groups.get(key).members.push(member);
    });
  });
  return [...groups.values()].sort((a, b) => b.year - a.year || a.school.localeCompare(b.school, 'tk'));
}

export function schoolGroups(members = []) {
  const groups = new Map();
  members.map(normalizeMember).forEach(member => {
    if (!member.schoolKey) return;
    if (!groups.has(member.schoolKey)) groups.set(member.schoolKey, { key: member.schoolKey, schoolKey: member.schoolKey, school: member.school, members: [] });
    groups.get(member.schoolKey).members.push(member);
  });
  return [...groups.values()].sort((a, b) => b.members.length - a.members.length || a.school.localeCompare(b.school, 'tk'));
}
