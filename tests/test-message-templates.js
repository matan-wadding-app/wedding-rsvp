/**
 * Unit tests for buildInviteMessage / buildGiftReminderForGuest.
 * Run with: node tests/test-message-templates.js
 * No external dependencies required.
 */

// ── Stubs so we can require the logic without a browser ────────────────────
function siteBaseUrl() { return 'https://wedding.example.com'; }

function sanitizeGuestName(name) {
  return String(name || 'אורח/ת').trim().replace(/[<>]/g, '');
}

function isCouple(name) {
  return /\sו\S/.test(name) || name.includes('&');
}

function buildInviteMessage(guest) {
  const token = guest.token || guest.id;
  const link = `${siteBaseUrl()}/?t=${token}`;
  const guestName = sanitizeGuestName(guest.full_name);
  const inviteVerb = isCouple(guestName) ? 'להזמינכם' : 'להזמינך';
  return `לכבוד ${guestName} 🤍\n\nאנחנו — מתן ופריאל — מתחתנים\nבי״ג תמוז (28.6.26) שמחים ${inviteVerb} להשתתף בשמחתנו 🥂\n\nקישור לאישור הגעה:\n\n${link}\n\nנשמח לראותך איתנו 🤍💍`;
}

function buildGiftReminderForGuest(g) {
  const link = `${siteBaseUrl()}/?t=${g.token}`;
  const guestName = sanitizeGuestName(g.full_name);
  return `לכבוד: ${guestName} 😊\nמתרגשים ממש לראות אותך בקרוב!\n\nלמי שרוצה להסדיר מתנה מראש (כדי להימנע ממעטפות באירוע), אפשר כאן:\n${link}\n\nנתראה בקרוב 💛`;
}

function buildRsvpConfirmationMessage(name, status, count, lang) {
  const safeName = String(name || 'אורח/ת').trim().replace(/[<>]/g, '');
  const l = lang || 'he';
  if (status === 'coming') {
    const n = Math.max(1, Math.min(8, Number(count) || 1));
    const guestSuffix = n > 1 ? (l === 'en' ? ` for ${n} guests` : ` עם ${n} אנשים`) : '';
    if (l === 'en') return `RSVP Confirmation — Matan & Priel's Wedding 💍\n28.06.2026\n\n${safeName} confirmed attendance${guestSuffix} 🎉`;
    return `אישור הגעה לחתונת מתן ופריאל 💍\nיג' תמוז | 28.6.2026\n\n${safeName} מגיע/ה${guestSuffix} 🎉`;
  }
  if (l === 'en') return `Matan & Priel's Wedding 💍\n28.06.2026\n\n${safeName} — unfortunately can't make it 💛`;
  return `חתונת מתן ופריאל 💍\nיג' תמוז | 28.6.2026\n\n${safeName} — לצערי לא יוכל/תוכל להגיע 💛`;
}

// ── Tiny assertion helper ──────────────────────────────────────────────────
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

// ── Tests ──────────────────────────────────────────────────────────────────
console.log('\n=== buildInviteMessage ===');

// Hebrew name
{
  const msg = buildInviteMessage({ full_name: 'יעל כהן', token: 'abc123' });
  assert(msg.startsWith('לכבוד יעל כהן'), 'Hebrew name: starts with לכבוד יעל כהן');
  assert(!msg.includes('היי'), 'No old "היי" greeting');
  assert(msg.includes('abc123'), 'Token present in link');
  assert(msg.includes('🥂'), 'Emoji 🥂 preserved');
}

// Long name
{
  const longName = 'אלכסנדר יהושפט בן־דוד מן';
  const msg = buildInviteMessage({ full_name: longName, token: 'tok1' });
  assert(msg.startsWith(`לכבוד ${longName}`), 'Long name preserved verbatim');
}

// Name with diacritics (nikud)
{
  const niqqudName = 'שָׂרָה לֵוִי';
  const msg = buildInviteMessage({ full_name: niqqudName, token: 'tok2' });
  assert(msg.includes(niqqudName), 'Name with diacritics (nikud) preserved');
}

// Name with leading/trailing whitespace → trimmed
{
  const msg = buildInviteMessage({ full_name: '  דנה   ', token: 'tok3' });
  assert(msg.startsWith('לכבוד דנה'), 'Name trimmed of surrounding whitespace');
}

// XSS-like name: angle brackets stripped
{
  const msg = buildInviteMessage({ full_name: '<script>alert(1)</script>', token: 'tok4' });
  assert(!msg.includes('<script>'), 'Angle brackets stripped from name');
}

// Null name → fallback
{
  const msg = buildInviteMessage({ full_name: null, token: 'tok5' });
  assert(msg.startsWith('לכבוד אורח/ת'), 'Null name falls back to אורח/ת');
}

console.log('\n=== isCouple / plural verb ===');

// Single name → singular להזמינך
{
  const msg = buildInviteMessage({ full_name: 'יעל כהן', token: 'sing1' });
  assert(msg.includes('להזמינך'), 'Single name: uses singular להזמינך');
  assert(!msg.includes('להזמינכם'), 'Single name: no plural form');
}

// Couple with Hebrew ו conjunction → plural להזמינכם
{
  const msg = buildInviteMessage({ full_name: 'איתמר ומרים', token: 'cpl1' });
  assert(msg.includes('להזמינכם'), 'Hebrew ו couple: uses plural להזמינכם');
  assert(!msg.includes('להזמינך '), 'Hebrew ו couple: no singular form');
}

// Couple with & → plural להזמינכם
{
  const msg = buildInviteMessage({ full_name: 'David & Sarah', token: 'cpl2' });
  assert(msg.includes('להזמינכם'), '& couple: uses plural להזמינכם');
}

// Single name starting with ו (e.g. ורד) — NOT a couple
{
  const msg = buildInviteMessage({ full_name: 'ורד כהן', token: 'sing2' });
  assert(msg.includes('להזמינך'), 'Name starting with ו (ורד) stays singular');
  assert(!msg.includes('להזמינכם'), 'Name starting with ו (ורד): no plural');
}

// Three-word couple name
{
  const msg = buildInviteMessage({ full_name: 'משה ורחל לוי', token: 'cpl3' });
  assert(msg.includes('להזמינכם'), 'Three-word couple name: plural');
}

console.log('\n=== buildGiftReminderForGuest ===');

// Hebrew name
{
  const msg = buildGiftReminderForGuest({ full_name: 'נועם פרץ', token: 'gtok1' });
  assert(msg.startsWith('לכבוד: נועם פרץ'), 'Gift reminder starts with לכבוד:');
  assert(!msg.includes('היי'), 'No old "היי" greeting in gift reminder');
  assert(msg.includes('gtok1'), 'Token in gift reminder link');
}

// Name with diacritics
{
  const msg = buildGiftReminderForGuest({ full_name: 'מִרְיָם', token: 'gtok2' });
  assert(msg.includes('מִרְיָם'), 'Diacritics preserved in gift reminder');
}

console.log('\n=== buildRsvpConfirmationMessage ===');

// coming, single guest (Hebrew)
{
  const msg = buildRsvpConfirmationMessage('נועם כהן', 'coming', 1, 'he');
  assert(msg.includes('אישור הגעה לחתונת מתן ופריאל'), 'coming HE: starts with confirmation header');
  assert(msg.includes('28.6.2026'), 'coming HE: date present');
  assert(msg.includes('נועם כהן'), 'coming HE: name present');
  assert(!msg.includes('אנשים'), 'coming HE: no guest count suffix for solo');
  assert(msg.includes('🎉'), 'coming HE: celebration emoji present');
}

// coming, group (Hebrew)
{
  const msg = buildRsvpConfirmationMessage('שרה לוי', 'coming', 4, 'he');
  assert(msg.includes('עם 4 אנשים'), 'coming HE group: guest count included');
  assert(msg.includes('🎉'), 'coming HE group: emoji present');
}

// not_coming (Hebrew)
{
  const msg = buildRsvpConfirmationMessage('יוסי מזרחי', 'not_coming', 0, 'he');
  assert(msg.includes('חתונת מתן ופריאל'), 'not_coming HE: wedding header present');
  assert(msg.includes('לצערי לא יוכל/תוכל להגיע'), 'not_coming HE: decline phrase present');
  assert(msg.includes('💛'), 'not_coming HE: heart emoji present');
  assert(!msg.includes('אישור הגעה'), 'not_coming HE: no confirmation header');
}

// coming, English
{
  const msg = buildRsvpConfirmationMessage('Dana Green', 'coming', 2, 'en');
  assert(msg.includes('RSVP Confirmation'), 'coming EN: English header');
  assert(msg.includes('for 2 guests'), 'coming EN: guest count in English');
  assert(msg.includes('Dana Green'), 'coming EN: name present');
}

// not_coming, English
{
  const msg = buildRsvpConfirmationMessage('Tom Smith', 'not_coming', 0, 'en');
  assert(msg.includes("unfortunately can't make it"), 'not_coming EN: English decline phrase');
  assert(msg.includes('Tom Smith'), 'not_coming EN: name present');
}

// XSS: angle brackets stripped from name
{
  const msg = buildRsvpConfirmationMessage('<b>evil</b>', 'coming', 1, 'he');
  assert(!msg.includes('<b>'), 'confirm: angle brackets stripped from name');
  assert(msg.includes('evil'), 'confirm: text content of name kept');
}

// null name → fallback
{
  const msg = buildRsvpConfirmationMessage(null, 'coming', 1, 'he');
  assert(msg.includes('אורח/ת'), 'confirm: null name falls back to אורח/ת');
}

// count upper clamp: 10 → 8
{
  const msg = buildRsvpConfirmationMessage('רות', 'coming', 10, 'he');
  assert(msg.includes('עם 8 אנשים'), 'confirm: count clamped to MAX 8');
}

// count lower clamp: 0 for coming → 1 (no suffix)
{
  const msg = buildRsvpConfirmationMessage('בן', 'coming', 0, 'he');
  assert(!msg.includes('עם'), 'confirm: count 0 for coming treated as 1 (no suffix)');
  assert(msg.includes('🎉'), 'confirm: emoji still present for clamped count');
}

// default lang: undefined → Hebrew
{
  const msg = buildRsvpConfirmationMessage('אסתר', 'coming', 1);
  assert(msg.includes('אישור הגעה'), 'confirm: default lang is Hebrew');
}

console.log(`\n─────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
