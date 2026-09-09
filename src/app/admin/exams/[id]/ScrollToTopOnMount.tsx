"use client";

import { useEffect } from "react";

// Next.js App Router preserves scroll position on same-route server-action
// redirects (e.g. /admin/exams/15 -> /admin/exams/15?started=1). Render
// this component on the render that follows such a redirect to force the
// window back to the top so the flash banner is visible.
export function ScrollToTopOnMount() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);
  return null;
}
