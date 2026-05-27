# Anonymous Grading (CID-Seat)

A small web app that replaces the email-spreadsheet workflow used for anonymous
exam marking at university. Students write their **seat number** on their
paper; admins hold the **seat → CID** mapping; markers only see seat numbers
when entering grades.

## How it works

1. **Admin** creates an exam and uploads a two-column CSV of
   `seat_number, cid` pairs (or enters seats manually).
2. **Admin** allocates markers to that exam by email. Each marker is auto-
   emailed a magic-link sign-in.
3. **Markers** click the link, see only the exams they were allocated to,
   and enter grades by seat number. CIDs are never sent to the marker view
   (the marker SQL query never selects the `cid` column).
4. **Admin** downloads a Canvas Gradebook CSV (with CIDs revealed and grades
   filled in) and uploads it straight into Canvas.

## Auth model

- **Magic-link sign-in**: user enters email → we email a single-use,
  30-minute link → click sets a 30-day signed JWT cookie.
- **Roles**: `admin` (sees everything, manages exams and marker allocations)
  and `marker` (sees only allocated exams; CID column is never selected).
- **Admin bootstrap**: any address in the `ADMIN_EMAILS` env var
  (comma-separated) is auto-promoted to admin on first sign-in. Defaults to
  `r.banks@imperial.ac.uk` if the env var is unset.
- **Marker provisioning**: markers are created when an admin allocates them
  to an exam — unknown emails cannot self-sign-in.

## Stack

- Next.js 15 (App Router) + TypeScript
- Postgres via `pg` (any provider — Neon, Supabase, RDS, local)
- Tailwind CSS

## Deploy to Vercel (get a public URL in ~2 minutes)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FrbanksIB%2Fcid-seat&project-name=cid-seat&repository-name=cid-seat&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

When you click the button Vercel will:
1. Authorise the GitHub repo,
2. Prompt you to provision a Postgres database (Neon free tier is fine — it
   automatically sets `POSTGRES_URL` for the app),
3. Build and deploy. The schema is created lazily on first request.

### Required env vars

| Name | Required | Purpose |
| --- | --- | --- |
| `POSTGRES_URL` | yes (auto-set by Vercel/Neon) | Database connection string. |
| `SESSION_SECRET` | yes | ≥32 random chars used to sign session JWTs. `openssl rand -hex 32` works. |
| `ADMIN_EMAILS` | optional | Comma-separated allowlist of admin email addresses. Default: `r.banks@imperial.ac.uk`. |
| `RESEND_API_KEY` | optional | Resend API key for sending magic-link emails. If unset, links are printed to server logs (fine for testing, not for real markers). |
| `MAIL_FROM` | optional | Sender address. Default: `onboarding@resend.dev`. |
| `APP_URL` | optional | Base URL the app is served from (used in magic-link emails). Default: derived from `VERCEL_URL` or `http://localhost:3000`. |

## Running locally

```
npm install
export POSTGRES_URL="postgres://user:pass@localhost:5432/cid_seat"
export SESSION_SECRET="$(openssl rand -hex 32)"
# RESEND_API_KEY is optional in dev — without it, magic-link URLs are
# printed to the server logs.
npm run dev
```

Open <http://localhost:3000> and sign in with `r.banks@imperial.ac.uk` (the
default admin). Copy the magic link from the dev-server logs.

## Canvas Gradebook CSV

The exported file uses Canvas's standard import headers:

```
Student, ID, SIS User ID, SIS Login ID, Section, <Assignment column>
```

Only `SIS User ID` (the CID) and the assignment column are populated; Canvas
matches students by SIS User ID. The assignment column header is the exam's
module code + name, which should match the assignment name in Canvas.
