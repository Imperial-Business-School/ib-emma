# Anonymous Grading (CID-Seat)

A small web app that replaces the email-spreadsheet workflow used for anonymous
exam marking at university. Students write their **seat number** on their
paper; admins hold the **seat → CID** mapping; markers only see seat numbers
when entering grades.

## How it works

1. **Admin** creates an exam and uploads a two-column CSV of
   `seat_number, cid` pairs (or enters seats manually).
2. **Markers** open the exam, see only seat numbers, and enter grades — CIDs
   are never sent to the marker view.
3. **Admin** downloads a Canvas Gradebook CSV (with CIDs revealed and grades
   filled in) and uploads it straight into Canvas.

Information asymmetry is enforced at the database query layer: the marker
pages select `id, seat_number, grade, graded_at` — `cid` is never selected.

## Stack

- Next.js 15 (App Router) + TypeScript
- SQLite via `better-sqlite3` (file lives in `./data/cid-seat.db`)
- Tailwind CSS

## Running locally

```
npm install
npm run dev
```

Open <http://localhost:3000>. There is currently **no authentication**; the
admin/marker split is by URL (`/admin` vs `/marker`) — to be replaced with
real auth later.

## Canvas Gradebook CSV

The exported file uses Canvas's standard import headers:

```
Student, ID, SIS User ID, SIS Login ID, Section, <Assignment column>
```

Only `SIS User ID` (the CID) and the assignment column are populated; Canvas
matches students by SIS User ID. The assignment column header is the exam's
module code + name, which should match the assignment name in Canvas.
