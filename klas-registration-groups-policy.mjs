const text = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const slug = value => text(value).toLocaleLowerCase('tk-TM').replace(/[^a-z0-9äçňöşüýž]+/gi, '-').replace(/^-+|-+$/g, '');

export function normalizeRegistrationGroupData(input = {}) {
  const school = text(input.school, 120);
  const schoolId = text(input.schoolId, 120);
  const className = text(input.className, 12).toLocaleUpperCase('tk-TM');
  const graduationYear = Number(input.graduationYear);
  const attendanceYears = [...new Set(String(input.attendanceYears ?? '')
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100))]
    .sort((a, b) => a - b)
    .slice(0, 20);

  if (!school) throw new Error('Mekdebiň adyny ýazyň.');
  if (!className) throw new Error('Klasyňyzy ýazyň.');
  if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > 2100) throw new Error('Uçuryş ýyly nädogry.');
  if (!attendanceYears.length) throw new Error('Mekdebe baran iň bolmanda bir ýylyňyzy ýazyň.');

  return { school, schoolId, className, graduationYear, attendanceYears };
}

export function automaticGroupDefinitions(input = {}) {
  const data = normalizeRegistrationGroupData(input);
  const schoolKey = data.schoolId ? `id-${slug(data.schoolId)}` : `name-${slug(data.school)}`;
  const definitions = [
    {
      key: `school-${schoolKey}`,
      name: `Mekdep · ${data.school}`,
      icon: '🏫',
      description: `${data.school} mekdebine degişli agzalar.`
    },
    {
      key: `class-${schoolKey}-${slug(data.className)}-${data.graduationYear}`,
      name: `Klasdaşlar · ${data.school} · ${data.className} · ${data.graduationYear}`,
      icon: '👥',
      description: `Şol bir mekdepde, ${data.className} klasda we ${data.graduationYear}-nji ýylda uçurym bolan agzalar.`
    },
    ...data.attendanceYears.map(year => ({
      key: `year-${schoolKey}-${year}`,
      name: `Mekdep ýyly · ${data.school} · ${year}`,
      icon: '📅',
      description: `${year}-nji ýylda ${data.school} mekdebinde okan agzalar.`
    }))
  ];
  return definitions;
}
