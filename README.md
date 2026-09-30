# TypeFight.io ⚔️

TypeFight.io is a competitive, browser-based typing game that treats keyboard input as a weapon and movement mechanism. Designed with a sleek cyberpunk aesthetic, high-contrast typography, and strict competitive integrity.

> **Authoritative Specification:** [docs/spec.md](docs/spec.md) (in Turkish)  
> **Agent & Architecture Guidelines:** [AGENTS.md](AGENTS.md)
> Summary only. `docs/spec.md` is authoritative; if the two disagree,
> the spec wins.

---

## 🎮 Game Modes (MVP Scope)

- **The Simulator (Training Ground):** Endless single-line word stream with blocking input model. Tracks WPM, accuracy, and keystroke latency distribution.
- **The Gauntlet (RPG Campaign):** Wave defense combat against descending words with target-locking mechanics, idle misfire penalties, and boss encounters.

---

## ⚡ Core Typing Mechanics (Spec Section 2)

- **Input Model:** **Blocking**. The cursor only advances when the correct character is pressed.
- **Character Set:** Lowercase `a`–`z` and space (` `) only. Modifiers, numbers, uppercase, and punctuation are ignored as non-events and do not penalize accuracy.
- **Error Handling:** Wrong keys are ignored without advancing the cursor. They count toward `totalKeypresses` and flag the current index as an error.
- **No Backspace:** Because the cursor never moves past an uncorrected error, backspace is disabled and unnecessary.
- **Scoring Formulas:**
  - `WPM = (correct_characters / 5) / (elapsed_time_minutes)`
  - `Accuracy = first_attempt_hits / total_keypresses`
  - `Score = WPM × Accuracy`

---

## 🏗️ Architecture & Boundaries

TypeFight is an npm-workspaces monorepo. Responsibilities are strictly separated:

```
apps/
  web/            React + Vite + TypeScript client (ui/, store/ with Zustand, CSS Modules).
  api/            Cloudflare Worker + Hono API (D1 database). Server-side score validation.
packages/
  engine/         Pure, deterministic game logic. Zero React or DOM dependencies.
                  No window, document, localStorage, performance, or ambient time (Date.now, Math.random).
  texts/          Word pools, tier configs and content types (data only, no logic).
```

### The Engine Purity & Determinism Rule

All logic under `packages/engine/` is completely deterministic:
- Timestamps and entropy must be injected as parameters.
- Build and lint rules (`eslint.config.js`) actively fail if `packages/engine/` imports React packages or references `window`, `document`, `localStorage`, `performance`, `Date.now()`, `new Date()`, or `Math.random()`.
- Ensures zero-DOM headless execution, deterministic replays, and future multiplayer server-side tick validation.

---

## 🛠️ Technology Stack

- **Backend:** [Cloudflare Workers](https://workers.cloudflare.com/) + [Hono](https://hono.dev/) + Cloudflare D1
- **Frontend & Bundler:** [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Styling:** Plain CSS Modules (No Tailwind, no external UI frameworks)
- **Testing:** [Vitest](https://vitest.dev/) (Node environment, zero-DOM for engine tests)
- **Linting & Formatting:** ESLint 9 (Strict typing, `any` banned, engine purity boundaries)
- **Persistence:** D1 (server) and IndexedDB (client, planned)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm (v10+)

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Scripts
| Command | Description |
|---|---|
| `npm run dev` | Starts the web dev server (`apps/web`) |
| `npm run build` | Typechecks and builds production static bundle to `dist/` |
| `npm test` | Runs pure engine unit tests with Vitest |
| `npm run test:watch` | Runs Vitest in watch mode |
| `npm run typecheck` | Validates strict TypeScript compilation (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint with engine boundary & strict rules |

---

## 📜 Development Guidelines

- All written code, identifiers, comments, commit messages, and documentation **must be in English**.
- Always consult [AGENTS.md](AGENTS.md) and [docs/spec.md](docs/spec.md) before implementing features.
