# CONSTRAINTS.md — Hard Rules & Anti-Slop

These are non-negotiable. If a change appears to require breaking one, stop and ask first.
Slipping a rule in silently is worse than not making the change.

---

## 1. The Stack Is Fixed

- Do not change `package.json` — no framework swap, no build tool swap, no TypeScript
  relaxation. `strict: true`, `noUnusedLocals`, `verbatimModuleSyntax` stay.
- Do not migrate CSS Modules to Tailwind or inline styles. Pick up the existing
  `.module.css` pattern.
- Do not add a router, a state library, or a form library. The app is one page with a
  view toggle; that does not need any of them.

## 2. No Bloated Dependencies

- **Runtime dependencies are `react` and `react-dom`. That is the budget.**
- Use native APIs where they exist. Specifically:
  - **Dates: native `Date`.** No `date-fns`, `dayjs`, `luxon`, or `moment`. All WIB logic
    already lives in `src/utils/date.ts`.
  - **Ids: `crypto.randomUUID()`.** No `uuid` package.
  - **Icons: inline SVG** in `components/ui/icons.tsx`. No icon package.
  - **Drag and drop: HTML5 native events** if Kanban dragging is ever requested. No
    `dnd-kit`, no `react-beautiful-dnd`.
- A new dependency needs a written reason explaining why the platform cannot do it. Adding
  one to save twenty lines is not a reason.
- Never run `npm install <pkg>` as a side effect of a code change.

## 3. No Over-Engineering

- **No abstract factories, no strategy pattern, no generic `<T>ItemRenderer>`.** Two views
  and three statuses do not need a plug-in architecture.
- **No custom hook for anything shorter than the hook itself.** A `useToggle` that wraps
  `useState` and one line is waste. If you are writing a hook, it owns a real concern:
  persistence, subscription, or a multi-step operation.
- **No barrel `index.ts` re-exporting everything.** Import the file directly.
- **Do not store derived values in state.** `visibleItems`, `courseOptions`, and
  `stats` are `useMemo` outputs. Storing them is the #1 source of stale UI.
- **No speculative options.** Do not add a `sortDirection` prop, a `variant` union, or a
  config object for a second use case that does not exist yet.
- Prefer a plain `switch`, an early return, or a `??` over a chain of ternaries and
  optional chaining that hides a real null case.
- Every new abstraction must survive: *"what breaks if I inline this?"* If the answer is
  "nothing", inline it.

## 4. No Generic Template Look

- **Do not ship an untouched default UI.** If it still looks like a framework demo
  (default blue buttons, default grey cards, default focus rings, an untouched `<select>`),
  it is not done.
- Typography, spacing, and radii must come from the design system in
  `src/styles/global.css`. Sizes are `rem`, anchored to `html { font-size: 16px }`.
- **Every colour is a custom property with a light value and a dark value.** A hardcoded
  hex in a component is a bug — it will be invisible or garish in one theme.
- Reuse the existing UI kit. Do not add a second `Button`, `Modal`, `Badge`, `Field`,
  `Toast`, `ConfirmDialog`, `ThemeToggle`, or icon set. If one is missing, add it once to
  `components/ui/`.
- Icons come from `components/ui/icons.tsx`. Do not paste inline `<svg>` into a component
  or use emoji as a UI icon.

## 5. No Useless Animations

- The UI stays functional and fast. No entrance animations on every element, no parallax,
  no animated backgrounds, no confetti on save, no particle effects, no infinite decorative
  motion.
- Hover and focus states must be functional affordances — they signal an element is
  interactive. A card that lifts 1px on hover is fine; a card that scales, glows, and
  changes colour is not.
- One transition per property, `0.15s–0.2s`. No `transition: all`.
- Loading states may shimmer once, as they do today. That is a real signal, not decoration.
- Honour `prefers-reduced-motion`. The skeleton already does; anything new must too.

## 6. Layering Is Not Negotiable

- `UI → page → component → context → service → repository`. A new feature goes in the
  correct layer, not the layer that is easiest to reach.
- Components must not call `localStorage`, `JSON.parse`, or the repository. The only
  permitted path is the service layer.
- No `useEffect` + data fetching inside a presentational component. If a component needs
  async data, it gets a real hook in `hooks/` or reads from the context.
- Validation and normalization live in `utils/`. No inline field checks in JSX.
- Dates go through `utils/date.ts`. No inline `toLocaleString()`, no direct `new Date(raw)`
  on a form value.

## 7. Explicit Feedback

- **Every success and every failure raises a Toast.** A silent success is a bug; a
  swallowed rejection is a worse bug.
- Every data surface has all four states: loading, empty, success, error — and the error
  state has a working **Retry**, not just a message.
- "No results" and "no items yet" are different states and must look different. A filter
  that matches nothing is not an empty app.
- Delete is confirmed by a dialog that names the item being deleted.

## 8. Mobile-First & Responsive

- Check at **360px** before declaring done. Columns collapse to one, nothing overflows,
  no horizontal scrolling.
- Kanban is three columns on desktop and a single stacked column on narrow screens — not a
  squeezed three-column grid, and not a horizontal scroll container.
- The form is two-up on desktop, one-up on mobile.
- Touch targets are comfortable; primary actions are not icon-only with no accessible
  label.

## 9. No Unrelated Changes

- No drive-by refactors, renames, reformatting, or dependency bumps. Unrelated churn hides
  the real change and breaks review.
- Do not add features that were not asked for.
- Do not modify `AGENTS.md`, `ARCHITECTURE.md`, `CONSTRAINTS.md`, `kilo.json`, or files
  under `.kilo/` as a side effect of a feature change.

## 10. Don't Ship Broken Work

- `npm run typecheck`, `npm test`, and `npm run build` must pass. Report the real output;
  never claim a pass you did not observe.
- No `console.log`, commented-out code, `any` on an item field, dead code, or a `TODO`
  without an owner.
- Never weaken a test to make it pass. Fix the code, or report that the code is wrong.
