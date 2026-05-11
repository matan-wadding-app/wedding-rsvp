# Wedding RSVP — מתן & פריאל 💍

A static-HTML + Supabase wedding RSVP and admin system.

## Quick start

```bash
git clone https://github.com/matan-wadding-app/wedding-rsvp.git
cd wedding-rsvp
# Open index.html in a browser, or serve with any static file server:
npx serve .
```

Configure Supabase credentials in `config.js` (never commit secrets):

```js
// config.js  — example shape
const WEDDING_CONFIG = {
  SUPABASE_URL: 'https://<project>.supabase.co',
  SUPABASE_ANON_KEY: '<anon-key>',
};
```

---

## Database setup

Run all SQL files in `supabase/` once in the Supabase SQL Editor, in order:

1. `bootstrap-all.sql` — creates tables, RLS, RPC helpers
2. `migration-add-email-and-import.sql` — adds `email` column for the import flow
3. Other `migration-*.sql` files (any order)

---

## Message template behavior

All outgoing messages (WhatsApp, SMS) use a formal Hebrew greeting:

```
לכבוד: <שם מלא>
```

instead of the old informal `היי`. The guest name is:
- trimmed of leading/trailing whitespace
- stripped of `<` and `>` characters (injection prevention)
- preserved verbatim including diacritics (nikud) and long names

See `MPadmin.html` → `buildInviteMessage()` and `buildGiftReminderForGuest()`.

### Emoji encoding

All WhatsApp (`wa.me`) links and SMS (`sms:`) URIs pass the message body through `encodeURIComponent`. This ensures emojis (😊 🎉 ❤️) and Hebrew text are percent-encoded and render correctly instead of appearing as black squares or question marks.

**SMS gateway note:** If you integrate a bulk SMS gateway (Twilio, CELLACT, 019, etc.) set `unicode=true` or `data_coding=8` in the API call. If the provider does not support Unicode, call `stripEmojis(msg)` before sending — this helper is available in `MPadmin.html`.

---

## Excel / CSV guest import

The admin panel (`MPadmin.html`) includes an **"ייבא מ-Excel / CSV"** button on the guest tab.

### Flow

1. Click **📂 ייבא מ-Excel / CSV**
2. Select a `.xlsx`, `.xls` or `.csv` file
3. A **preview** of the first 10 rows appears with column-mapping dropdowns
4. Map each column to: **שם** (required), **טלפון**, **קטגוריה**, **אימייל**
5. Click **ייבא →** — the panel validates, normalizes, and inserts rows into Supabase
6. An **import report** lists successes and failures

### Validation rules

| Check | Behaviour |
|---|---|
| Empty name | Row skipped → failure |
| Invalid phone | Row skipped → failure (e.g. landline, too short) |
| Duplicate phone (already in DB) | Row skipped → failure |
| Intra-batch duplicate | Second occurrence skipped → failure |
| Missing phone | Accepted — phone stored as `NULL` |
| Missing category | Assigned default `ייבוא Excel` |

Phone numbers are normalized to `972XXXXXXXXX` format (strips non-digits, replaces leading `0` with `972`).

### Sample file

`tests/sample-guests.csv` — demonstrates valid rows, duplicates, invalid phones, and missing fields.

### DB migration required

Run `supabase/migration-add-email-and-import.sql` to add the `email` column before using the import (the existing `category` column already exists).

---

## Running tests

```bash
node tests/test-message-templates.js   # Feature 1: greeting & sanitization
node tests/test-emoji-encoding.js      # Feature 2: emoji URL encoding
node tests/test-import-logic.js        # Feature 3: import validation & phone normalization
```

All test files are zero-dependency and run with plain `node`.

---

## Secrets & environment variables

**Never commit `config.js` with real credentials.** Add the following to GitHub Secrets (Settings → Secrets → Actions) and inject them at deploy time:

| Secret name | Purpose |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key |

If you host on Netlify/Vercel, set the same variables as environment variables and generate `config.js` at build time.

---

## TODO / follow-up improvements

- [ ] Add server-side `POST /api/import-guests` as a Supabase Edge Function for bulk imports > 500 rows (avoids browser memory limits)
- [ ] Drag-and-drop file upload for the import modal
- [ ] Column mapping presets (save/recall mapping configurations)
- [ ] Bulk SMS gateway integration with `unicode=true` support
- [ ] Automated E2E tests with Playwright
