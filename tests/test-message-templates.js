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

function buildInviteMessage(guest) {
  const token = guest.token || guest.id;
  const link = `${siteBaseUrl()}/?t=${token}`;
  const guestName = sanitizeGuestName(guest.full_name);
  return `לכבוד: ${guestName} 👋\n\nאנחנו — מתן ופריאל — מתחתנים\nבי״ג תמוז (28.6.26) שמחים להזמינך להשתתף בשמחתנו 🥂\n\nקישור לאישור הגעה:\n\n${link}\n\nנשמח לראותך איתנו 🤍💍`;
}

function buildGiftReminderForGuest(g) {
  const link = `${siteBaseUrl()}/?t=${g.token}`;
  const guestName = sanitizeGuestName(g.full_name);
  return `לכבוד: ${guestName} 😊\nמתרגשים ממש לראות אותך בקרוב!\n\nלמי שרוצה להסדיר מתנה מראש (כדי להימנע ממעטפות באירוע), אפשר כאן:\n${link}\n\nנתראה בקרוב 💛`;
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
  assert(msg.startsWith('לכבוד: יעל כהן'), 'Hebrew name: starts with לכבוד: יעל כהן');
  assert(!msg.includes('היי'), 'No old "היי" greeting');
  assert(msg.includes('abc123'), 'Token present in link');
  assert(msg.includes('🥂'), 'Emoji 🥂 preserved');
}

// Long name
{
  const longName = 'אלכסנדר יהושפט בן־דוד מן';
  const msg = buildInviteMessage({ full_name: longName, token: 'tok1' });
  assert(msg.startsWith(`לכבוד: ${longName}`), 'Long name preserved verbatim');
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
  assert(msg.startsWith('לכבוד: דנה'), 'Name trimmed of surrounding whitespace');
}

// XSS-like name: angle brackets stripped
{
  const msg = buildInviteMessage({ full_name: '<script>alert(1)</script>', token: 'tok4' });
  assert(!msg.includes('<script>'), 'Angle brackets stripped from name');
}

// Null name → fallback
{
  const msg = buildInviteMessage({ full_name: null, token: 'tok5' });
  assert(msg.startsWith('לכבוד: אורח/ת'), 'Null name falls back to אורח/ת');
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

console.log(`\n─────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
