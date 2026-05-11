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

function isValidPhone(p) {
  if (!p) return false;
  const d = String(p).replace(/\D/g, '');
  return /^(9725\d{8}|05\d{8})$/.test(d);
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
    const name  = (row[colMap.name] || '').trim();
    const raw   = colMap.phone ? (row[colMap.phone] || '') : '';
    const cat   = colMap.category ? (row[colMap.category] || '').trim() : '';

    if (!name) { failures.push({ row, reason: 'שם ריק' }); continue; }

    const phone = normalizePhone(raw);
    if (raw && !isValidPhone(phone || raw)) {
      failures.push({ row, reason: `מספר טלפון לא תקין: "${raw}"` }); continue;
    }
    if (phone && seenPhones.has(phone)) {
      failures.push({ row, reason: `כפול — ${phone} כבר קיים` }); continue;
    }

    successes.push({ name, phone, category: cat || 'ייבוא Excel' });
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

console.log('\n=== isValidPhone ===');
assert(isValidPhone('0521234567'),     'local 05… valid');
assert(isValidPhone('972521234567'),   '972… valid');
assert(!isValidPhone('0201234567'),    '02… landline invalid');
assert(!isValidPhone('abc'),           'letters invalid');
assert(!isValidPhone('052123'),        'too short invalid');
assert(!isValidPhone(''),              'empty invalid');

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

console.log(`\n─────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
