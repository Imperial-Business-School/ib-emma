# Anonymous Grading (CID-Seat)

A small web app that replaces the email-spreadsheet workflow used for anonymous
exam marking at university. Students write their **seat number** on their
paper; admins hold the **seat → CID** mapping; markers only see seat numbers
when entering grades.

## How it works

1. **Admin** creates an exam and uploads a two-column CSV of
   `seat_number, cid` pairs (or enters seats manually).
2. **Markers** open the exam, see only seat numbers, and enter grades — CIDs
   are never sent to the marker view (the marker SQL query never selects the
   `cid` column).
3. **Admin** downloads a Canvas Gradebook CSV (with CIDs revealed and grades
   filled in) and uploads it straight into Canvas.

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
3. Build and deploy. The schema is created lazily on first request, so
   nothing else to wire up.

## Running locally

```
npm install
# point at any Postgres
export POSTGRES_URL="postgres://user:pass@localhost:5432/cid_seat"
npm run dev
```

Open <http://localhost:3000>. There is **no authentication** yet; the
admin/marker split is by URL (`/admin` vs `/marker`).

## Canvas Gradebook CSV

The exported file uses Canvas's standard import headers:

```
Student, ID, SIS User ID, SIS Login ID, Section, <Assignment column>
```

Only `SIS User ID` (the CID) and the assignment column are populated; Canvas
matches students by SIS User ID. The assignment column header is the exam's
module code + name, which should match the assignment name in Canvas.
