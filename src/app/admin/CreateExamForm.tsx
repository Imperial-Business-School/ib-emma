"use client";

import { useState, useTransition } from "react";
import type { ProgrammeLevel } from "@/lib/examStatus";
import { todayUkIsoDate } from "@/lib/datetime";
import { SAVE_STATE_INITIAL } from "@/lib/actionState";
import { createExamActionState } from "./actions";

type Prog = {
  id: number;
  name: string;
  programme_id: string;
  level: ProgrammeLevel;
};

export function CreateExamForm({
  programmes,
  academicYears,
  defaultAcademicYear,
}: {
  programmes: Prog[];
  academicYears: string[];
  defaultAcademicYear: string;
}) {
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [mcqEnabled, setMcqEnabled] = useState(false);
  const [mcqWeighting, setMcqWeighting] = useState("");
  const today = todayUkIsoDate();
  // Client- and server-side errors are tracked separately but rendered
  // in the same banner near the deadline fields. The form is submitted
  // manually via startTransition (not via the native form action) so
  // React 19 doesn't reset the uncontrolled inputs after a server-side
  // validation failure — everything the admin typed stays put.
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const displayError = clientError ?? serverError;

  const emailsMatch =
    primaryEmail.trim() !== "" &&
    primaryEmail.trim().toLowerCase() === secondaryEmail.trim().toLowerCase();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    setServerError(null);
    if (emailsMatch) {
      setClientError("First and second markers must be different people.");
      return;
    }
    if (mcqEnabled) {
      const w = mcqWeighting.trim();
      if (!/^\d+(\.\d{1,2})?$/.test(w)) {
        setClientError(
          "MCQ weighting must be a number between 0 and 100 with up to 2 decimal places.",
        );
        return;
      }
      const n = Number(w);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setClientError("MCQ weighting must be between 0 and 100.");
        return;
      }
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createExamActionState(SAVE_STATE_INITIAL, fd);
      // Success redirects via Next.js server-action machinery, so we
      // only reach here on a validation failure.
      if (!result.ok && result.error) setServerError(result.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 grid gap-3 md:grid-cols-2"
    >
      <input
        name="name"
        required
        placeholder="Exam name (e.g. Mid-term 2025)"
        className="rounded border px-3 py-2 md:col-span-2"
      />
      <input
        name="module_name"
        required
        placeholder="Module name (e.g. Analysis I)"
        className="rounded border px-3 py-2"
      />
      <input
        name="code"
        required
        placeholder="Module code (e.g. MATH40001)"
        className="rounded border px-3 py-2"
      />
      <label className="text-sm md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">
          Programme
        </span>
        <select
          name="programme_id"
          defaultValue=""
          required
          className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
        >
          <option value="" disabled>
            — Select a programme —
          </option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.programme_id}, {p.level})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">
          Academic year
        </span>
        <select
          name="academic_year"
          defaultValue=""
          required
          className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
        >
          <option value="" disabled>
            — Select an academic year —
          </option>
          {academicYears.map((y) => (
            <option key={y} value={y}>
              20{y.split("/")[0]}/20{y.split("/")[1]} ({y})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">
          Exam date
        </span>
        <input
          type="date"
          name="exam_date"
          required
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-slate-500">
          The date the exam is (or was) sat.
        </span>
      </label>
      <fieldset className="rounded border bg-slate-50 p-3 md:col-span-2">
        <legend className="px-1 text-xs font-semibold uppercase text-slate-500">
          Exam type
        </legend>
        <label className="mt-1 flex items-start gap-2 text-sm">
          <input type="checkbox" name="is_resit" className="mt-1" />
          <span>
            Resit exam? Tick this box if this exam is a resit sitting.
            Leave unticked for the main sitting.
          </span>
        </label>
      </fieldset>
      <fieldset className="rounded border bg-slate-50 p-3 md:col-span-2">
        <legend className="px-1 text-xs font-semibold uppercase text-slate-500">
          MCQ element
        </legend>
        <label className="mt-1 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="mcq_enabled"
            checked={mcqEnabled}
            onChange={(e) => setMcqEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>MCQ Element? Check this box if the exam features a separate MCQ element.</span>
        </label>
        {mcqEnabled && (
          <label className="mt-2 block text-sm">
            <span className="block text-xs font-medium text-slate-600">
              Weighting (%)
            </span>
            <input
              type="text"
              name="mcq_weighting"
              value={mcqWeighting}
              onChange={(e) => setMcqWeighting(e.target.value)}
              inputMode="decimal"
              pattern="^\d+(\.\d{1,2})?$"
              title="Number between 0 and 100 with up to 2 decimal places"
              placeholder="e.g. 30 or 30.5"
              className="mt-1 w-48 rounded border px-3 py-2 text-sm"
            />
          </label>
        )}
      </fieldset>
      <fieldset className="rounded border bg-slate-50 p-3 md:col-span-2">
        <legend className="px-1 text-xs font-semibold uppercase text-slate-500">
          Second marking
        </legend>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="sampling_mode"
            value="standard"
            defaultChecked
            className="mt-1"
          />
          <span>
            <strong>Standard sampling</strong> — min 10%, threshold grades,
            all fails (see documentation for more info)
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="sampling_mode"
            value="full"
            className="mt-1"
          />
          <span>
            <strong>Full second marking</strong> — second marker grades every
            paper
          </span>
        </label>
      </fieldset>
      <div className="rounded border bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">
          First marker
        </p>
        <input
          type="email"
          name="primary_email"
          required
          value={primaryEmail}
          onChange={(e) => setPrimaryEmail(e.target.value)}
          placeholder="first@imperial.ac.uk"
          className="mt-2 w-full rounded border px-3 py-2 text-sm"
        />
        <input
          name="primary_name"
          required
          placeholder="Full name"
          className="mt-2 w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <div className="rounded border bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">
          Second marker
        </p>
        <input
          type="email"
          name="secondary_email"
          required
          value={secondaryEmail}
          onChange={(e) => setSecondaryEmail(e.target.value)}
          placeholder="second@imperial.ac.uk"
          className={`mt-2 w-full rounded border px-3 py-2 text-sm ${emailsMatch ? "border-red-400" : ""}`}
        />
        <input
          name="secondary_name"
          required
          placeholder="Full name"
          className="mt-2 w-full rounded border px-3 py-2 text-sm"
        />
        {emailsMatch && (
          <p className="mt-1 text-xs text-red-700">
            Second marker email cannot match first marker email.
          </p>
        )}
      </div>
      {displayError && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800 md:col-span-2"
        >
          {displayError}
        </div>
      )}
      <label className="text-sm md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">
          First marker deadline
        </span>
        <input
          type="date"
          name="primary_deadline"
          min={today}
          required
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Set to 10:00 UK time on this date. Must be on or after the exam
          date.
        </span>
      </label>
      <label className="text-sm md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">
          Second marker deadline
        </span>
        <input
          type="date"
          name="secondary_deadline"
          min={today}
          required
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Must be on or after the first marker deadline.
        </span>
      </label>
      <button
        type="submit"
        disabled={emailsMatch || pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
      >
        {pending ? "Submitting…" : "Create exam"}
      </button>
    </form>
  );
}
