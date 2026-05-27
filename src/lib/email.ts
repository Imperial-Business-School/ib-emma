type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "onboarding@resend.dev";

  if (!apiKey) {
    // Dev fallback: log so the link is recoverable from server output.
    console.warn(
      `[email] RESEND_API_KEY not set — would send to ${to}\n  subject: ${subject}\n  ${text}`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

export async function sendMagicLinkEmail(
  to: string,
  link: string,
  context?: { examName?: string },
) {
  const intro = context?.examName
    ? `You have been allocated to mark <strong>${escapeHtml(context.examName)}</strong>.`
    : `You requested a sign-in link.`;
  const subject = context?.examName
    ? `Marking invitation: ${context.examName}`
    : "Your sign-in link";

  const html = `
    <p>${intro}</p>
    <p>Click the link below to sign in. It is valid for 30 minutes and can be used once.</p>
    <p><a href="${link}">${link}</a></p>
    <p style="color:#666;font-size:12px">If you didn't expect this email, you can ignore it.</p>
  `;
  const text = `${context?.examName ? `You have been allocated to mark ${context.examName}.\n\n` : ""}Sign in: ${link}\n\nThe link is valid for 30 minutes.`;

  await sendEmail({ to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}
