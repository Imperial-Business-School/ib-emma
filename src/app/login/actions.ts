"use server";

import { redirect } from "next/navigation";
import {
  createMagicLinkToken,
  findLoginEligibleUser,
  getAppUrl,
} from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export async function requestMagicLinkAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = String(formData.get("next") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=invalid_email");
  }

  // Always show the same "check your email" response, regardless of whether
  // the email is registered. This avoids leaking which addresses are valid.
  const user = await findLoginEligibleUser(email);
  if (user) {
    const token = await createMagicLinkToken(user.id);
    const link = `${getAppUrl()}/api/auth/verify?token=${encodeURIComponent(token)}${
      next ? `&next=${encodeURIComponent(next)}` : ""
    }`;
    try {
      await sendMagicLinkEmail(email, link);
    } catch (err) {
      console.error("Failed to send magic link", err);
    }
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}
