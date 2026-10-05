# AGENTS.md — Student Task & Exam Manager

Project-wide implementation rules for agents working in this repository.

This app tracks coursework **and** exams for a student: assignments due, exams scheduled,
and a study checklist per exam. It always surfaces what is due soonest.

**This repository contains working application code.** Read it before writing anything.
The stack is already decided and enforced in `package.json` — see `ARCHITECTURE.md` §1.

---

## 1. Inspect Before You Code

- Read the files you are about to change, plus their neighbours. Never guess a file path,
  an export name, or a prop name.
- A prior implementation of the thing you are building almost always exists. Extend it
  instead of adding a parallel version.
- The domain is migrating from `Task` to `Item`. Before introducing a new type, check
  whether `Item` already covers the case. One entity, not two.
- If a requirement is ambiguous, pick the reading that needs the least new code, write the
  decision into `ARCHITECTURE.md`, and say so. Do not silently invent a second mechanism.

## 2. Domain Model

The single entity is `Item`, discriminated by `type: 'assignment' | 'exam'`.

- Both kinds carry `title`, `course`, `description`, `deadline`, `priority`, `status`.
- **One date field, not two.** An assignment has a due date and an exam has a date; both
  are the same kind of value, so both use `deadline`. Do not add `examDate` alongside it —
  that creates a second source of truth for the same fact.
- `subtasks: Subtask[]` is the exam study checklist (`{ id, title, isCompleted }`). It is
  stored on every item for a uniform shape; it is only *rendered* for exams. Do not fork
  the entity into `Assignment` and `Exam` types.
- `id`, `createdAt`, `updatedAt` are system-owned. A form must never be able to set them.

## 3. Dates and Time (WIB)

- **Every** user-facing date and time renders in **WIB (UTC+7)**.
- Format only through `src/utils/date.ts`. Never call `toLocaleString()` /
  `toLocaleDateString()` inline, and never with a hardcoded locale or time zone.
- Stored deadlines are ISO-8601 **with an explicit `+07:00` offset**
  (e.g. `2026-10-05T14:00:00+07:00`). A bare `YYYY-MM-DD` is never stored for a field that
  carries a time — `Date` reads it as UTC and it silently shifts 7 hours.
- `datetime-local` inputs emit `YYYY-MM-DDTHH:mm` with **no** offset. Convert them through
  `inputValueToInstant` / `inputValueToStorageISO`, never with `new Date(raw)`.
- **Sorting compares instants, not strings.** Use the single comparator in `date.ts`
  (`compareByDeadline` / `sortByDeadline`), which compares `Date.getTime()`. ISO strings
  happen to sort lexicographically, but a single legacy or malformed value breaks that
  assumption silently.
- **"Today" is a WIB day, not a UTC day.** Any day-boundary question (the "Due Today"
  dashboard tile) must use a WIB start-of-day / end-of-day range, never `setHours(0,0,0,0)`
  on a `Date`, which uses the machine's zone.
- Display and sort are different concerns: display converts to WIB, sorting compares
  absolute instants. Never sort on a displayed string.

## 4. Validation

- Validate before the service layer, in `src/utils/validation.ts`. No ad-hoc field checks
  inside components.
- `title` is required, trimmed, 1–100 characters.
- `course` is required and trimmed.
- `deadline` is required. **Empty is a hard error** and blocks save.
- A deadline **entirely in the past** is allowed but must raise a **visible warning** before
  saving. It is neither a silent acceptance nor a hard block.
- `priority` and `status` must be members of their exported const arrays. `type` must be
  `'assignment'` or `'exam'`. Reject anything else.
- Subtask titles are required and trimmed. Duplicate subtask titles within one item are
  allowed but must not break rendering — keys are the subtask `id`, never the index.
- `validateItemDraft` returns a discriminated result and **never throws**.

## 5. Quality Checklist — Before Reporting Done

Run through this every time. It is the bar, not a suggestion.

1. **Clean UI.** Does this look like a designed product, or like a default component demo?
   Typography, spacing, and radii must match the existing design system in
   `src/styles/global.css`. No untouched default look.
2. **Lean code.** Did you write the minimum that works? Every new abstraction must survive
   the question "what breaks if I inline this?"
3. **No redundant elements.** Did you reuse `Button`, `Badge`, `Field`, `Modal`, `Toast`,
   `ThemeToggle`, and the icons in `components/ui/icons.tsx`? Did you add a second one?
4. **Every success and every failure raises a Toast.** Silent success and swallowed
   rejections are both bugs.
5. **Loading, empty, error, and success states all exist** wherever data is displayed, and
   the error state has a working retry.
6. **Mobile-first.** Check at 360px width before declaring done. Columns collapse to one;
   nothing overflows or requires horizontal scrolling.
7. **Typecheck, tests, and build pass.** Report the real output — never claim a pass you
   did not observe.

## 6. Realistic Dummy Data

Seed data must look like a real Indonesian student's schedule. Placeholder text is a
tell-tale of unfinished work and makes it impossible to judge the layout honestly.

- Real course names, for example: **Kalkulus Lanjut, Aljabar Linear, Fisika Dasar,
  Pemrograman Berorientasi Objek, Struktur Data, Mikrokebizarro, Basis Data, Teori
  Ekonomi Makro**.
- Real event names, for example: **"Ujian Tengah Semester Kalkulus Lanjut", "UTS Fisika
  Dasar", "Tugas 3 — Matriks dan Determinan", "Praktikum Laboratorium Komputer", "Kuis
  Pemrograman Berorientasi Objek", "Ujian Akhir Semester Struktur Data"**.
- Deadlines spread across overdue, due today, and several weeks out, so every visual tier
  is actually exercised on first load.
- Exams carry a realistic study checklist: **"Bab 1: Limit dan Kontinuitas", "Bab 2: Turunan",
  "Bab 3: Integral", "Latihan soal UTS"**.
- Keep the seed in one file (`src/services/seedData.ts`) so it can be deleted in one step.
  Never scatter seed objects through components.

## 7. Error Handling

- Every service call is wrapped so failures become a typed, displayable error. A raw
  exception or rejected promise must never reach a component.
- Storage failures are expected, not exceptional: `localStorage` unavailable (private
  mode), quota exceeded, malformed JSON. Each becomes a typed `StorageError` and a visible
  error state.
- Render an error state with a retry affordance. Never a blank screen, never a silent
  swallow.
- Never surface a raw stack trace or the internal storage key to the user.

## 8. Keep Changes Focused

- In scope: dashboard, list, kanban, item detail, create, edit, delete, subtasks, filters,
  search, view toggle, deadline indicators, and their states.
- Out of scope: refactoring modules this task did not touch, renaming unrelated files,
  reformatting, dependency bumps, or "tidying" files you did not open.
- One task, one coherent change. If you notice something unrelated, report it — do not fix
  it. Unrelated churn hides the real change and breaks review.

## 9. Definition of Done

- Dashboard shows Due Today, Overdue, and Upcoming Exams, all WIB-correct.
- Create, read, update, delete work for both `assignment` and `exam`.
- Exam subtasks can be added, toggled, and removed, and the progress is persisted.
- List view sorts by nearest deadline; Kanban groups by status.
- Filters by course and item type, plus text search, compose correctly.
- Overdue and urgent indicators render correctly in both light and dark mode.
- Delete asks for confirmation. Every success and failure toasts.
- Responsive down to 360px.
- `npm run typecheck`, `npm test`, and `npm run build` pass.
- No unrelated files were modified.
