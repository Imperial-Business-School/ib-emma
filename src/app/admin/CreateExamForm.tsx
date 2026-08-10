"use client";

import { useState } from "react";
import type { ProgrammeLevel } from "@/lib/examStatus";
import { createExamAction } from "./actions";

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
  const [error, setError] = useState<string | null>(null);

  const emailsMatch =
    primaryEmail.trim() !== "" &&
    primaryEmail.trim().toLowerCase() === secondaryEmail.trim().toLowerCase();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    setError(null);
    if (emailsMatch) {
      e.preventDefault();
      setError("Primary and secondary markers must be different people.");
      return;
    }
    if (mcqEnabled) {
      const w = mcqWeighting.trim();
      if (!/^\d+(\.\d{1,2})?$/.test(w)) {
        e.preventDefault();
        setError(
          "MCQ weighting must be a number between 0 and 100 with up to 2 decimal places.",
        );
        return;
      }
      const n = Number(w);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        e.preventDefault();
        setError("MCQ weighting must be between 0 and 100.");
        return;
      }
    }
    // otherwise let the server action run
  }

  return (
    <form
      action={createExamAction}
      onSubmit={onSubmit}
      className="mt-4 grid gap-3 md:grid-cols-2"
    >
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800 md:col-span-2">
          {error}
        </div>
      )}
      <input
        name="name"
        required
        placeholder="Exam name (e.g. Mid-term 2025)"
        className="rounded border px-3 py-2 md:col-span-2"
      />
      <input
        name="module_name"
        placeholder="Module name (e.g. Analysis I)"
        className="rounded border px-3 py-2"
      />
      <input
        name="code"
        placeholder="Module code (optional, e.g. MATH40001)"
        className="rounded border px-3 py-2"
      />
      <label className="text-sm md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">
          Programme (optional)
        </span>
        <select
          name="programme_id"
          defaultValue=""
          className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
        >
          <option value="">— No programme —</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.programme_id}, {p.level})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-xs font-medium text-slate-600">
          Academic year
        </span>
        <select
          name="academic_year"
          defaultValue={defaultAcademicYear}
          className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
        >
          {academicYears.map((y) => (
            <option key={y} value={y}>
              20{y.split("/")[0]}/20{y.split("/")[1]} ({y})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-xs font-medium text-slate-600">
          Primary marker deadline
        </span>
        <input
          type="date"
          name="primary_deadline"
          required
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Set to 23:00 UTC on this date.
        </span>
      </label>
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
            <strong>Standard sampling</strong> — bracket-aware sample plus all
            failed students (see docs for full rules).
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
            <strong>Full second marking</strong> — every paper is marked by the
            second marker.
          </span>
        </label>
      </fieldset>
      <div className="rounded border bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">
          Primary marker
        </p>
        <input
          type="email"
          name="primary_email"
          required
          value={primaryEmail}
          onChange={(e) => setPrimaryEmail(e.target.value)}
          placeholder="primary@imperial.ac.uk"
          className="mt-2 w-full rounded border px-3 py-2 text-sm"
        />
        <input
          name="primary_name"
          placeholder="Name (optional)"
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
          placeholder="Name (optional)"
          className="mt-2 w-full rounded border px-3 py-2 text-sm"
        />
        {emailsMatch && (
          <p className="mt-1 text-xs text-red-700">
            Second marker email cannot match primary marker email.
          </p>
        )}
      </div>
      <label className="text-sm md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">
          Second marker deadline (optional; can be set at 'Start second marking' instead)
        </span>
        <input
          type="date"
          name="secondary_deadline"
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={emailsMatch}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
      >
        Create exam
      </button>
    </form>
  );
}
