# AGENTS.md

Guide for AI agents (and humans) working in this repo. Read this first, then
dive into the linked docs as needed.

## What this repo is

A React 19 + Vite + TypeScript web app that renders slide decks — a
"PowerPoint in React." The framework is deliberately small and primitive-based;
content lives separately from the framework.

The app supports **multiple presentations** in a single build, selected by URL
hash:

- `/`                → default deck (BluePlan)
- `/#blueplan`       → BluePlan
- `/#deck2`          → Deck 2
- `/notes.html#<id>` → speaker notes window for that deck (stays in sync with
  the main deck via a `BroadcastChannel`)

A query param (`?slide=N`, 1-based) controls the active slide and is kept in
sync with navigation state.

## Repository layout

```
/
├── AGENTS.md                          ← this file
├── presentation-framework.md          ← narrative / visual principles (how to design a great deck)
├── presentation-script.md             ← BluePlan's speaker script (reference content)
└── app/
    ├── HOW_TO_WRITE_GOOD_CODE.md      ← coding conventions for this framework (authoritative)
    ├── README.md                      ← stock Vite template README
    ├── index.html                     ← main deck entry
    ├── notes.html                     ← speaker-notes window entry
    ├── vite.config.ts                 ← multi-entry build (main + notes)
    ├── eslint.config.js
    ├── package.json
    └── src/
        ├── main.tsx                   ← mounts <App/>
        ├── App.tsx                    ← reads hash → <SlideDeck slides={...}/>
        ├── notes-entry.tsx            ← mounts <SpeakerNotes/>
        ├── styles/theme.css           ← design tokens + global resets (ONE source of truth)
        ├── presentation/              ← framework primitives (content-agnostic)
        │   ├── types.ts               ← SlideMeta, SlideKind
        │   ├── SlideDeck.tsx/.css     ← deck shell, routing, chrome, transitions
        │   ├── Slide.tsx/.css         ← per-slide layout primitive
        │   ├── SlideText.tsx          ← Eyebrow / Title / Subtitle / Body / FadeItem
        │   ├── SpeakerNotes.tsx       ← standalone speaker-notes view + BroadcastChannel helpers
        │   ├── slideVariants.ts       ← shared Framer Motion variants
        │   └── useKeyboardNav.ts      ← keyboard shortcuts hook
        └── presentations/             ← the actual deck content
            ├── index.ts               ← registry of decks + hash → deck resolver
            ├── blueplan/
            │   ├── index.ts           ← SlideMeta[] for BluePlan
            │   ├── slide-design-system.ts  ← shared style constants for this deck
            │   └── slides/NN-*.tsx    ← one file per slide
            └── deck2/
                ├── index.ts
                └── slides/NN-*.tsx
```

**Hard rules**

- `presentation/` never imports from `presentations/`. The framework does not
  know its content.
- `presentations/<deck>/` only imports from `presentation/` and
  `styles/theme.css` (or its own local `slide-design-system.ts`).
- Decks don't import each other.
- Numbered slide filenames (`01-`, `02-`) mirror deck order in the file tree.
- **Deck 2 cover title is "Future of Software Engineering"** — NOT "Feature
  of AI Engineering" or "Future of AI Engineering". Do not "correct" either
  word. Spellcheckers and LLMs have changed this repeatedly; there is a
  guarding comment in `01-Framing.tsx` — respect it.

## Commands

All commands run from `app/`:

```bash
cd app
npm install
npm run dev       # http://localhost:5173 — defaults to BluePlan; visit /#deck2 for Deck 2
npm run build     # tsc -b && vite build — must pass before opening a PR
npm run lint      # eslint .
```

There are no tests and no CI configured. `npm run build` is the primary
correctness gate — keep it green.

## How to add a new slide (to an existing deck)

1. Create `app/src/presentations/<deck>/slides/NN-Name.tsx` exporting a
   **named** component — e.g. `export function NameSlide() { ... }`.
2. Use `<Slide>` as the root and compose with `<Eyebrow>`, `<Title>`,
   `<Subtitle>`, `<Body>`, `<FadeItem>` from `presentation/SlideText`.
3. Register it in `app/src/presentations/<deck>/index.ts` at the right
   position, with `id`, `kind`, `title`, `Component`, and `notes`.
4. Use theme tokens (`var(--color-accent)`, `var(--space-3)`, …) — no hex
   codes, no raw pixel values in layout. Reuse the deck's local
   `slide-design-system.ts` helpers (e.g. `cardStyle`, `statNumberStyle`) when
   present.

See `app/HOW_TO_WRITE_GOOD_CODE.md` §3 for the full "adding a slide" recipe
and the "anti-patterns" list.

## How to add a new presentation (a new deck)

1. Create `app/src/presentations/<new-deck>/` with an `index.ts` exporting
   `slides: SlideMeta[]` and a `slides/` folder containing at least an
   `01-Title.tsx`. Use `deck2/` as the minimal template.
2. Register it in `app/src/presentations/index.ts`:
   ```ts
   import { slides as myDeckSlides } from "./my-deck";
   export const presentations: Presentation[] = [
     { id: "blueplan", title: "BluePlan", slides: blueplanSlides },
     { id: "deck2",    title: "Deck 2",   slides: deck2Slides },
     { id: "my-deck",  title: "My Deck",  slides: myDeckSlides },
   ];
   ```
3. (Optional) Add a deck-local `slide-design-system.ts` if this deck needs its
   own accent colors or shared style helpers. Keep global tokens in
   `styles/theme.css`; put deck-specific helpers inside the deck folder.
4. Verify: `npm run build`, then `npm run dev` and open `/#my-deck`.

The default deck is controlled by `defaultPresentationId` in
`presentations/index.ts`.

## Authoritative docs — read these when in doubt

| File | When to read |
| --- | --- |
| `app/HOW_TO_WRITE_GOOD_CODE.md` | Every code change. Framework conventions, animation rules, anti-patterns. |
| `presentation-framework.md`     | Before designing slide content. Narrative arc, visual design, pacing, "so what?" test. |
| `presentation-script.md`        | Reference for how BluePlan's on-screen text maps to speaker narration. |
| `app/src/presentations/blueplan/slide-design-system.ts` | The visual design system (cards, stats, typography, colors) — imitate it when building a new deck unless the new deck has explicit reasons to diverge. |

## House style (quick reminders)

- **One idea per slide.** Max 6 words in a headline.
- **Named exports only** for slides (`export function FooSlide`). Defaults
  invite misnamed imports in the registry.
- **No per-slide CSS files.** Use theme tokens + inline `style={{ ... }}` for
  one-offs. Promote to framework CSS only on the second use.
- **Framer Motion only.** Use the shared `fadeUp` / `staggerContainer` /
  `slideVariants` from `slideVariants.ts`. Don't reach for `useAnimation`.
- **No emojis, no decorative clipart.** Accent color is for emphasis, not
  decoration.
- **Keyboard-first navigation.** `→ ↓ Space PageDown` forward, `← ↑ PageUp`
  back, `Home` to start, `End` from speaker notes.

## Things to be careful about

- **Don't break the framework/content separation.** If you feel the urge to
  import a slide from `presentation/`, that's a signal you're solving the
  problem in the wrong layer.
- **Don't hoist slide-local state to the deck.** The deck owns only `index`
  and `direction`. Interactive demos keep their own `useState` inside the
  slide.
- **Don't hand-edit `package-lock.json`** or `dist/` — use `npm` and let Vite
  regenerate builds.
- **`/notes.html` and `/` share the deck via a `BroadcastChannel`
  (`blueplan-deck-sync`).** If you change the channel name or the
  `{ index } | { navigate }` message shape, update both `SlideDeck.tsx` and
  `SpeakerNotes.tsx` together.

## Pre-commit / CI

There are no pre-commit hooks and no CI workflows in this repo today. Before
opening a PR, run `npm run build` locally in `app/` and make sure it passes.
