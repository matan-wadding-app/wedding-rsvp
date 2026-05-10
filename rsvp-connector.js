(function() {
  'use strict';

  const supa = window.supabase.createClient(
    WEDDING_CONFIG.SUPABASE_URL,
    WEDDING_CONFIG.SUPABASE_ANON_KEY
  );

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('t');
  let currentGuest = null;
  const isRpcMissing = (error) => !!(error && error.code === 'PGRST202');

  async function loadGuestByToken() {
    if (!token) return null;
    let { data, error } = await supa
      .rpc('get_guest_by_token', { p_token: token })
      .maybeSingle();
    if (isRpcMissing(error)) {
      ({ data, error } = await supa
        .from('guests')
        .select('*')
        .eq('token', token)
        .maybeSingle());
    }
    if (error) { console.error('Error loading guest:', error); return null; }
    return data;
  }

  function prefillForm(guest) {
    const nameInputs = document.querySelectorAll('input[type="text"], input[name*="name"], input[name*="שם"]');
    const phoneInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[name*="טלפון"]');

    nameInputs.forEach(input => {
      if (input.placeholder.includes('שם') || input.name.includes('name')) {
        input.value = guest.full_name;
      }
    });
    phoneInputs.forEach(input => {
      if (guest.phone) input.value = guest.phone;
    });

    const greeting = document.querySelector('[data-guest-greeting]');
    if (greeting) {
      // Use full name trimmed; basic-escape is handled by textContent (no innerHTML)
      const safeName = String(guest.full_name || '').trim();
      greeting.textContent = `לכבוד: ${safeName}`;
    }
  }

  window.submitRSVP = async function(status, guestsCount, notes) {
    if (!currentGuest) {
      alert('לא זוהה אורח. נא לוודא שפתחת את הקישור האישי שקיבלת');
      return false;
    }
    let { error } = await supa.rpc('submit_rsvp_by_token', {
      p_token: token,
      p_rsvp_status: status,
      p_guests_count: guestsCount || 1,
      p_notes: notes || null
    });
    if (isRpcMissing(error)) {
      ({ error } = await supa
        .from('guests')
        .update({
          rsvp_status: status,
          guests_count: guestsCount || 1,
          notes: notes || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', currentGuest.id));
    }

    if (error) {
      alert('שגיאה בשמירת התשובה: ' + error.message);
      return false;
    }
    return true;
  };

  window.submitQuestion = async function(guestName, questionText) {
    if (!guestName || !questionText) {
      alert('נא למלא שם ושאלה');
      return false;
    }
    let { error } = await supa.rpc('submit_question_public', {
      p_guest_name: guestName,
      p_question_text: questionText
    });
    if (isRpcMissing(error)) {
      ({ error } = await supa.from('questions').insert({
        guest_name: guestName,
        question_text: questionText
      }));
    }
    if (error) {
      alert('שגיאה בשליחה: ' + error.message);
      return false;
    }
    alert('השאלה נשלחה! נחזור אליכם בהקדם');
    return true;
  };

  document.addEventListener('DOMContentLoaded', async () => {
    currentGuest = await loadGuestByToken();
    if (currentGuest) {
      prefillForm(currentGuest);
      console.log('✓ אורח זוהה:', currentGuest.full_name);
    } else if (token) {
      console.warn('⚠ טוקן לא תקין:', token);
    }
  });

  window.getCurrentGuest = () => currentGuest;

})();
