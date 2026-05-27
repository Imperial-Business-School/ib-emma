import { NextResponse } from "next/server";
import { consumeMagicLinkToken, createSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") || "";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", url));
  }

  const user = await consumeMagicLinkToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", url));
  }

  await createSessionCookie(user);

  const dest =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : user.role === "admin"
        ? "/admin"
        : "/marker";
  return NextResponse.redirect(new URL(dest, url));
}
