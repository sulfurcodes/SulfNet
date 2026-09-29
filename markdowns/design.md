# SulfNet — Design System

Everything needed to rebuild the UI pixel-for-pixel, without needing to see the mockup. If a value isn't listed here, don't guess a new one — extend the existing scale/pattern instead.

---

## 1. Design direction

- Neo-brutalist technical developer tool — reads like a diagnostic instrument, not a marketing site
- Bold, condensed-feeling display type paired with monospace for anything technical
- 2–3px solid black borders on everything (see §3 for exactly which weight goes where)
- Hard offset shadows only — no blur, no spread, ever
- Zero border-radius, with exactly one deliberate exception (status-dot indicators, see §5.6)
- Light/off-white-leaning-to-pure-white base, single ink color for text/borders
- Three accent colors total (Palette C — Alert), each with a fixed semantic job, not used interchangeably
- Monospace for URLs, stage names, status text, latency numbers, timestamps — anything a developer would expect to be "raw data"
- High contrast throughout — no gray-on-gray, no muted body text
- Sparse layout, generous whitespace between blocks — the dot-grid background is what fills empty space, not extra content
- No gradients, no glassmorphism, no soft glows, no icon libraries, no more than the specified badge/chip/pill components (don't invent additional pill-shaped UI just to fill space)
- Motion is functional feedback (press, load, transition), never decorative flourish — no springs, no bounce, no parallax
- Desktop-first for the hackathon demo; responsive enough not to break on a laptop being tilted or a projector at a different resolution, not optimized for phones

---

## 2. Color tokens

### Light mode (default)

| Token | Hex | Role |
|---|---|---|
| `color-bg` | `#FFFFFF` | Page background |
| `color-panel` | `#FFFFFF` | Card/panel fill (same as bg — separation comes from the border+shadow, not a tint) |
| `color-ink` | `#000000` | All text, all borders |
| `color-accent-yellow` | `#FFD400` | Primary actions, decorative accent shape, "ambiguous/caution" verdict fill |
| `color-accent-red` | `#FF3B30` | Alert/fail states, "clear failure" verdict fills |
| `color-accent-teal` | `#00C2A8` | "Ready"/positive states, success verdict fill, the Gemma-explanation tag |

### Dark mode (`prefers-color-scheme: dark`, or explicit `data-theme="dark"`)

| Token | Hex |
|---|---|
| `color-bg` | `#141414` |
| `color-panel` | `#1C1C1C` |
| `color-ink` | `#FFFFFF` |
| accents | unchanged — same three hex values in both modes |

### Derived text-only shades (for legibility on white — do not use the raw accent hex as body text color)

| Token | Hex | Usage |
|---|---|---|
| `color-text-pass` | `#007A6B` (darkened teal) | "Pass" text in the results table |
| `color-text-fail` | `#C62828` (darkened red) | "Fail" text in the results table |
| `color-text-muted` | `color-ink` at 50% opacity | "Skipped / n/a" table cells, footer text |

Rule: **raw accent hex = fills, borders, backgrounds. Darkened variants = text sitting directly on the page/panel background.** Never use a raw accent hex as body text color — it fails contrast and looks washed out next to pure black ink.

---

## 3. Structural rules

- **Border weight hierarchy** (this is what creates visual order without color-coding everything):
  - **3px** — primary structural elements: cards/panels, buttons, text inputs, the verdict badge, the brand/title box
  - **2px** — secondary/inline elements: table cells, status chips, pills, the dashed explanation box
- **Border radius: 0px, everywhere**, with one exception: the small circular dot inside a status chip (an 8px circle with a 1px border) — this reads as an "LED indicator," not decoration, so it's allowed.
- **Shadows** — hard offset, no blur, no spread, color = `color-ink` (or `color-border` in dark mode):
  - Cards/panels/hero: `6px 6px 0 0 <ink>`
  - Buttons: `4px 4px 0 0 <ink>` at rest
  - Button `:active`: shadow collapses to `0 0 0 0` and the button visually translates `(4px, 4px)` — the "pressed into the page" effect. Transition: `transform 0.05s ease` (fast, snappy, no easing curve softness)
  - Nothing else gets a shadow (no shadow on inputs, tables, chips, or pills — reserving shadow for things that are literally "raised" — cards and buttons)
- **Fills are always flat.** No gradients anywhere except the background dot texture (§4), which is a repeating pattern, not a gradient fill on an element.

---

## 4. Background texture

A subtle dot-grid sits behind the whole page (not behind card content — cards are opaque, so the dots only show in the gutters/whitespace):

```css
background-image: radial-gradient(var(--color-ink) 1.4px, transparent 1.4px);
background-size: 22px 22px;
background-position: -8px -8px;
```

The `-8px` offset keeps the grid from lining up exactly with the viewport edge, which reads as more intentional than a perfectly aligned grid.

---

## 5. Typography

Two typefaces only:

| Family | Weights used | Role |
|---|---|---|
| **Space Grotesk** | 500, 700 | Display/headings, body copy, button labels, brand name |
| **JetBrains Mono** | 400, 700 | Anything technical: URL input, table contents, status/loading text, chip/pill labels, footer meta text |

### Type scale

| Style | Font / weight | Size | Letter-spacing | Case |
|---|---|---|---|---|
| Brand/title | Space Grotesk 700 | 22px | -0.5px | Normal |
| Hero heading | Space Grotesk 700 | 19px | normal | Normal |
| Card/section heading | Space Grotesk 700 | 16px | normal | Normal |
| Body/hero subtext | Space Grotesk 500 | 13.5–14px | normal | Normal |
| Button label | Space Grotesk 700 | 15px | 0.5px | UPPERCASE |
| Field label | JetBrains Mono 400 | 12px | 1px | UPPERCASE |
| Input/URL text | JetBrains Mono 400 | 15px | normal | as typed |
| Table content | JetBrains Mono 400/700 | 13px | normal | as data |
| Table header | JetBrains Mono 400 | 11px | 1px | UPPERCASE |
| Chip/pill label | JetBrains Mono 400 | 11px | 0.5px | UPPERCASE |
| Loading/status text | JetBrains Mono 400 | 13px | normal | Sentence case |
| Footer/meta text | JetBrains Mono 400 | 11px | normal | lowercase, 60–70% opacity |

---

## 6. Components

### 6.1 Brand/title box
Own bordered container (not bare text over the dot-grid — loses contrast in dark mode otherwise): `color-panel` fill, 3px border, `4px 4px 0` shadow, padding `12px 16px`, width hugs content. Contains the brand name (left) and a small mono version/status tag (right, in a thin bordered box with `color-accent-yellow` fill).

### 6.2 Hero panel
3px border, `6px 6px 0` shadow, padding `20px 22px`, `color-panel` fill. A decorative corner accent: a `90px × 90px` square in `color-accent-yellow`, 3px border, rotated `20deg`, positioned `top: -30px; right: -30px`, `overflow: hidden` on the parent, sitting behind the text (`z-index: 0` vs. text at `z-index: 1`). Contains a heading, one line of supporting copy, and a row of status chips.

### 6.3 Status chip
2px border, `color-bg` fill, padding `6px 10px`, flex row with `6px` gap, mono uppercase 11px text. Includes an 8px circular dot (1px border) as the "LED": `color-accent-teal` when ready/connected, `color-accent-red` when that service is unreachable (label text also changes, e.g. "Local agent offline").

### 6.4 Pill
2px border, `color-bg` fill, padding `5px 10px`, mono uppercase 11px text, no icon/dot. Used for: the DNS→TCP→TLS→HTTP stage preview on Home, and the pass-count summary ("Local: 1/4 passed") on Diagnosis.

### 6.5 Card/panel
3px border, `6px 6px 0` shadow, `color-panel` fill, padding `24px`. The base container for both screens' main content.

### 6.6 Button
- **Primary** (e.g. "Run Diagnostic"): `color-accent-yellow` fill, `color-ink` text
- **Secondary** (e.g. "Run another check"): `color-panel` fill, `color-ink` text and border (outline style)
- **Progress/forward** (e.g. "View Diagnosis"): `color-accent-teal` fill, `color-ink` text
- All: 3px border, `4px 4px 0` shadow at rest, press behavior per §3, padding `14px 22px`, full-width (`display:block; width:100%`) on both screens since there's no reason for inline-width buttons in a single-column layout
- **Disabled**: 50% opacity, shadow and press behavior removed, cursor default
- **No hover elevation change.** A pointer cursor is the only hover feedback — brutalism doesn't get a soft lift-on-hover; the press-on-click is the only motion feedback a button gets.

### 6.7 Text input
3px border, mono 15px text, padding `14px`, fill = `color-bg` at rest. On focus: fill switches to `color-panel` (a visible but subtle "activated" state) — border color and weight stay exactly the same (no colored focus ring/glow; the fill change is the entire focus indicator, consistent with "no soft glow" from §1).

### 6.8 Results table
2px borders (thinner than the containing card — see §3 hierarchy), header row filled solid `color-ink` with `color-bg` text (inverted), 11px mono uppercase. Body cells: mono 13px, `10px` padding. Pass cells use `color-text-pass`, fail cells `color-text-fail`, skipped cells `color-text-muted` with an em-dash (`—`) rather than blank.

### 6.9 Verdict badge
Full-width bar, 3px border, bold Space Grotesk text, `14px 16px` padding, icon + label. Color and icon depend on the verdict (see the decision table in the MVP spec):

| Verdict | Fill | Icon |
|---|---|---|
| `reachable` | `color-accent-teal` | ✓ |
| `local_interference` | `color-accent-red` | ⚠ |
| `global_issue` | `color-accent-red` | ⚠ |
| `control_side_issue` | `color-accent-yellow` | ⚠ |
| `inconclusive` | `color-panel` (outline only, no fill) | — |

Red = something's actually failing. Yellow = ambiguous/not-your-fault. Teal = all clear. No-fill outline = genuinely inconclusive, deliberately withholding a color verdict.

### 6.10 Gemma explanation box
3px **dashed** border (the one place a non-solid border is used, to visually separate "generated text" from the deterministic UI around it), `color-bg` fill, padding `16px`. A small mono uppercase tag above the text, `color-accent-teal` fill, `1px–6px` padding, reading "Gemma explanation" — this tag color stays teal regardless of verdict color, since it's labeling the *source* of the text, not its severity.

### 6.11 Loading state
14px square CSS spinner: 3px border, `border-top-color: transparent`, `animation: spin 0.7s linear infinite` (linear, not eased — mechanical, not organic). Paired with rotating mono 13px status text (see the MVP spec §7.1 for the message list and 2.5s interval).

---

## 7. Motion

Framer Motion is used for exactly three things — nothing else gets animated:

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Button press | 0.05s | ease | Transform only, matches the shadow-collapse in §3 |
| Loading message swap | ~150–200ms | ease-out fade | Cross-fade between messages, no slide |
| Home → Diagnosis transition | ~250–300ms | ease-out | Simple fade/slide, not a spring |

Explicitly avoid: spring physics, bounce, staggered entrance animations, parallax, hover-triggered motion. If it would feel at home in a generic SaaS onboarding flow, it doesn't belong here.

---

## 8. Layout & responsiveness

- Single column always — no multi-column layout at any width.
- Content container: `max-width: 720px`, centered, page padding `32px 20px 60px` (top/sides/bottom).
- Desktop-first: design and test at a laptop/projector-friendly width first. One breakpoint at `640px` for mobile — below it, reduce card/hero padding from `24px`/`20px` down to `16px`, keep font sizes as-is (don't shrink type on mobile; legibility matters more than fitting more on screen).
- Respect `env(safe-area-inset-*)` on top/bottom of the page for any device with a notch/home-indicator, even though this is a desktop-first demo.

---

## 9. Iconography

No icon library, no SVG icon set. All "icons" are either Unicode symbols already used in the mockup (`✓` pass, `✗` fail, `—` skipped/n/a, `⚠` warning) or CSS shapes (the spinner, the dot indicator, the corner accent square). This keeps the typographic, "raw terminal output" character consistent — an icon library would immediately read as generic-SaaS.

---

## 10. What to avoid (explicit)

```
❌ Gradients on any fill (the dot-grid background is the only allowed repeating pattern)
❌ Glassmorphism / blur / translucency effects
❌ Soft/blurred box-shadows — shadows are always hard-edged offsets
❌ Rounded corners (except the one status-dot exception in §3)
❌ Hover glow, hover lift, or any hover state beyond cursor:pointer
❌ Icon libraries (lucide, feather, heroicons, etc.) — use Unicode/CSS shapes only
❌ More badge/pill/chip variants than the ones specified in §6 — don't invent new pill-shaped UI to fill space
❌ Spring/bounce animation curves
❌ Color-coding via anything other than the three accent tokens — no ad-hoc extra colors
```