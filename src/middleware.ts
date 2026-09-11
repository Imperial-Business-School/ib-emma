import { NextResponse, type NextRequest } from "next/server";
import { basicAuthEnabled, verifyBasicAuth } from "@/lib/basicAuth";
import { PRINCIPAL_HEADER, authEnforced } from "@/lib/easyAuth";

// Marker access is by unguessable token, not by login, so those routes stay
// anonymous.
const ANONYMOUS = [/^\/m\//];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (ANONYMOUS.some((r) => r.test(pathname))) return NextResponse.next();

  if (authEnforced()) {
    if (req.headers.get(PRINCIPAL_HEADER)) return NextResponse.next();

    const login = new URL("/.auth/login/aad", req.url);
    login.searchParams.set("post_login_redirect_uri", pathname + search);
    return NextResponse.redirect(login);
  }

  if (basicAuthEnabled()) {
    if (await verifyBasicAuth(req.headers.get("authorization"))) {
      return NextResponse.next();
    }
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="EMMA"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|\\.auth).*)"],
};
