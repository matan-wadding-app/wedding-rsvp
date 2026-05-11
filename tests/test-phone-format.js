/**
 * Unit tests for phone formatting, side normalization, and column detection.
 * Covers: formatPhoneIntl, formatPhoneLocal, normalizeSide,
 *         guessField (HEADER_GUESSES), columnMapFromHeader.
 * Run with: node tests/test-phone-format.js
 * No external dependencies required.
 */

// ── Stubs (mirror MPadmin.html implementations) ────────────────────────────

function formatPhoneIntl(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}

function formatPhoneLocal(phone) {
  return (phone || '').replace(/\D/g, '');
}

function normalizeSide(cell) {
  const s = String(cell || '').trim().toLowerCase();
  if (!s) return 'groom';
  if (s.includes('כלה') || s === 'bride' || s === 'b' || s === 'kala') return 'bride';
  if (s.includes('חתן') || s === 'groom' || s === 'g' || s === 'hatan') return 'groom';
  return 'groom';
}

const HEADER_GUESSES = {
  name:     /שם|name|full.?name|guest/i,
  phone:    /טלפון|phone|mobile|tel|cell|נייד/i,
  side:     /צד|side|קירבה|חתן|כלה|groom|bride/i,
  category: /קטגוריה|category|סוג|group/i,
  email:    /אימייל|email|mail/i,
};

function guessField(header) {
  for (const [field, rx] of Object.entries(HEADER_GUESSES)) {
    if (rx.test(header)) return field;
  }
  return '';
}

function isValidIsraelMobile(cell) {
  const d = String(cell || '').replace(/\D/g, '');
  return /^05[0-9]{8}$/.test(d) || /^9725[0-9]{8}$/.test(d);
}

function looksLikeIsraeliPhone(cell) {
  return isValidIsraelMobile(cell);
}

function columnMapFromHeader(row) {
  if (!row || !row.length) return null;
  const cells = row.map(c => String(c == null ? '' : c).trim());
  let iName = -1, iSide = -1, iPhone = -1, iCat = -1;
  for (let i = 0; i < cells.length; i++) {
    const L = cells[i].toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^full_name$/i.test(L) || L === 'name' || (L.includes('שם') && (L.includes('מלא') || L === 'שם'))) iName = i;
    else if (L === 'side' || L.includes('קירבה') || L.includes('צד')) iSide = i;
    else if (
      L.includes('phone') || L.includes('טלפון') || L.includes('פלאפון') ||
      L.includes('מספר') || /^mobile$/i.test(L)
    ) iPhone = i;
    else if (L.includes('קטגוריה') || L === 'category') iCat = i;
  }
  if (iName >= 0 && iPhone >= 0) return { iName, iSide, iPhone, iCat };
  return null;
}

// ── Assertion helper ───────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

// ── formatPhoneIntl ────────────────────────────────────────────────────────
console.log('\n=== formatPhoneIntl ===');

assert(formatPhoneIntl('0521234567')    === '972521234567', 'local 05… → 972…');
assert(formatPhoneIntl('972521234567')  === '972521234567', '972… passthrough');
assert(formatPhoneIntl('+972521234567') === '972521234567', '+972 prefix stripped');
assert(formatPhoneIntl('0541234567')    === '972541234567', '054 → 972…');
assert(formatPhoneIntl('521234567')     === '972521234567', 'bare 5x… → 972…');
assert(formatPhoneIntl('')              === null,           'empty → null');
assert(formatPhoneIntl(null)            === null,           'null → null');
assert(formatPhoneIntl('abc')           === null,           'non-digit input → null (no digits to prefix)');

// Verify output is always a valid wa.me phone when input was a valid IL number
{
  const result = formatPhoneIntl('0521234567');
  assert(/^\d+$/.test(result), 'output contains only digits (wa.me safe)');
  assert(result.startsWith('972'), 'output starts with 972 country code');
}

// ── formatPhoneLocal ───────────────────────────────────────────────────────
console.log('\n=== formatPhoneLocal ===');

assert(formatPhoneLocal('0521234567')    === '0521234567', 'local number unchanged');
assert(formatPhoneLocal('972521234567')  === '972521234567', 'intl number: digits only');
assert(formatPhoneLocal('+972-52-123-4567') === '972521234567', 'dashes and + stripped');
assert(formatPhoneLocal('052 123 4567')  === '0521234567', 'spaces stripped');
assert(formatPhoneLocal('')              === '',           'empty → empty string');
assert(formatPhoneLocal(null)            === '',           'null → empty string');
assert(formatPhoneLocal('abc')           === '',           'non-numeric → empty string');

// ── normalizeSide ──────────────────────────────────────────────────────────
console.log('\n=== normalizeSide ===');

// bride keywords
assert(normalizeSide('bride')  === 'bride', 'English "bride" → bride');
assert(normalizeSide('Bride')  === 'bride', 'Case-insensitive "Bride" → bride');
assert(normalizeSide('b')      === 'bride', 'Single "b" → bride');
assert(normalizeSide('kala')   === 'bride', 'Transliteration "kala" → bride');
assert(normalizeSide('כלה')    === 'bride', 'Hebrew "כלה" → bride');
assert(normalizeSide('צד כלה') === 'bride', '"צד כלה" (side of bride) → bride');

// groom keywords
assert(normalizeSide('groom')  === 'groom', 'English "groom" → groom');
assert(normalizeSide('Groom')  === 'groom', 'Case-insensitive "Groom" → groom');
assert(normalizeSide('g')      === 'groom', 'Single "g" → groom');
assert(normalizeSide('hatan')  === 'groom', 'Transliteration "hatan" → groom');
assert(normalizeSide('חתן')    === 'groom', 'Hebrew "חתן" → groom');

// defaults
assert(normalizeSide('')       === 'groom', 'empty string → groom (default)');
assert(normalizeSide(null)     === 'groom', 'null → groom (default)');
assert(normalizeSide('friend') === 'groom', 'unknown value → groom (default)');
assert(normalizeSide('  ')     === 'groom', 'whitespace-only → groom (default)');

// ── guessField (HEADER_GUESSES) ────────────────────────────────────────────
console.log('\n=== guessField ===');

// name variants
assert(guessField('שם')         === 'name', 'Hebrew "שם" → name');
assert(guessField('שם מלא')     === 'name', '"שם מלא" → name');
assert(guessField('Name')       === 'name', 'English "Name" → name');
assert(guessField('full_name')  === 'name', '"full_name" → name');
assert(guessField('full name')  === 'name', '"full name" → name');
assert(guessField('Guest')      === 'name', '"Guest" → name');

// phone variants
assert(guessField('טלפון')      === 'phone', 'Hebrew "טלפון" → phone');
assert(guessField('נייד')       === 'phone', '"נייד" → phone');
assert(guessField('Phone')      === 'phone', 'English "Phone" → phone');
assert(guessField('Mobile')     === 'phone', '"Mobile" → phone');
assert(guessField('Tel')        === 'phone', '"Tel" → phone');
assert(guessField('cell')       === 'phone', '"cell" → phone');

// side variants
assert(guessField('צד')         === 'side', 'Hebrew "צד" → side');
assert(guessField('קירבה')      === 'side', '"קירבה" → side');
assert(guessField('side')       === 'side', 'English "side" → side');
assert(guessField('groom')      === 'side', '"groom" header → side');
assert(guessField('bride')      === 'side', '"bride" header → side');

// category variants
assert(guessField('קטגוריה')    === 'category', 'Hebrew "קטגוריה" → category');
assert(guessField('Category')   === 'category', 'English "Category" → category');
assert(guessField('Group')      === 'category', '"Group" → category');

// email variants
assert(guessField('אימייל')     === 'email', 'Hebrew "אימייל" → email');
assert(guessField('Email')      === 'email', 'English "Email" → email');
assert(guessField('mail')       === 'email', '"mail" → email');

// unknown
assert(guessField('notes')      === '', '"notes" → unrecognized (empty string)');
assert(guessField('')           === '', 'empty header → unrecognized');

// ── columnMapFromHeader ────────────────────────────────────────────────────
console.log('\n=== columnMapFromHeader ===');

// Hebrew template headers (typical export from the system)
{
  const row = ['שם מלא', 'קירבה', 'מספר פלאפון', 'קטגוריה'];
  const m = columnMapFromHeader(row);
  assert(m !== null,     'HE headers: map returned');
  assert(m.iName  === 0, 'HE headers: שם מלא at col 0');
  assert(m.iSide  === 1, 'HE headers: קירבה at col 1');
  assert(m.iPhone === 2, 'HE headers: מספר פלאפון at col 2');
  assert(m.iCat   === 3, 'HE headers: קטגוריה at col 3');
}

// English headers
{
  const row = ['Name', 'Phone', 'Side', 'Category'];
  const m = columnMapFromHeader(row);
  assert(m !== null,     'EN headers: map returned');
  assert(m.iName  === 0, 'EN headers: Name at col 0');
  assert(m.iPhone === 1, 'EN headers: Phone at col 1');
  assert(m.iSide  === 2, 'EN headers: Side at col 2');
  assert(m.iCat   === 3, 'EN headers: Category at col 3');
}

// Minimal (name + phone only) — side and category absent
{
  const row = ['שם', 'טלפון'];
  const m = columnMapFromHeader(row);
  assert(m !== null,      'minimal headers: map returned');
  assert(m.iName  === 0,  'minimal: שם at col 0');
  assert(m.iPhone === 1,  'minimal: טלפון at col 1');
  assert(m.iSide  === -1, 'minimal: no side column → -1');
  assert(m.iCat   === -1, 'minimal: no category column → -1');
}

// Missing name column → null (can't import without name)
{
  const m = columnMapFromHeader(['Phone', 'Category']);
  assert(m === null, 'no name column → null map (import aborted)');
}

// Missing phone column → null (phone required for column-map path)
{
  const m = columnMapFromHeader(['Name', 'Category']);
  assert(m === null, 'no phone column → null map');
}

// Empty row → null
{
  assert(columnMapFromHeader([]) === null,  'empty row → null');
  assert(columnMapFromHeader(null) === null, 'null row → null');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
