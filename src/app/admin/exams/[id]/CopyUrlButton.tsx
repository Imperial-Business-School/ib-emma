"use client";

import { useState } from "react";

export function CopyUrlButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      // Older browsers or contexts without the Clipboard API: fall back
      // to a hidden textarea + execCommand. Good enough as a last resort.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setState("copied");
      } catch {
        setState("failed");
      } finally {
        ta.remove();
      }
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded border bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
    >
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Copy failed"
          : "Copy"}
    </button>
  );
}
