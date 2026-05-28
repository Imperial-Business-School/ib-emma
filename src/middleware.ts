import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cidseat_session";

function getSecret(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const secret = getSecret();
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;

  let role: string | null = null;
  if (cookie && secret) {
    try {
      const { payload } = await jwtVerify(cookie, secret);
      role = typeof payload.role === "string" ? payload.role : null;
    } catch {
      // invalid / expired
    }
  }

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=admin_only";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
