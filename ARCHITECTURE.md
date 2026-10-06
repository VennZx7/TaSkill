# ARCHITECTURE.md — Student Task & Exam Manager

## 1. Technology Stack

**Detected from the repository** (`package.json`, `tsconfig.json`, `vite.config.ts`,
`src/`). This is the stack that is installed and working. It is not a proposal — do not
change it.

| Layer      | Choice                 | Why                                                      |
| ---------- | ---------------------- | -------------------------------------------------------- |
| Build      | Vite 5.4               | `vite.config.ts` exists, `@vitejs/plugin-react` wired     |
| UI         | React 18.3 (TSX)       | Function components + `useReducer`; no router installed   |
| Language   | TypeScript 5.6, strict | `tsconfig.json`: `strict`, `noUnusedLocals`, `verbatimModuleSyntax` |
| Styling    | CSS Modules            | Every component has a paired `.module.css`               |
| State      | React Context          | `context/TaskContext.tsx` — no state library installed    |
| Persistence| Browser `localStorage` | `services/localStorage.ts` wraps it in typed errors       |
| Tests      | Vitest + Testing Library | `vite.config.ts` sets `environment: 'jsdom'`           |
| Icons      | Inline SVG             | `components/ui/icons.tsx` — no icon package              |

**Runtime dependencies: `react` and `react-dom`. That is the entire list.** There is no
date library, no UI kit, no state library, no drag-and-drop library, no icon package.
See `CONSTRAINTS.md` §2 before adding a second one.

Verification commands, all of which are wired in `package.json`:

```
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsc --noEmit && vite build
npm run dev         # vite dev server
```

## 2. Layering

```
UI (pages)
  └─> Components (Dashboard, ListView, KanbanView, ItemCard, ItemFormModal, …)
        └─> Context (ItemContext — data, filters, search, view mode, load state)
              └─> Service layer (services/itemService.ts)
                    └─> Repository (services/itemRepository.ts — localStorage)
                          └─> storage driver (services/localStorage.ts)
```

Boundaries that must hold:

- Components never touch `localStorage`, `JSON.parse`, or the repository.
- Only the service layer knows persistence exists, and it is the only place that
  generates ids or stamps `createdAt` / `updatedAt`.
- Only the repository knows the storage key or the on-disk shape.
- Business rules (validation, normalization, enum checks) live in `utils/validation.ts`,
  never inline in a component.
- Rendering components receive data and callbacks as props. No `useEffect` fetching in
  `ItemCard`, `ItemFormModal`, `ListView`, or `KanbanView`.

## 3. Data Model

Single entity, discriminated by `type`. Lives in `src/types/item.ts`.

```ts
export const ITEM_TYPES = ['assignment', 'exam'] as const;
export const TASK_STATUSES = ['To Do', 'In Progress', 'Done'] as const;
export const TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Item {
  id: string;              // crypto.randomUUID(), system-owned
  type: ItemType;          // 'assignment' | 'exam'
  title: string;           // 1–100 chars, trimmed, required
  course: string;          // trimmed, required
  description: string;     // plain text, may be empty
  deadline: string;        // ISO-8601 WITH offset: 2026-10-05T14:00:00+07:00
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: Subtask[];     // study checklist; rendered only when type === 'exam'
  createdAt: string;       // ISO-8601 with offset, system-owned
  updatedAt: string;       // ISO-8601 with offset, system-owned
}

export interface ItemDraft {   // the only fields a form may set
  type: ItemType;
  title: string;
  course: string;
  description: string;
  deadline: string;            // raw datetime-local value, converted on save
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: Subtask[];         // excluded from validation; stripped of stale ids
}
```

`ItemDraft` exists so the form structurally cannot write `id`, `createdAt`, or
`updatedAt`.

### Field decisions

- **One date field: `deadline`.** The brief said "deadline/examDate". An assignment due date
  and an exam date are the same kind of value at the same point in the sort, so they share
  one field. Adding `examDate` would create a second source of truth and force every
  comparison to branch on `type`.
- **`subtasks` lives on every item.** Assignments simply have an empty array. A uniform
  shape means one repository, one validator, one card component — no `AssignmentItem` /
  `ExamItem` split.
- **Enums are const arrays with types derived from them**, so the runtime list and the
  compile-time union cannot drift apart.

## 4. Frontend Structure

Target layout. Files marked *(new)* do not exist yet; the rest already exist and are
renamed or extended in place.

```
src/
  main.tsx
  App.tsx                              mounts ItemProvider > ToastProvider > AppShell
  types/
    item.ts                            *(new, replaces types/task.ts)*
  utils/
    date.ts                            extend: WIB day boundaries, relative labels
    validation.ts                      extend: type + subtask rules
    id.ts
  services/
    localStorage.ts                    unchanged
    itemRepository.ts                  *(renamed from taskRepository.ts)*
    itemService.ts                     *(renamed from taskService.ts)*
    itemService.ts -> CRUD + subtask ops + dashboard stats
    seedData.ts                        *(new — realistic Indonesian dummy data)*
    errors.ts                          unchanged
  context/
    ItemContext.tsx                    *(replaces TaskContext.tsx)* — items, filters,
                                       search, load state, derived stats
  hooks/
    useTheme.ts                        unchanged
    useViewMode.ts                     *(new)* persisted 'list' | 'kanban'
  components/
    ui/                                Button, Modal, Field, Badge, Toast,
                                       ThemeToggle, icons.tsx — reuse, do not fork
    AppShell.tsx                       *(new)* header + layout
    SmartDashboard.tsx                 *(new)* Due Today / Overdue / Upcoming Exams
    CollectionStates.tsx               *(new)* shared loading / error / empty shell
    ViewToggle.tsx                     *(new)* segmented list/kanban switch
    ListView.tsx                       *(replaces TaskList.tsx)* sorted, filtered
    KanbanView.tsx                     *(new)* three status columns
    ItemCard.tsx                       *(renamed from TaskCard.tsx)*
    ItemFormModal.tsx                  *(renamed from TaskFormModal.tsx)*
    ItemDetailModal.tsx                *(renamed from TaskDetailModal.tsx)*
    SubtaskList.tsx                    *(new)* add / toggle / remove study chapters
    FilterBar.tsx                      extend: + type filter + search input
    ConfirmDialog.tsx                  unchanged
    DeadlineBadge.tsx                  unchanged
  pages/
    HomePage.tsx                       *(replaces TaskPage.tsx)* dashboard + views
```

## 5. State Management (view toggle, filters, search)

One provider: `ItemContext`. It holds the data *and* the way the user is looking at it,
because filters and search are one concern and must compose — the Kanban columns show
the same filtered set as the list, not a separate fetch. View mode is the one exception,
because it changes no data.

```ts
type ViewMode = 'list' | 'kanban';

interface State {
  status: 'loading' | 'ready' | 'error';
  items: Item[];
  error: string | null;
  filters: { course: string; type: ItemType | 'all'; status: TaskStatus | 'all' };
  search: string;
}
```

Rules that keep this lean (`CONSTRAINTS.md` §3):

- **No second state library.** `useReducer` already in use, one reducer, one action union.
- **`viewMode` is two string values, not a state machine.** No enum, no strategy pattern.
  `HomePage` reads it to pick `<ListView/>` or `<KanbanView/>`.
- **`viewMode` lives in `useViewMode`, not in the reducer.** It is persisted to
  `localStorage` (`student-tasks:view`) with the same read-with-fallback pattern as
  `useTheme.ts`, read once on mount and written on change. Putting it in the reducer would
  recompute every derived value in the memo on each toggle for no data reason.
- **Derived values are computed in one `useMemo`, not stored in state.** `visibleItems`,
  `courseOptions`, `dashboard`, and `isFiltered` are outputs of the same memo pass. Storing
  a derived value is the single most common source of stale-UI bugs in this shape of app.
- **Writes are optimistic-then-reload.** A successful mutation re-reads through the
  repository and dispatches `items:replace`, so there is exactly one place where the
  canonical list lives and no drift between the card you just saved and the card in view.

## 6. Persistence

`localStorage`, key `student-tasks:v1`, one JSON array of `Item`.

One key per module, each owned by its repository:

| Key                        | Shape             | Repository                |
| -------------------------- | ----------------- | ------------------------- |
| `student-tasks:v1`         | `Item[]`          | `itemRepository.ts`       |
| `student-tasks:vault`      | `VaultItem[]`     | `vaultRepository.ts`      |
| `student-tasks:flashcards` | `FlashcardDeck[]` | `flashcardRepository.ts`  |
| `student-tasks:gemini-key` | plain string      | `geminiService.ts`        |

- `localStorage.ts` exposes `readJson` / `writeJson` and converts every failure into a
  typed `StorageError` (`unavailable` | `quota` | `malformed`). Availability is probed once
  so private-mode browsers degrade to an error state instead of throwing.
- `itemRepository.ts` owns the key, the array shape, and record validation. A non-array or
  unparseable payload becomes a typed error, never a silent reset to an empty list.
- **Migration from the old `Task[]` shape** is required: existing stored records have no
  `type` and no `subtasks`. `itemRepository` normalizes on read — missing `type` defaults
  to `'assignment'`, missing `subtasks` to `[]` — rather than throwing away user data.
  State this in the code, do not add a versioned migration framework for one change.
- `seedData.ts` is loaded only when storage is genuinely empty (first run). It is a plain
  data file with no logic, so it can be deleted in one step.

Service API (the only import the context makes):

```
listItems(): Promise<Item[]>
getItem(id): Promise<Item | null>
createItem(draft): Promise<SaveResult>
updateItem(id, draft): Promise<SaveResult>
setItemStatus(id, status): Promise<Item>
deleteItem(id): Promise<void>
toggleSubtask(itemId, subtaskId): Promise<Item>
addSubtask(itemId, title): Promise<Item>
removeSubtask(itemId, subtaskId): Promise<Item>
```

All `async` so a future HTTP backend changes the implementation, not the callers. Subtask
operations are service methods, not context-only mutations, so they persist and are
validated in one place. `setItemStatus` exists so moving a Kanban card does not have to
rebuild and re-validate a whole `ItemDraft` just to change one field.

## 7. Core Flows

**Create** — form submit → `validateItemDraft` → `createItem` → service trims, converts
the local datetime to ISO +07:00, generates `id`, stamps timestamps, strips system fields
from the draft → repository appends → context reloads → success toast → modal closes.

**Read / load** — `ItemProvider` mount → `listItems()` → `loading` → `ready` or `error`.
Every list, board, and dashboard surface reads the same `status`, so there is one loading
path and one retry affordance.

**Update** — same form, pre-filled via `formatToInputValue`. Same validator. Service
preserves `id` and `createdAt`, refreshes `updatedAt`.

**Delete** — `ConfirmDialog` naming the item → `deleteItem` → context reloads → toast.
Delete of an already-missing id is treated as success so a double click cannot error.

**Sorting** — once, in the context memo, after filtering:
`sortByDeadline` (compares `Date.getTime()`). Ties break on `createdAt` so the order is
stable. Unparseable deadlines sort last and render an explicit "invalid date" badge rather
than throwing. The Kanban view does **not** re-sort; it groups by status and preserves the
same order inside each column.

**Dashboard stats** — one pass over the filtered set, using WIB day boundaries:

| Tile            | Definition                                                             |
| --------------- | ---------------------------------------------------------------------- |
| Due Today       | `deadline` inside today's WIB range, `status !== 'Done'`                |
| Overdue         | `deadline < now`, `status !== 'Done'`                                   |
| Upcoming Exams  | `type === 'exam'`, `deadline >= now`, sorted nearest first, next 3–5      |

"Today" must be a WIB start-of-day/end-of-day range computed in `utils/date.ts` from the
`+07:00` offset — never `setHours(0,0,0,0)` on a `Date`, which uses the machine's zone and
silently shifts the tile by up to 7 hours for users outside WIB.

**Moving a card** — the Kanban column *is* the status, so moving is a status change. Each
card in Kanban view renders a native `<select>` in place of its status badge; picking a
value calls `setStatus` → `setItemStatus` → context reload → toast. No drag-and-drop: it
would need a dependency for a two-field update, and a native select is keyboard- and
screen-reader-operable for free. In list view the badge is kept, because there the status is
information rather than a control.

**Shared states** — `CollectionStates` owns the loading skeleton, the error panel with its
retry, and the empty panel. `ListView` and `KanbanView` each pass only their own loading
skeleton and the ready children, so a fourth view would not have to copy three blocks.

## 8. Validation Flow

`validateItemDraft(draft, now)` returns a discriminated result and never throws:

```ts
type ValidationResult =
  | { ok: true;  value: ItemDraft; warnings: string[] }
  | { ok: false; errors: Record<string, string>; warnings: string[] };
```

Order: `type` → `title` (trim, 1–100) → `course` (trim, required) → `deadline` (required;
empty is a hard error, unparseable is a hard error, entirely in the past is a **warning**
that still saves) → `priority` / `status` (must be members of the const arrays) →
subtasks (titles trimmed, non-empty, duplicates allowed).

The form renders `errors` under the offending field and blocks submit when `ok === false`.
`warnings` render above the submit button and never block.

## 9. Error Handling Flow

- `StorageError` — quota exceeded, `localStorage` unavailable, malformed JSON.
- `NotFoundError` — update/delete/toggle on an id that no longer exists.
- `ValidationError` — defensive; the form should have caught it first.

The service converts any unexpected throw into a typed, user-safe error before it leaves
the module, so components only ever see a `TaskServiceError` with a displayable `message`.
The context holds `status: 'error'` plus the message, and every surface renders an error
panel with a working **Retry**. There is no `try {} catch {}` in a component.

## 10. Visual System

Established in `src/styles/global.css` — extend it, do not invent a second one.

- **Monochrome by design.** Black/white/grey gradients. No blue, no pink. Colour is
  reserved for semantics only: `--danger` (overdue), `--warning` (<24 h), `--success`
  (done).
- **Dual theme.** Every colour is a custom property with a light block and a
  `:root[data-theme='dark']` block. A new colour needs a value in **both**, or it will be
  invisible in one theme.
- **`rem` units throughout**, with `html { font-size: 16px }` as the single scale knob.
- **Status rail**: a 4px gradient bar on the card's left edge, driven by a `--rail`
  custom property so a card variant is a one-line change.
- Urgency tiers come from `getUrgency(deadline, now)` in `utils/date.ts`; the card and the
  badge must not recompute it separately.

## 11. AI Modules (AI Assistant, Flashcards)

Two modules talk to Gemini, and **no dependency was added** for either. `geminiService.ts`
calls the REST endpoint with native `fetch` and holds the only copy of the request shape.

```
callGemini(apiKey, { prompt, maxOutputTokens, responseMimeType? }, signal?)
  ├─ askGemini(...)        → text        (assistant replies, prose)
  └─ generateFlashcards()  → cards       (strict JSON, parsed)
```

Decisions worth keeping:

- **The key lives in the service.** `readGeminiKey()` / `saveGeminiKey()` in
  `geminiService.ts`, not in a hook, because two modules read it. The key travels in the
  `x-goog-api-key` header, never the query string, and an upstream error message is scrubbed
  of `key=…` before it can reach a Toast.
- **Generated data needs an explicit output contract.** `buildFlashcardPrompt` asks for a
  JSON array of `{ question, answer }` and nothing else, and the request sets
  `responseMimeType: 'application/json'`. `parseFlashcardPayload` still strips a stray
  markdown code fence before `JSON.parse`, and drops entries that are not question/answer
  pairs, so a slightly-off reply degrades instead of throwing.
- **Ids are minted on the way in, not by the model.** `generateFlashcards` returns plain
  `{ question, answer }`; `flashcardService.createDeck` assigns `id`, `createdAt`, and
  `lastStudied: null`. A hand-edited or malformed deck is repaired in `flashcardRepository`,
  the same way a vault record is.
- **Optional fields are explicit `null`.** `vaultItemId` and `lastStudied` are `T | null`, not
  optional, so every stored deck has the same shape.

### FlashcardDeck

```ts
interface Flashcard { id: string; question: string; answer: string }

interface FlashcardDeck {
  id: string;
  title: string;              // trimmed, required
  vaultItemId: string | null; // source material, null for a seed deck
  cards: Flashcard[];         // at least one, or the save is rejected
  createdAt: string;
  lastStudied: string | null; // stamped when Study Mode opens
}
```

### Study Mode flip

The card is one `<button>` holding two faces in one grid cell (`grid-area: 1 / 1`), with
`transform-style: preserve-3d`, `backface-visibility: hidden`, and
`transition: transform 0.5s` on the button. Consequences that must not be broken:

- Both faces share a cell, so the card is as tall as the taller side and **does not resize
  while flipping**; `min-height` keeps a one-word question readable.
- The flip is a functional affordance, so it is reduced to an instant swap under
  `prefers-reduced-motion: reduce` — the answer still appears, nothing moves.
- Moving between cards always resets to the question side, so a card is never half answered.
  Arrow keys and Previous/Next are two inputs to the same one-line `goTo`.
- Six nav tabs do not fit in one row at 360px, so `AppShell` switches the tab strip to a
  3-column grid at `40rem` and 2 columns at `26rem` rather than a scrolling row.

### PDF and Office uploads

PDF and Office text extraction is **native, not a library**:
`utils/pdfLoader.ts` scans `stream … endstream` regions,
inflates FlateDecode streams with the browser's
`DecompressionStream`, and reads the `Tj` / `TJ` text
operators (literal and hex strings). `utils/officeLoader.ts`
walks the ZIP central directory of `.docx` / `.xlsx` and
inflates the XML parts the same way. `pdfjs-dist` or an
office library would break the dependency budget in
`CONSTRAINTS.md` §2 for cases the platform already covers.
Both extractors handle the common case and raise user-safe
errors for password-protected, scanned, encrypted, ZIP64,
and legacy-binary (`.doc` / `.xls`) files. The upload cap is
10 MB — real PDFs and Office files run several megabytes.
Extracted text flows through the existing `MAX_CONTEXT_CHARS`
truncation, and the assistant calls `gemini-3.5-flash` with a
tutor `systemInstruction`. The Study Vault stores the
**extracted text** of an uploaded document (never the binary),
so a saved material is usable as study context and flashcard
source; the file name only labels the upload.

