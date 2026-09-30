# AGENTS.md — Developer & AI Agent Guidelines for TypeFight.io

## 1. Authoritative Specification

> [!IMPORTANT]
> [docs/spec.md](docs/spec.md) is the **authoritative design document** for this project.
> It is written in Turkish. **It MUST be read at the start of every session.**
>
> All code, identifiers, comments, file names, commit messages, and project documentation that you write **must be in English**.

---

## 2. Technology Stack (FIXED — Do Not Substitute)

The following stack is strictly fixed. Do not replace, upgrade, or add alternative frameworks:

- **Repo layout:** npm-workspaces monorepo (`apps/web`, `apps/api`, `packages/engine`, `packages/texts`).
- **Frontend & Bundler:** Vite + React + TypeScript (strict mode enabled), in `apps/web`.
- **State Management:** Zustand.
- **Styling:** Plain CSS Modules only.
- **Backend:** Cloudflare Worker + Hono in `apps/api`, Cloudflare D1 for storage. Web deploys to Cloudflare Pages.
- **Testing:** Vitest (unit) + Playwright (E2E). Lint/format: ESLint + Prettier.
  - **No Phaser, no 2D/3D game engine libraries.**
  - **No UI component libraries (no MUI, Shadcn, Chakra, etc.), no Tailwind CSS.**
  - **No localStorage/sessionStorage.** Client persistence will use IndexedDB in a later phase.

> Source of truth for scope and stack is the Trello board (Project Lab, `TypeFight` cards). Where `docs/spec.md` disagrees on backend/monorepo, the Trello cards win.

---

## 3. Directory Structure & Boundaries

```
apps/web/src/
  ui/        React components, screens, layout, and CSS modules.
  store/     Zustand stores bridging UI and engine.
apps/api/    Cloudflare Worker + Hono API and D1 migrations.
packages/
  engine/    Pure game logic. MUST NOT import react, react-dom, or touch document/window.
             Plain functions, state reducers/models, and types only.
  texts/     JSON content (word lists, tiers, narrative passages) and their type definitions.
```

### The `engine/` Purity Rule & Why It Exists

**Rule:** Nothing under `packages/engine/` may import `react`, `react-dom`, or reference global browser objects (`window`, `document`, `localStorage`, `sessionStorage`, etc.).
This boundary is enforced at build and lint time via strict ESLint rules (`no-restricted-imports`, `no-restricted-globals`).

**Why this boundary exists:**

1. **Deterministic Simulation & Replays:** The typing rules (blocking input, sequential indices, word drops) must run headlessly and deterministically.
2. **Future Networking:** In future PvP phases (Phase 3), the same core logic models will run client/server headlessly to validate tick streams and inputs without browser overhead.
3. **Decoupled Architecture & Testing:** Game state transitions can be fully unit-tested with fast, zero-DOM runner tests.
4. **Performance:** Prevents React re-render cycles or UI reflows from leaking into high-frequency typing calculations.

---

### Determinism Rule (extension of the purity rule)

`packages/engine/` MUST NOT read the clock or generate randomness itself.

- **FORBIDDEN inside engine/:** `Date.now()`, `new Date()`,
  `performance.now()`, `Math.random()`, and any other ambient source
  of time or entropy.
- **Instead:** timestamps are passed in as parameters. Randomness comes
  from an injected seeded RNG. The caller owns the clock and the seed.

Add `performance` to `no-restricted-globals` and add lint rules banning
`Date.now`, `new Date`, and `Math.random` under `packages/engine/**`.

**Why:** The engine's value is that the same inputs always produce the
same outputs. Deterministic replay tests, difficulty simulation, and
Phase 3 server-side validation all depend on this. A single `Date.now()`
call breaks all three, passes lint, passes tests, and will not be
noticed for months.

## 4. Naming Conventions

- **React Components & Screens:** `PascalCase` (e.g., `MenuScreen.tsx`, `SimulatorScreen.tsx`, `HeaderBar.tsx`).
- **Types & Interfaces:** `PascalCase` (e.g., `Screen`, `AppState`, `TierConfig`).
- **Zustand Hooks & Functions:** `camelCase` starting with `use` for hooks (e.g., `useAppStore.ts`), `camelCase` for actions and utilities.
- **Modules & File Names:** `camelCase` for utility/store files (e.g., `useAppStore.ts`), `PascalCase` for React component files (`MenuScreen.tsx`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_ACTIVE_WORDS`, `DEFAULT_FALL_SPEED`).
- **CSS Modules:** `[ComponentName].module.css`. Class names use `kebab-case` (e.g., `.cyber-button`, `.screen-container`).

---

## 5. Explicit "DO NOT DO" List

- **DO NOT** add another backend framework or database; the backend is Worker + Hono + D1 only.
- **DO NOT** install or use Phaser or any game engine library.
- **DO NOT** use UI libraries (MUI, Radix, Lucide, Tailwind, etc.). Use plain CSS modules.
- **DO NOT** use `localStorage` or `sessionStorage`. Client persistence will be IndexedDB later.
- **DO NOT** use TypeScript `any`. The codebase enforces strict type safety (`strict: true`, `noUncheckedIndexedAccess: true`, `@typescript-eslint/no-explicit-any: "error"`).
- **DO NOT** place game logic, typing engines, or word spawning outside `packages/engine/`.
- **DO NOT** import React or access DOM/browser globals (`window`, `document`) inside `packages/engine/`.

## 6. Testing

- **Vitest.** No DOM environment for engine tests.
- Every pure function in `packages/engine/` ships with unit tests in the
  same task. Untested engine code is not done.
- Tests call engine functions directly. No React Testing Library
  for engine logic.

## 7. Content Is Data

Tier parameters, word pools, enemy definitions, and narrative text live
in `packages/texts/` as JSON with TypeScript types. Adding content must
never require changing code. Do not hardcode tier values, spawn
intervals, fall speeds, or word lists in TypeScript files.

## 8. Character Set (from spec 2.1)

All typed text is lowercase `a-z` and space only. No uppercase, no
punctuation, no digits, no other scripts. This applies to word pools,
boss passages, and every test fixture. Narrative text that is READ but
never TYPED is exempt and uses normal orthography.

### 8.1 Key Repeat Rule

Key repeat events (`event.repeat === true`) are discarded at the input
bridge and never reach the reducer. Rationale: holding a key would
auto-advance repeated letters, would turn one held mistake into many
counted errors, and would inject machine-perfect intervals into the
keystroke timing data used for anti-cheat.

## 9. Dependencies

Do not add any npm package without asking first. State what it does,
why the standard library or existing stack cannot cover it, and its
bundle cost.
