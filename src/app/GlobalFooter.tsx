// Thinline footer rendered under every page of the app -- admin,
// marker, and any future public surface. Content is exam-team-provided
// help + support pointers, so it stays in sync with what's shown on
// their Canvas Help & Support page.
export function GlobalFooter() {
  return (
    <footer className="mt-8 border-t bg-slate-50 px-6 py-4 text-xs text-slate-600">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className="font-semibold text-slate-700">Help and support</span>
        <a
          href="https://canvas.imperial.ac.uk/courses/455/pages/exam-marking-and-moderation-system-emms"
          target="_blank"
          rel="noreferrer noopener"
          className="text-blue-600 hover:underline"
        >
          User guides
        </a>
        <span>
          For support and policy guidance, email{" "}
          <a
            href="mailto:bs-exams-team@imperial.ac.uk"
            className="text-blue-600 hover:underline"
          >
            bs-exams-team@imperial.ac.uk
          </a>
        </span>
      </div>
    </footer>
  );
}
