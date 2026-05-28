import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requestMagicLinkAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect("/admin");

  if (sp.sent === "1") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-slate-600">
          If <strong>{sp.email}</strong> is registered, we&apos;ve sent a
          sign-in link. The link is valid for 30 minutes.
        </p>
        <p className="text-sm text-slate-500">
          You can close this tab and click the link in the email.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-slate-600">
        Enter your email and we&apos;ll send you a one-time sign-in link.
      </p>
      <form action={requestMagicLinkAction} className="space-y-3">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="you@imperial.ac.uk"
          className="w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Send sign-in link
        </button>
      </form>
    </div>
  );
}
