import fs from 'node:fs';

function replace(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Patch target not found in ${path}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replace('klas-auth-policy.js',
`    bio: 500,
    school: 120
`,
`    bio: 500,
    school: 120,
    schoolId: 120,
    className: 12
`);

replace('klas-auth-policy.js',
`        profession: 'Hünär', bio: 'Bio', school: 'Mekdep ady'
`,
`        profession: 'Hünär', bio: 'Bio', school: 'Mekdep ady',
        schoolId: 'Mekdep ID-si', className: 'Klas'
`);

replace('klas-auth-policy.js',
`  function normalizeProfile(input = {}, fallback = {}) {
    return {
      fullName: cleanText(input.fullName, 'fullName', fallback.fullName),
      shortName: cleanText(input.shortName, 'shortName', fallback.shortName),
      city: cleanText(input.city, 'city', fallback.city),
      profession: cleanText(input.profession, 'profession', fallback.profession),
      bio: cleanText(input.bio, 'bio', fallback.bio),
      school: cleanText(input.school, 'school', fallback.school),
      graduationYear: normalizeGraduationYear(input.graduationYear, fallback.graduationYear),
      avatarURL: normalizeAvatar(input.avatarURL, fallback.avatarURL)
    };
  }
`,
`  function normalizeAttendanceYears(value, fallback = []) {
    const source = Array.isArray(value) ? value : fallback;
    const years = [...new Set(source.map(Number).filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100))]
      .sort((a, b) => a - b)
      .slice(0, 20);
    if (!years.length) throw createError('klas/invalid-profile', 'Mekdebe baran iň bolmanda bir ýylyňyzy görkeziň.');
    return years;
  }

  function normalizeProfile(input = {}, fallback = {}) {
    const school = cleanText(input.school, 'school', fallback.school);
    const className = cleanText(input.className, 'className', fallback.className).toLocaleUpperCase('tk-TM');
    if (!school) throw createError('klas/invalid-profile', 'Mekdebi saýlaň ýa-da adyny ýazyň.');
    if (!className) throw createError('klas/invalid-profile', 'Klasyňyzy ýazyň.');
    return {
      fullName: cleanText(input.fullName, 'fullName', fallback.fullName),
      shortName: cleanText(input.shortName, 'shortName', fallback.shortName),
      city: cleanText(input.city, 'city', fallback.city),
      profession: cleanText(input.profession, 'profession', fallback.profession),
      bio: cleanText(input.bio, 'bio', fallback.bio),
      school,
      schoolId: cleanText(input.schoolId, 'schoolId', fallback.schoolId),
      className,
      graduationYear: normalizeGraduationYear(input.graduationYear, fallback.graduationYear),
      attendanceYears: normalizeAttendanceYears(input.attendanceYears, fallback.attendanceYears),
      avatarURL: normalizeAvatar(input.avatarURL, fallback.avatarURL)
    };
  }
`);

replace('klas-backend-core.js',
`    school: 'Öde Abdullaýew adyndaky mekdep',
    graduationYear: 2000,
    online: false
`,
`    school: '',
    schoolId: '',
    className: '',
    graduationYear: 2000,
    attendanceYears: [],
    online: false
`);

replace('klas-backend-core.js',
`      school: repairText(previousProfile.school, base.school, 120),
      graduationYear: Number.isInteger(previousProfile.graduationYear)
`,
`      school: repairText(previousProfile.school, base.school, 120),
      schoolId: repairText(previousProfile.schoolId, '', 120),
      className: repairText(previousProfile.className, '', 12),
      attendanceYears: Array.isArray(previousProfile.attendanceYears) ? previousProfile.attendanceYears : [],
      graduationYear: Number.isInteger(previousProfile.graduationYear)
`);

replace('klas-backend-ui.js',
`    body:\`${'${authIdentity()}'}<div class="backend-modal-status">Google barlagy üstünlikli geçdi. Jemgyýetde görünjek maglumatlaryňyzy tassyklaň.</div><div class="form-grid"><div class="field"><label for="onboardName">Doly ady</label><input id="onboardName" maxlength="100" autocomplete="name" value="${'${safe(profile.fullName||runtime.user.displayName||\'\')}'}" required></div><div class="form-grid two"><div class="field"><label for="onboardCity">Şäher</label><input id="onboardCity" maxlength="80" autocomplete="address-level2" value="${'${safe(profile.city||\'\')}'}"></div><div class="field"><label for="onboardProfession">Hünär</label><input id="onboardProfession" maxlength="80" value="${'${safe(profile.profession||\'\')}'}"></div></div><div class="auth-school"><span>🏫</span><span><b>Öde Abdullaýew adyndaky mekdep</b><small>2000-nji ýylyň uçurymlary</small></span></div><label class="auth-consent"><input id="onboardConfirm" type="checkbox"> <span>Maglumatlaryň dogrudygyny tassyklaýaryn we <a href="./privacy.html" target="_blank" rel="noopener noreferrer">gizlinlik hem jemgyýet düzgünlerini</a> kabul edýärin.</span></label></div>\`,
`,
`    body:\`${'${authIdentity()}'}<div class="backend-modal-status">Bu maglumatlar sizi degişli klasdaşlar, mekdep ýyllary we mekdep toparlaryna awtomatik ýerleşdirýär.</div><div class="form-grid"><div class="field"><label for="onboardName">Doly ady</label><input id="onboardName" maxlength="100" autocomplete="name" value="${'${safe(profile.fullName||runtime.user.displayName||\'\')}'}" required></div><div class="form-grid two"><div class="field"><label for="onboardCity">Şäher</label><input id="onboardCity" maxlength="80" value="${'${safe(profile.city||\'\')}'}"></div><div class="field"><label for="onboardProfession">Hünär</label><input id="onboardProfession" maxlength="80" value="${'${safe(profile.profession||\'\')}'}"></div></div><div class="field"><label for="onboardSchool">Mekdep</label><input id="onboardSchool" maxlength="120" value="${'${safe(profile.school||\'\')}'}" required></div><div class="form-grid two"><div class="field"><label for="onboardSchoolId">Mekdep ID-si</label><input id="onboardSchoolId" maxlength="120" value="${'${safe(profile.schoolId||\'\')}'}" placeholder="mysal: ode-abdullayew-1"></div><div class="field"><label for="onboardClass">Klas</label><input id="onboardClass" maxlength="12" value="${'${safe(profile.className||\'\')}'}" placeholder="A" required></div></div><div class="form-grid two"><div class="field"><label for="onboardGraduation">Uçuryş ýyly</label><input id="onboardGraduation" type="number" min="1900" max="2100" value="${'${safe(profile.graduationYear||2000)}'}" required></div><div class="field"><label for="onboardYears">Mekdebe baran ýyllar</label><input id="onboardYears" value="${'${safe((profile.attendanceYears||[]).join(\', \'))}'}" placeholder="1990, 1991, 1992" required></div></div><label class="auth-consent"><input id="onboardConfirm" type="checkbox"> <span>Maglumatlaryň dogrudygyny tassyklaýaryn we jemgyýet düzgünlerini kabul edýärin.</span></label></div>\`,
`);

replace('klas-backend-ui.js',
`          school:'Öde Abdullaýew adyndaky mekdep',
          graduationYear:2000,
          avatarURL:profile.avatarURL||runtime.user.photoURL||''
`,
`          school:$('#onboardSchool').value.trim(),
          schoolId:$('#onboardSchoolId').value.trim(),
          className:$('#onboardClass').value.trim(),
          graduationYear:Number($('#onboardGraduation').value),
          attendanceYears:$('#onboardYears').value.split(/[,;\\s]+/).filter(Boolean).map(Number),
          avatarURL:profile.avatarURL||runtime.user.photoURL||''
`);

replace('klas-backend-ui.js',
`function profileEditor(){const p=runtime.profile||{};modal({title:'Firebase profili',confirmText:'Sakla',body:\`<div class="form-grid"><div class="field"><label>Doly ady</label><input id="rpName" maxlength="100" autocomplete="name" value="${'${safe(p.fullName||runtime.user.displayName||\'\')}'}"></div>`,
`function profileEditor(){const p=runtime.profile||{};modal({title:'Firebase profili',confirmText:'Sakla',body:\`<div class="form-grid"><div class="field"><label>Doly ady</label><input id="rpName" maxlength="100" autocomplete="name" value="${'${safe(p.fullName||runtime.user.displayName||\'\')}'}"></div><div class="field"><label>Mekdep</label><input id="rpSchool" maxlength="120" value="${'${safe(p.school||\'\')}'}"></div><div class="form-grid two"><div class="field"><label>Mekdep ID-si</label><input id="rpSchoolId" maxlength="120" value="${'${safe(p.schoolId||\'\')}'}"></div><div class="field"><label>Klas</label><input id="rpClass" maxlength="12" value="${'${safe(p.className||\'\')}'}"></div></div><div class="form-grid two"><div class="field"><label>Uçuryş ýyly</label><input id="rpGraduation" type="number" min="1900" max="2100" value="${'${safe(p.graduationYear||2000)}'}"></div><div class="field"><label>Mekdebe baran ýyllar</label><input id="rpYears" value="${'${safe((p.attendanceYears||[]).join(\', \'))}'}"></div></div>`);

replace('klas-backend-ui.js',
`await saveProfile({fullName,shortName:fullName.split(/\\s+/)[0],city:$('#rpCity').value.trim(),profession:$('#rpJob').value.trim(),bio:$('#rpBio').value.trim(),avatarURL});`,
`await saveProfile({fullName,shortName:fullName.split(/\\s+/)[0],city:$('#rpCity').value.trim(),profession:$('#rpJob').value.trim(),bio:$('#rpBio').value.trim(),school:$('#rpSchool').value.trim(),schoolId:$('#rpSchoolId').value.trim(),className:$('#rpClass').value.trim(),graduationYear:Number($('#rpGraduation').value),attendanceYears:$('#rpYears').value.split(/[,;\\s]+/).filter(Boolean).map(Number),avatarURL});`);

replace('firestore.rules',
`        && validText(data.get('school', ''), 120, false)
        && validHttpsOrEmpty(data.get('avatarURL', ''))
`,
`        && validText(data.get('school', ''), 120, true)
        && validText(data.get('schoolId', ''), 120, false)
        && validText(data.get('className', ''), 12, true)
        && data.get('attendanceYears', []) is list
        && data.get('attendanceYears', []).size() > 0
        && data.get('attendanceYears', []).size() <= 20
        && data.get('attendanceYears', []).toSet().size() == data.get('attendanceYears', []).size()
        && data.get('attendanceYears', []).toSet().difference([1900,1901,1902,1903,1904,1905,1906,1907,1908,1909,1910,1911,1912,1913,1914,1915,1916,1917,1918,1919,1920,1921,1922,1923,1924,1925,1926,1927,1928,1929,1930,1931,1932,1933,1934,1935,1936,1937,1938,1939,1940,1941,1942,1943,1944,1945,1946,1947,1948,1949,1950,1951,1952,1953,1954,1955,1956,1957,1958,1959,1960,1961,1962,1963,1964,1965,1966,1967,1968,1969,1970,1971,1972,1973,1974,1975,1976,1977,1978,1979,1980,1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040,2041,2042,2043,2044,2045,2046,2047,2048,2049,2050,2051,2052,2053,2054,2055,2056,2057,2058,2059,2060,2061,2062,2063,2064,2065,2066,2067,2068,2069,2070,2071,2072,2073,2074,2075,2076,2077,2078,2079,2080,2081,2082,2083,2084,2085,2086,2087,2088,2089,2090,2091,2092,2093,2094,2095,2096,2097,2098,2099,2100]).size() == 0
        && validHttpsOrEmpty(data.get('avatarURL', ''))
`);

replace('firestore.rules',
`          'uid', 'fullName', 'shortName', 'avatarURL', 'city', 'bio', 'school',
          'graduationYear', 'profession', 'online', 'lastSeen', 'createdAt', 'updatedAt'
`,
`          'uid', 'fullName', 'shortName', 'avatarURL', 'city', 'bio', 'school', 'schoolId',
          'className', 'attendanceYears', 'graduationYear', 'profession', 'online', 'lastSeen', 'createdAt', 'updatedAt'
`);

replace('firestore.rules',
`          'avatarURL', 'city', 'bio', 'school',
          'graduationYear', 'profession', 'online', 'lastSeen', 'updatedAt'
`,
`          'avatarURL', 'city', 'bio', 'school', 'schoolId', 'className', 'attendanceYears',
          'graduationYear', 'profession', 'online', 'lastSeen', 'updatedAt'
`);

replace('service-worker.js', "const CACHE_VERSION = 'klas-shell-v6.4.1';", "const CACHE_VERSION = 'klas-shell-v6.4.2';");
replace('health.json', '"cacheVersion": "6.4.1"', '"cacheVersion": "6.4.2"');
replace('health.json', '"school-id-groups"]', '"school-id-groups", "registration-auto-grouping"]');

console.log('Registration auto-grouping patch applied.');
