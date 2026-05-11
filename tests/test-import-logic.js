/**
 * Unit tests for the Excel import validation and phone normalization logic.
 * Run with: node tests/test-import-logic.js
 * No external dependencies required.
 */

// ── Logic stubs (mirror MPadmin.html implementation) ──────────────────────
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  if (digits.length === 9 && digits.startsWith('5')) return '972' + digits;
  return digits.length >= 10 ? digits : null;
}

function isValidIsraelMobile(cell) {
  const d = String(cell || '').replace(/\D/g, '');
  return /^05[0-9]{8}$/.test(d) || /^9725[0-9]{8}$/.test(d);
}

function sanitizeGuestName(name) {
  return String(name || 'אורח/ת').trim().replace(/[<>]/g, '');
}

/**
 * Simulates doImport() without a real Supabase connection.
 * Returns { successes, failures } arrays.
 */
function simulateImport(rows, colMap, existingPhones = new Set()) {
  const successes = [];
  const failures  = [];
  const seenPhones = new Set(existingPhones);

  for (const row of rows) {
    const rawName = (row[colMap.name] || '').trim();
    const raw     = colMap.phone ? (row[colMap.phone] || '') : '';
    const cat     = colMap.category ? (row[colMap.category] || '').trim() : '';
    const sideRaw = colMap.side  ? (row[colMap.side]  || '').trim() : '';

    if (!rawName) { failures.push({ row, reason: 'שם ריק' }); continue; }

    const name = sanitizeGuestName(rawName);

    const phone = normalizePhone(raw);
    if (raw && !isValidIsraelMobile(phone || raw)) {
      failures.push({ row, reason: `מספר טלפון לא תקין: "${raw}"` }); continue;
    }
    if (phone && seenPhones.has(phone)) {
      failures.push({ row, reason: `כפול — ${phone} כבר קיים` }); continue;
    }

    const sideNorm = sideRaw.toLowerCase();
    const invite_side = /כלה|bride/.test(sideNorm) ? 'bride' : 'groom';

    successes.push({ name, phone, category: cat || 'ייבוא Excel', invite_side });
    if (phone) seenPhones.add(phone);
  }
  return { successes, failures };
}

// ── Helpers ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

// ── Tests ──────────────────────────────────────────────────────────────────
console.log('\n=== normalizePhone ===');
assert(normalizePhone('0521234567')  === '972521234567', '05… → 972…');
assert(normalizePhone('972521234567') === '972521234567', '972… unchanged');
assert(normalizePhone('+972521234567').replace('+','') === '972521234567' || normalizePhone('+972521234567') !== null, '+ prefix handled');
assert(normalizePhone('521234567')  === '972521234567', '9-digit 5xx → 972…');
assert(normalizePhone('')   === null, 'empty → null');
assert(normalizePhone(null) === null, 'null → null');
assert(normalizePhone('abc')  === null, 'non-numeric → null');

console.log('\n=== isValidIsraelMobile ===');
assert(isValidIsraelMobile('0521234567'),     'local 05… valid');
assert(isValidIsraelMobile('972521234567'),   '972… valid');
assert(!isValidIsraelMobile('0201234567'),    '02… landline invalid');
assert(!isValidIsraelMobile('abc'),           'letters invalid');
assert(!isValidIsraelMobile('052123'),        'too short invalid');
assert(!isValidIsraelMobile(''),              'empty invalid');

console.log('\n=== simulateImport — happy path ===');
{
  const rows = [
    { 'שם': 'יעל כהן', 'טלפון': '0521234567', 'קטגוריה': 'חברים' },
    { 'שם': 'נועם לוי', 'טלפון': '0539876543', 'קטגוריה': 'משפחה' },
  ];
  const { successes, failures } = simulateImport(rows, { name: 'שם', phone: 'טלפון', category: 'קטגוריה' });
  assert(successes.length === 2, '2 valid rows imported');
  assert(failures.length  === 0, 'no failures');
  assert(successes[0].phone === '972521234567', 'phone normalized for first row');
}

console.log('\n=== simulateImport — empty name ===');
{
  const rows = [{ 'שם': '', 'טלפון': '0521234567', 'קטגוריה': '' }];
  const { successes, failures } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(failures.length === 1, 'empty name causes failure');
  assert(failures[0].reason === 'שם ריק', 'correct failure reason for empty name');
}

console.log('\n=== simulateImport — invalid phone ===');
{
  const rows = [{ 'שם': 'דנה', 'טלפון': 'abc123' }];
  const { successes, failures } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(failures.length === 1, 'invalid phone causes failure');
  assert(/לא תקין/.test(failures[0].reason), 'failure reason mentions "לא תקין"');
}

console.log('\n=== simulateImport — duplicate phone (cross-file) ===');
{
  const existing = new Set(['972521234567']);
  const rows = [{ 'שם': 'כפול', 'טלפון': '0521234567' }];
  const { successes, failures } = simulateImport(rows, { name: 'שם', phone: 'טלפון' }, existing);
  assert(failures.length === 1, 'duplicate phone causes failure');
  assert(/כפול/.test(failures[0].reason), 'failure reason mentions "כפול"');
}

console.log('\n=== simulateImport — intra-batch duplicate ===');
{
  const rows = [
    { 'שם': 'ראשון', 'טלפון': '0521234567' },
    { 'שם': 'שני כפול', 'טלפון': '0521234567' },
  ];
  const { successes, failures } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(successes.length === 1, 'first row succeeds');
  assert(failures.length  === 1, 'intra-batch duplicate detected');
}

console.log('\n=== simulateImport — missing phone is allowed ===');
{
  const rows = [{ 'שם': 'שם בלי טלפון', 'טלפון': '' }];
  const { successes, failures } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(successes.length === 1, 'row without phone is accepted');
  assert(successes[0].phone === null, 'phone is null when missing');
}

console.log('\n=== simulateImport — default category assigned ===');
{
  const rows = [{ 'שם': 'ללא קטגוריה', 'טלפון': '0521111111' }];
  const { successes } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(successes[0].category === 'ייבוא Excel', 'default category assigned when empty');
}

console.log('\n=== simulateImport — sanitizeGuestName applied to imported names ===');
{
  const rows = [{ 'שם': '<script>evil</script>', 'טלפון': '0521111111' }];
  const { successes, failures } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(successes.length === 1, 'XSS-like name does not cause a failure (row accepted)');
  assert(!successes[0].name.includes('<'), 'angle brackets stripped from name');
  assert(successes[0].name.includes('evil'), 'text content of name kept');
}
{
  const rows = [{ 'שם': '  יעל כהן  ', 'טלפון': '0521111112' }];
  const { successes } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(successes[0].name === 'יעל כהן', 'surrounding whitespace trimmed by sanitizeGuestName');
}

console.log('\n=== simulateImport — invite_side mapping ===');
{
  const rows = [
    { 'שם': 'חתן', 'טלפון': '0521111113', 'צד': 'groom' },
    { 'שם': 'כלה', 'טלפון': '0521111114', 'צד': 'bride' },
    { 'שם': 'כלהית', 'טלפון': '0521111115', 'צד': 'כלה' },
    { 'שם': 'ברירת מחדל', 'טלפון': '0521111116', 'צד': '' },
  ];
  const colMap = { name: 'שם', phone: 'טלפון', side: 'צד' };
  const { successes } = simulateImport(rows, colMap);
  assert(successes[0].invite_side === 'groom',  'explicit groom → groom');
  assert(successes[1].invite_side === 'bride',  'English bride → bride');
  assert(successes[2].invite_side === 'bride',  'Hebrew כלה → bride');
  assert(successes[3].invite_side === 'groom',  'empty side → groom (default)');
}
{
  // No side column mapped → all default to groom
  const rows = [{ 'שם': 'מישהו', 'טלפון': '0521111117' }];
  const { successes } = simulateImport(rows, { name: 'שם', phone: 'טלפון' });
  assert(successes[0].invite_side === 'groom', 'no side column → defaults to groom');
}

console.log(`\n─────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
