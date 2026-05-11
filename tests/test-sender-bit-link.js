/**
 * Tests for sender-phone → Bit payment URL selection.
 * Mirrors the logic in MPadmin.html (getAdminBitUrl / senderParam)
 * and index.html (getBitPayMeUrlForGuest with senderPhone).
 * Run with: node tests/test-sender-bit-link.js
 */

// ── Constants (must match MPadmin.html and index.html) ────────────────────────
const PRIEL_ADMIN_PHONES = new Set(['0526353006', '0545691744', '0523604474', '0542572587']);
const DEFAULT_BIT_URL = 'https://www.bitpay.co.il/app/me/CF1DF176-20C9-2FEF-B2BF-3E2C151F2D1D70E3';
const BRIDE_BIT_URL   = 'https://www.bitpay.co.il/app/me/5885C2E6-A8C2-733A-5D37-FF7C13CDC28DDE8D';

// ── Logic stubs (match the real implementations) ──────────────────────────────

// MPadmin.html: getAdminBitUrl(phone)
function getAdminBitUrl(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  const local = d.startsWith('972') ? '0' + d.slice(3) : d;
  return PRIEL_ADMIN_PHONES.has(local) ? BRIDE_BIT_URL : DEFAULT_BIT_URL;
}

// MPadmin.html: senderParam() — produces the ?sender=... query fragment
function senderParam(adminPhone) {
  const d = (adminPhone || '').replace(/\D/g, '');
  return d ? `&sender=${d}` : '';
}

// index.html: getBitPayMeUrlForSender(senderPhone) — simplified (no guest/forcedSide args)
function getBitPayMeUrlForSender(senderPhone) {
  const groom = DEFAULT_BIT_URL;
  const bride = BRIDE_BIT_URL;
  if (senderPhone) {
    const local = senderPhone.startsWith('972') ? '0' + senderPhone.slice(3) : senderPhone;
    if (PRIEL_ADMIN_PHONES.has(local) && bride) return bride;
  }
  return groom;
}

// ── Assertion helper ──────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ── Tests: getAdminBitUrl ─────────────────────────────────────────────────────
console.log('\n=== getAdminBitUrl (MPadmin: which Bit link to show in banner) ===');

for (const phone of ['0526353006', '0545691744', '0523604474', '0542572587']) {
  assert(getAdminBitUrl(phone) === BRIDE_BIT_URL, `Priel phone ${phone} → bride Bit URL`);
}

assert(getAdminBitUrl('972526353006') === BRIDE_BIT_URL, 'Priel intl format 972526353006 → bride URL');
assert(getAdminBitUrl('0503838631')   === DEFAULT_BIT_URL, 'Matan 0503838631 → default URL');
assert(getAdminBitUrl('0501234567')   === DEFAULT_BIT_URL, 'Unknown number → default URL');
assert(getAdminBitUrl('')             === DEFAULT_BIT_URL, 'Empty string → default URL');
assert(getAdminBitUrl(null)           === DEFAULT_BIT_URL, 'null → default URL');

// ── Tests: senderParam ────────────────────────────────────────────────────────
console.log('\n=== senderParam (MPadmin: URL fragment appended to guest link) ===');

assert(senderParam('0526353006') === '&sender=0526353006', 'Priel phone produces &sender=...');
assert(senderParam('0503838631') === '&sender=0503838631', 'Matan phone produces &sender=...');
assert(senderParam('')           === '',                   'Empty phone → no sender param');
assert(senderParam(null)         === '',                   'null phone → no sender param');
assert(senderParam('052-635-3006') === '&sender=0526353006', 'Dashes stripped from sender param');

// ── Tests: getBitPayMeUrlForSender (index.html landing-page logic) ────────────
console.log('\n=== getBitPayMeUrlForSender (index.html: Bit button/banner URL) ===');

for (const phone of ['0526353006', '0545691744', '0523604474', '0542572587']) {
  assert(getBitPayMeUrlForSender(phone) === BRIDE_BIT_URL, `Landing page: Priel ${phone} → bride Bit URL`);
}

assert(getBitPayMeUrlForSender('972526353006') === BRIDE_BIT_URL, 'Landing page: Priel intl → bride URL');
assert(getBitPayMeUrlForSender('0503838631')   === DEFAULT_BIT_URL, 'Landing page: Matan → default URL');
assert(getBitPayMeUrlForSender('')             === DEFAULT_BIT_URL, 'Landing page: no sender → default URL');
assert(getBitPayMeUrlForSender(null)           === DEFAULT_BIT_URL, 'Landing page: null sender → default URL');

// ── Tests: full round-trip (admin sends, guest opens) ─────────────────────────
console.log('\n=== Round-trip: admin sends link → guest opens → correct Bit URL ===');

{
  const prielPhone = '0526353006';
  const param = senderParam(prielPhone);              // &sender=0526353006
  const senderFromUrl = param.replace('&sender=', ''); // simulates URL param extraction
  assert(getBitPayMeUrlForSender(senderFromUrl) === BRIDE_BIT_URL,
    'Priel sends link → guest sees bride Bit URL');
}

{
  const matanPhone = '0503838631';
  const param = senderParam(matanPhone);
  const senderFromUrl = param.replace('&sender=', '');
  assert(getBitPayMeUrlForSender(senderFromUrl) === DEFAULT_BIT_URL,
    'Matan sends link → guest sees default Bit URL');
}

{
  const param = senderParam('');                       // no sender
  assert(param === '', 'No sender param when phone is empty');
  assert(getBitPayMeUrlForSender('') === DEFAULT_BIT_URL, 'No sender → guest sees default Bit URL');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
