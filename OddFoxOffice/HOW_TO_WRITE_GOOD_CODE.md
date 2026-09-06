# How to Write Good Code — Presentation Framework Guide

This document defines how code is structured, named, styled, and animated in this
presentation app. Follow it when adding slides, components, or framework
extensions. When in doubt: **simpler, flatter, fewer files**.

---

## 1. Project Structure

```
app/
├── src/
│   ├── main.tsx                    ← entry point, mounts <App />
│   ├── App.tsx                     ← renders <SlideDeck slides={slides} />
│   ├── styles/
│   │   └── theme.css               ← design tokens + global resets (ONE source of truth)
│   ├── presentation/               ← reusable framework — slide-agnostic
│   │   ├── types.ts                ← SlideMeta, SlideKind
│   │   ├── SlideDeck.tsx/.css      ← deck shell: routing, chrome, transitions
│   │   ├── Slide.tsx/.css          ← per-slide layout primitive
│   │   ├── SlideText.tsx           ← typography primitives (Title, Eyebrow…)
│   │   ├── slideVariants.ts        ← shared Framer Motion variants
│   │   └── useKeyboardNav.ts       ← keyboard shortcuts hook
│   └── slides/                     ← the actual deck content — numbered
│       ├── 01-Title.tsx
│       ├── 02-Hook.tsx
│       ├── ...
│       └── index.ts                ← registers slides in order
```

**Rules**

- `presentation/` never imports from `slides/`. Framework does not know its content.
- `slides/` only imports from `presentation/` and `styles/theme.css`.
- Numbered filenames (`01-`, `02-`) = visual order in the file tree mirrors deck order.
- Each slide is ONE file. Co-locate its styles inline or via theme tokens — do
  not make per-slide CSS files.

---

## 2. Framework Principles

1. **Content and framework are separate.** A slide is a data+component entry in
   `slides/index.ts`. Adding a slide never requires editing the deck.
2. **Primitives, not pages.** `<Slide>`, `<Title>`, `<Subtitle>`, `<Body>`,
   `<FadeItem>` compose any layout. Don't build bespoke slide chrome per file.
3. **Design tokens over magic values.** Colors, spacing, fonts live in
   `theme.css` as CSS variables. No hex codes or px values scattered in TSX.
4. **Animation is declarative.** Use the shared variants in `slideVariants.ts`
   — `fadeUp`, `staggerContainer`. Don't `useAnimation` unless something truly
   custom is needed.
5. **Keyboard-first navigation.** Arrow keys, space, PageUp/Down, Home. Mouse
   chrome is a backup, not the primary interaction.
6. **One idea per slide** (see `presentation-framework.md`). If you need
   tabs or steps, split into multiple slide entries.

---

## 3. Code Patterns

### Adding a new slide

1. Create `src/slides/NN-Name.tsx` exporting a named component.
2. Use `<Slide>` as the root — choose `align` and `tone` props.
3. Compose with `<Eyebrow>`, `<Title>`, `<Subtitle>`, `<Body>`, `<FadeItem>`.
4. Register it in `src/slides/index.ts` at the correct position.

```tsx
// src/slides/08-Example.tsx
import { Slide } from "../presentation/Slide";
import { Eyebrow, Title, Body } from "../presentation/SlideText";

export function ExampleSlide() {
  return (
    <Slide align="start">
      <Eyebrow>04 — Example</Eyebrow>
      <Title>Six words, max.</Title>
      <Body>One supporting sentence for context.</Body>
    </Slide>
  );
}
```

### Component rules

- Named exports for slides (`export function XxxSlide`). Default exports only at
  route-level (`App.tsx`).
- Props typed with a local `interface`, not inline. Keep prop count small.
- No prop-drilling deeper than one level. Lift to framework or inline.
- Use `ComponentType` for registry slots (see `types.ts`).

### State

- The deck owns navigation state (`index`, `direction`). Slides are stateless.
- If a slide needs local state (e.g. an interactive demo), `useState` inside
  the slide. Never hoist that state to the deck.

### Styling

- Use CSS Modules-style BEM class names: `.slide`, `.slide__title`,
  `.slide--accent` — predictable, grep-friendly.
- Prefer CSS over style props. Inline `style={{ ... }}` only for values that
  are genuinely dynamic (animated by Framer, derived from props).
- `clamp()` for fluid type; rems for spacing. No fixed px in layout.

### Accessibility

- Decorative animations only — never put meaning in motion alone.
- Buttons have `aria-label` when the visible label is an icon.
- Ensure contrast holds on `--color-bg` and `--color-bg-elevated`.

---

## 4. Animation Conventions

**Library:** Framer Motion. No alternatives (GSAP, Anime, etc.) unless a slide
genuinely needs something Framer can't do.

**Shared variants** live in `slideVariants.ts`:

| Variant | Purpose |
| --- | --- |
| `slideVariants` | Horizontal slide-in/out between slides, direction-aware. |
| `slideTransition` | Shared easing + duration — `ease: [0.16, 1, 0.3, 1]`. |
| `staggerContainer` | Parent that cascades children on enter. |
| `fadeUp` | Child that fades up 24px. Used by every text primitive. |

**Rules**

- Enter animations on the deck transition, not on every element.
  `<Slide>` is a `staggerContainer` — children using `fadeUp` cascade for free.
- Durations: 400–600ms for slide transitions, 300–550ms for element reveals.
- Easing: always `[0.16, 1, 0.3, 1]` (ease-out-expo). Consistency matters more
  than variety.
- Never animate `top/left` — use `x/y`. Never animate `width/height` — use
  `scale` or `transform`.
- Respect `prefers-reduced-motion` (TODO if/when we add a11y polish).

---

## 5. Navigation Model

- Forward: `→`, `↓`, `Space`, `PageDown`, next-button click.
- Backward: `←`, `↑`, `PageUp`, prev-button click.
- Jump-to-start: `Home`.
- Hash-based deep-linking (`#slide-03`) is not implemented yet — add it in
  `SlideDeck.tsx` if/when needed, via `useEffect` syncing `index` to
  `location.hash`.

---

## 6. Anti-Patterns (do not do this)

- Writing content directly in `SlideDeck.tsx`. The deck is a shell.
- Adding a new CSS file per slide. Use tokens + inline style for one-offs.
- Importing Framer's `useAnimation` to orchestrate what `variants` already does.
- Hard-coding colors or spacing (`#7c5cff`, `padding: 24px`). Use variables.
- Coupling two slides (shared state, cross-references). Slides are independent.
- Default-exporting slides. Registry imports by name — defaults invite
  misnamed imports.
- Stateful singletons or context providers for navigation. The deck holds state.

---

## 7. Commands

```bash
cd app
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build
npm run lint
```

---

## 8. When Extending the Framework

Ask first: *does this belong in `presentation/` or in a single slide?* If only
one slide will ever use it, keep it local. Promote to the framework only on the
second use — not speculatively.
