import { headers } from "next/headers";

// Origin used to build absolute URLs that live outside the request --
// primarily the marker URLs that go into notification emails, and
// anything else that must survive being read from a different browser
// tab or forwarded to someone else. The rules:
//
//   1. If PUBLIC_APP_ORIGIN is set, use it verbatim (with any trailing
//      slash stripped). Set this to https://ib-marking.imperial.ac.uk
//      in production so emails never point at a Vercel preview URL.
//   2. Otherwise derive the origin from the incoming request headers
//      (x-forwarded-host / host). This is what we do in local dev and
//      on preview deployments.
export async function getRequestOrigin(): Promise<string> {
  const configured = process.env.PUBLIC_APP_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
