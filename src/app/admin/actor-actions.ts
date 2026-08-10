"use server";

import { revalidatePath } from "next/cache";
import { setActingAdminCookie } from "@/lib/actor";

export async function setActingAdminAction(id: number) {
  await setActingAdminCookie(id);
  revalidatePath("/admin");
}
