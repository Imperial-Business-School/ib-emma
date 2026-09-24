"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actor";
import { query } from "@/lib/db";

// The app doesn't send: recordEmail() logs with delivery_status 'stub' and
// an admin sends the message from their own mail client. This records that
// they did, so the log doubles as a queue of what is still outstanding.
export async function setEmailSentAction(id: number, sent: boolean) {
  await requireAdmin();
  await query("UPDATE email_log SET delivery_status = $1 WHERE id = $2", [
    sent ? "sent" : "stub",
    id,
  ]);
  revalidatePath("/admin/emails");
}
