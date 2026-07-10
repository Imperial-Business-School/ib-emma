# EMMA — Exam Marking & Moderation App

A small web app that replaces the email-spreadsheet workflow used for anonymous
exam marking at university. Students write their **seat number** on their
paper; admins hold the **seat → CID** mapping; markers only see seat numbers
when entering grades.

## How it works

1. **Admin** opens `/admin`, creates an exam (entering primary and secondary
   marker emails up front), uploads a two-column CSV of `seat_number, cid`
   pairs, then clicks **Start primary marking**.
2. The admin exam page displays a **share URL** for each marker
   (`/m/<examId>/<token>`). The admin sends the primary URL to the first
   marker by whatever channel they prefer.
3. The **primary marker** clicks the URL, grades every seat, and clicks
   **Marking is complete**. The server picks a second-marking sample
   (boundary grades plus a random fill to ≥10% or ≥10 papers, whichever is
   larger).
4. The admin sends the secondary URL to the second marker, who only sees
   sampled seats (with the primary's grade visible) and grades each.
5. When the second marker completes, the server computes each seat's
   **Final Grade**: non-sampled seats inherit the primary grade; sampled
   seats within 5 points get the average; anything else (≥6 points apart or
   non-numeric) is flagged for admin resolution.
6. The admin sets final grades for any flagged rows. The status auto-flips
   to **Ready for Canvas upload** once every row has a final grade.
7. The admin downloads a Canvas Gradebook CSV with each student's CID and
   their final grade, ready to import into Canvas.

## Auth

There is no login. Admin pages are open at `/admin`; marker pages are
gated by an unguessable token in the URL. Rely on the obscurity of the
deployment URL for testing. For production use, put the app behind your
SSO of choice (e.g. Imperial federated login) before sharing the admin
URL widely.

## Stack

- Next.js 15 (App Router) + TypeScript
- Postgres via `pg` (any provider — Neon, Supabase, RDS, local)
- Tailwind CSS

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FrbanksIB%2Fcid-seat&project-name=cid-seat&repository-name=cid-seat&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

The only required env var is `POSTGRES_URL` (auto-set when you add a
Postgres integration during the deploy wizard).

## Running locally

```
npm install
export POSTGRES_URL="postgres://user:pass@localhost:5432/cid_seat"
npm run dev
```

Open <http://localhost:3000>.

## Canvas Gradebook CSV

The exported file uses Canvas's standard import headers:

```
Student, ID, SIS User ID, SIS Login ID, Section, <Assignment column>
```

Only `SIS User ID` (the CID) and the assignment column are populated; Canvas
matches students by SIS User ID.
