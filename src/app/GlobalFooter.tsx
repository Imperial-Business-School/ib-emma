// Thinline footer rendered under every page of the app -- admin,
// marker, and any future public surface. Content is exam-team-provided
// help + support pointers, so it stays in sync with what's shown on
// their Canvas Help & Support page.
export function GlobalFooter() {
  return (
    <footer className="mt-8 min-h-[100px] border-t bg-slate-50 px-6 py-4 text-sm text-slate-700">
      <div className="mx-auto flex h-full max-w-screen-2xl flex-col justify-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Help and Support
        </h2>
        <p>
          <a
            href="https://canvas.imperial.ac.uk/courses/455/pages/exam-marking-and-moderation-system-emms"
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-600 hover:underline"
          >
            User guides
          </a>
        </p>
        <p>
          For support and policy guidance, email{" "}
          <a
            href="mailto:bs-exams-team@imperial.ac.uk"
            className="text-blue-600 hover:underline"
          >
            bs-exams-team@imperial.ac.uk
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
