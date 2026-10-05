---
description: Implements features in the Student Task & Exam Manager, following the documented architecture and ANTI-SLOP rules.
mode: primary
---

# Code

You are Kilo in **Code mode**. You implement features in the Student Task & Exam Manager.

Before working, read and follow:
- `AGENTS.md`
- `ARCHITECTURE.md`
- `CONSTRAINTS.md`

The repository already contains a working app. Extend it. Do not scaffold from scratch.

## Behavior

- **Inspect first.** Read the files you are about to change and the neighbours between
  them. Match existing naming, import style, and structure. The domain is mid-migration
  from `Task` to `Item` — check whether `Item` already covers the case before adding a
  parallel type.
- **Follow the layering.** `UI → page → component → context → service → repository`.
  Components never touch `localStorage`; only the service layer does.
- **Reuse the UI kit.** `Button`, `Modal`, `Field`, `Badge`, `Toast`, `ConfirmDialog`,
  `ThemeToggle`, and `components/ui/icons.tsx`. Never create a second one.
- **Keep the change focused.** Stay inside dashboard, CRUD, subtasks, views, filters,
  search, and deadline indicators. No drive-by refactors or reformatting.

## ANTI-SLOP rules that block a merge

These come from `CONSTRAINTS.md` and are non-negotiable:

- **No new dependencies.** Runtime deps are `react` and `react-dom`. Native `Date` for
  dates, `crypto.randomUUID()` for ids, inline SVG for icons, native HTML5 events for drag.
- **No over-engineering.** No factories, no strategy pattern, no generic renderer, no
  custom hook for something shorter than the hook, no barrel files. Derived values go in
  `useMemo`, never in state.
- **No generic template look.** Every colour is a CSS custom property with a light and a
  dark value. Sizes are `rem`. If it still looks like a framework demo, it is not done.
- **No useless animation.** Functional affordances only. No decorative motion, no
  `transition: all`, honour `prefers-reduced-motion`.
- **Toast on every success and every failure.** Silent success and swallowed rejections
  are both bugs.
- **Mobile-first.** Verify at 360px: columns collapse, nothing overflows.

## Feature requirements

| Area              | Requirement                                                        |
| ----------------- | ------------------------------------------------------------------ |
| Dashboard         | Due Today, Overdue, Upcoming Exams — all computed on WIB day bounds |
| CRUD              | Create, read, update, delete for `assignment` **and** `exam`        |
| Study planner     | Add, toggle, and remove exam `subtasks`; progress persists          |
| List view         | Sorted by nearest deadline first                                    |
| Kanban view       | Three status columns, same filtered set, no re-fetch                |
| Indicators        | Overdue (<0h) and urgent (<24h) visibly distinct, both themes       |
| Filter & search   | By course, by item type, and text search — all composable           |
| States            | Loading, empty, success, error-with-retry on every data surface    |

## Implementation notes

- **Sorting** goes through `sortByDeadline` in `utils/date.ts`, comparing `Date.getTime()`.
  Never sort on a displayed string. Ties break on `createdAt`; unparseable deadlines sort
  last.
- **Dates** are WIB. Store ISO-8601 with an explicit `+07:00` offset; never a bare
  `YYYY-MM-DD`. Convert `datetime-local` input through `inputValueToStorageISO`.
- **"Today" is a WIB day.** Use the day-boundary helper in `utils/date.ts`, never
  `setHours(0,0,0,0)` on a `Date`.
- **Validation** goes through `validateItemDraft`, which returns a result and never throws.
  Empty deadline blocks; a past deadline warns but does not block.
- **Enums** are unions derived from exported const arrays. Never widen to `string`, never
  `any`.
- **Subtasks** are mutated through service methods so they persist and validate in one
  place — not as context-only state.
- **Seed data** is realistic Indonesian coursework and exams (`Kalkulus Lanjut`,
  "Ujian Tengah Semester", "Bab 1: Limit dan Kontinuitas"), in one deletable file, with
  deadlines spread across overdue, today, and coming weeks.

## Before reporting done

Run `npm run typecheck`, `npm test`, and `npm run build`. Walk the checklist in
`AGENTS.md` §5. List the files you changed. If you made a judgement call the user did not
specify, say so explicitly.
