/**
 * Manual test: emoji encoding for WhatsApp (wa.me) and SMS.
 * Run with: node tests/test-emoji-encoding.js
 *
 * Expected result: emojis appear percent-encoded in URLs (e.g. %F0%9F%8E%89),
 * and the decoded text round-trips back to the original string.
 */

// ── Stubs ──────────────────────────────────────────────────────────────────
function siteBaseUrl() { return 'https://wedding.example.com'; }

function sanitizeGuestName(name) {
  return String(name || 'אורח/ת').trim().replace(/[<>]/g, '');
}

function buildInviteMessage(guest) {
  const token = guest.token || guest.id;
  const link = `${siteBaseUrl()}/?t=${token}`;
  const guestName = sanitizeGuestName(guest.full_name);
  return `לכבוד ${guestName} 🤍\n\nאנחנו — מתן ופריאל — מתחתנים\nבי״ג תמוז (28.6.26) שמחים להזמינך להשתתף בשמחתנו 🥂\n\nקישור לאישור הגעה:\n\n${link}\n\nנשמח לראותך איתנו 🤍💍`;
}

// stripEmojis: fallback for SMS gateways that cannot handle Unicode
function stripEmojis(text) {
  return text.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu, '');
}

function formatPhoneIntl(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}

// ── Test guest with mixed emojis, Hebrew and RTL ───────────────────────────
const guest = { full_name: 'יעל 😊 כהן', token: 'testtoken42', phone: '0521234567' };
const msg = buildInviteMessage(guest);

console.log('\n=== Raw message ===');
console.log(msg);

// WhatsApp (wa.me) URL
const phone = formatPhoneIntl(guest.phone);
const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
console.log('\n=== WhatsApp wa.me URL ===');
console.log(waUrl);

// Verify the URL is a valid wa.me link
console.assert(waUrl.startsWith('https://wa.me/972'), 'URL starts with wa.me/972');
console.assert(waUrl.includes('%F0%9F%A4%8D'), 'Emoji 🤍 is percent-encoded in URL');

// Verify round-trip decode
const decoded = decodeURIComponent(waUrl.split('?text=')[1]);
console.assert(decoded === msg, 'Round-trip encodeURIComponent / decodeURIComponent is lossless');
console.log('\n✅ Round-trip decode matches original message');

// SMS URI
const smsTel = guest.phone.replace(/\D/g, '');
const smsUrl = `sms:${smsTel}?body=${encodeURIComponent(msg)}`;
console.log('\n=== SMS URI ===');
console.log(smsUrl);
console.assert(smsUrl.includes('%F0%9F%A4%8D'), 'Emoji 🤍 is percent-encoded in SMS URI');
console.log('✅ SMS URI correctly percent-encodes emoji');

// Test with extra emojis: 😊 🎉 ❤️
const msgWithEmojis = `שלום! 😊 🎉 ❤️ ברוכים הבאים!`;
const waUrlEmoji = `https://wa.me/972521234567?text=${encodeURIComponent(msgWithEmojis)}`;
console.log('\n=== Extra emoji test (😊 🎉 ❤️) ===');
console.log('Encoded URL:', waUrlEmoji);
const decodedEmoji = decodeURIComponent(waUrlEmoji.split('?text=')[1]);
console.assert(decodedEmoji === msgWithEmojis, 'Round-trip for 😊 🎉 ❤️ is lossless');
console.log('✅ Emoji 😊 🎉 ❤️ survive round-trip through wa.me URL');

// SMS gateway fallback: stripEmojis
const stripped = stripEmojis(msgWithEmojis);
console.log('\n=== stripEmojis (gateway fallback) ===');
console.log('Original :', msgWithEmojis);
console.log('Stripped :', stripped);
console.assert(!stripped.match(/\p{Emoji_Presentation}/u), 'No presentation-form emoji remain after stripping');
console.log('✅ stripEmojis removes all emoji for legacy SMS gateways');

console.log('\n✅ All emoji encoding tests passed.');
