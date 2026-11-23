// Sends one email. NEVER throws: a mail problem must not undo a decision that was already saved.
// Without RESEND_API_KEY it only logs the message (fine for the demo). Set RESEND_API_KEY and MAIL_FROM to really send.
export async function sendMail({ to, subject, text }, { fetchImpl = fetch } = {}) {
  if (!to) return { sent: false, reason: 'no_recipient' };
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[mail stub] to=%s subject=%s', to, subject);
    return { sent: false, reason: 'stub' };
  }
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'Dokan AI <onboarding@resend.dev>', to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error('mail failed: HTTP ' + res.status); return { sent: false, reason: 'http_' + res.status }; }
    return { sent: true };
  } catch (e) {
    console.error('mail failed:', e?.message ?? e);
    return { sent: false, reason: 'error' };
  }
}
