# DataMart Design & Theme Context

Reference for building future products/modules consistent with **DataMart Enterprise Suite**.
Derived from the shipped Login + Home + Module screens. Feed this to any designer, developer,
or AI agent before they touch a new screen.

---

## 1. Core philosophy — "eye comfort first"

1. **No pure white, no pure black.** Backgrounds are warm off-white; text is a soft near-black. This cuts glare during long ERP working sessions.
2. **Calm teal brand + low-saturation pastel module accents.** Color organizes, it never shouts. All accents are muted (~40–60% saturation).
3. **Light & dark parity.** Every token has a light and dark value. First visit respects the OS `prefers-color-scheme`; choice persists in `localStorage` (`dm-theme`).
4. **Gentle depth.** Soft, tinted shadows (not hard grey), generous radii, subtle 1px borders.
5. **Accessible & low-motion.** AA body contrast, visible focus rings, `prefers-reduced-motion` disables animation/transitions.
6. **Token-driven.** Everything is a CSS variable on `[data-theme]`. Never hardcode a hex in a component — add or reuse a token.

---

## 2. Design tokens

### Brand (theme-independent)
```
--brand:        #2f6f6a   /* deep calm teal — the signature */
--brand-strong: #245955
--brand-soft:   #e3efed
```

### Light theme (`[data-theme='light']`)
```
--bg            #eef1ee   warm paper (never #fff)
--bg-grad-1     #eef2f0   --bg-grad-2 #e7eceb   (subtle radial/linear page wash)
--surface       #f8faf9   card surface
--surface-2     #f0f4f3   inset fields / tracks
--surface-hover #eaf0ef
--border        #dde4e2   --border-strong #cbd5d2
--text          #27322f   soft near-black
--text-muted    #5d6b67   --text-faint #8a958f
--primary       #2f6f6a   --primary-hover #265c58
--primary-contrast #f6fbfa  --primary-soft #dcebe9  (focus glow / selection)
```

### Dark theme (`[data-theme='dark']`)
```
--bg            #0f1715   soft slate (never #000)
--bg-grad-1     #121d1b   --bg-grad-2 #0d1413
--surface       #17221f   --surface-2 #1d2a27   --surface-hover #213230
--border        #2a3a36   --border-strong #364a45
--text          #dce5e2   soft off-white (never #fff)
--text-muted    #9aa9a4   --text-faint #6c7c77
--primary       #5cb3aa   --primary-hover #6ec3ba   (lifted for dark contrast)
--primary-contrast #08110f  --primary-soft #1c302d
```

### Shadows (tinted, never neutral grey)
```
light  sm 0 1px 2px rgba(36,56,53,.06)…   md 0 4px 14px …/.08   lg 0 14px 40px …/.12
dark   sm 0 1px 2px rgba(0,0,0,.3)         md 0 6px 18px …/.35   lg 0 18px 48px …/.5
--glass  translucent surface @ .72 alpha + backdrop-blur(10px)   (topbars, overlays)
```

### Typography
```
--font-sans: 'Inter', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif
body line-height 1.5, antialiased, optimizeLegibility
Page title  25px / 700 / -0.4px      Section  17px / 700
Card title  15px / 700               KPI value 23px / 700 / -0.5px
Body 14px    Small 12–13px    Micro/labels 11–12px, muted
Section labels: 11px, 700, uppercase, letter-spacing .06em
```

### Shape & motion
```
--radius 14px   --radius-sm 10px   --radius-lg 22px   (pills use 999px)
--transition 180ms cubic-bezier(.4,0,.2,1)
Icon tiles ~11–16px radius, avatars 50%
Entrance: fade-in 420ms ease (translateY 8px → 0)
```

---

## 3. Module accent system

Twelve modules, each with a soft pastel accent (light + dark + `soft` fill). Accents are used
for: module card icon/hover border, KPI left-border, function-tile icons, status pills. They are
**decorative organizers**, never used for body text or primary actions (those stay teal).

| Module | Light | Dark |
|---|---|---|
| System Administration | `#6b7cce` | `#8a99e6` |
| Common Application | `#4f9d9a` | `#6fc3bf` |
| Accounts | `#3f8fd1` | `#67b0e6` |
| Inventory | `#cf8a3c` | `#e6ab5f` |
| Procurement | `#b574c2` | `#cd93d9` |
| Sales | `#3fae8e` | `#62cba9` |
| Production | `#c9743f` | `#e0945f` |
| Human Resources | `#5ba3c2` | `#7fc1dc` |
| Payroll | `#7d8ad1` | `#9aa6e6` |
| CRM | `#d1738f` | `#e693ac` |
| Fixed Asset Mgmt | `#6aa36a` | `#8cc28c` |
| Fleet Management | `#c28f3f` | `#dbab62` |

Soft fill convention: `rgba(<accent>, 0.14)`, or in-component
`color-mix(in srgb, var(--accent) 14%, transparent)`.

**Status tones** (semantic, module-independent — used on pills, KPI borders, feeds):
`teal #2f8f8a · green #2f8f6b · blue #3f8fd1 · violet #8a6fd0 · amber #c2882f · rose #c66262`.
Applied via `.tone-*` classes that set a `--tc` variable.

---

## 4. Layout shell

### App (authenticated) shell
- **App grid:** `264px` sidebar + fluid content; collapses to `78px` (icon-only) via a hamburger in the topbar. Grid transition animates the collapse.
- **Sidebar:** carries the signature teal gradient (`radial + radial + linear 165deg #2f6f6a→#1d4744`), light text on teal, translucent white hover/active states, `inset 3px` left accent bar on the active item. Brand-toned scrollbar. Header shows the **`DataMartSuite`** wordmark (icon + name, "Suite" bold); a `MODULES` uppercase section label precedes the nav; `Settings` + `Help & Support` pinned to the footer.
- **Topbar:** sticky, `--glass` background + `backdrop-blur`, collapse toggle, search field (max 520px) with `Ctrl K` kbd hint, theme toggle, notification bell with dot, avatar + profile meta (name + company), logout.
- **Content max-width:** `1440px`, centered.
- **Page wash:** radial highlight top-right + diagonal gradient using `--bg-grad-*`.

### Auth (login) shell — split panel
- **Left brand panel:** full teal gradient; wordmark top-left (`DataMart` + bold `Enterprise Suite`), large headline (`One platform. / Every part of your business.`, ~40px/700 on light-on-teal), supporting paragraph, a wrap of **module chips** (icon + label pills), and a footer trust line (`Bank-grade security · Role-based access · Full audit trail`).
- **Right form panel:** on the off-white `--bg`; a centered elevated card (`--surface`, `--shadow-lg`, `--radius-lg`) holding a rounded icon mark, `Welcome back` title + subtitle, the form fields (§5), Remember me + Forgot password row, full-width teal Sign-in button with trailing arrow, a faint hint line, and a copyright footer below the card.
- **Theme toggle** floats top-right of the panel. Collapses to a single stacked column on narrow screens (form panel over/under the brand panel).

---

## 5. Component patterns

**Card / panel** — `--surface` bg, `1px --border`, `--radius`, `--shadow-sm`. Panels have a header row (`panel-head`) with 15px/700 title (icon in `--primary`) and a bottom border.

**KPI card — two variants.**
- *Dashboard variant* (Home): clean surface card, no left border. Label 12–13px muted, value ~30px/700 near-black, and an inline **delta badge** to the right of the value. 4-up strip that reflows down.
- *ModuleHome variant*: surface card with a `3px` left border in the tone/accent color; value 23px/700 in the tone color, sub 11.5px faint. Strip grid: 6 cols → 3 (≤1200px) → 2 (≤620px).

**Delta / trend badge** — small `999px` pill next to a metric. Up/positive = green tone text on `~14%` green fill (`+8.6%`, `+12`); down/negative = rose tone text on rose fill (`-1.2%`). Micro font (~11px/700).

**Greeting header** (dashboard) — `Good day, <Name> 👋` at ~28px/700, with a calendar-icon + long date line beneath in muted text; a primary **Quick Actions** button (teal, trailing chevron) sits on the right.

**Module chip** (login) — pill-shaped ghost button: leading module icon + short label, translucent light border on the teal panel. Used to preview available modules.

**Function tile** — icon in a soft accent square, title 15px/700, description 12.5px muted, footer with count (accent) + arrow that nudges on hover. Hover: `translateY(-3px)` + `--shadow-lg` + accent border. Grid `auto-fill minmax(252px, 1fr)`.

**Buttons**
- `.btn-primary` — teal `--primary`, `--primary-contrast` text, `--shadow-sm`; active nudges down 1px.
- `.btn-ghost` — transparent, muted text, `--border`; hover fills `--surface-hover`.
- `.icon-btn` — 40×40, 12px radius, bordered surface.

**Form field** — label 12.5px/600 muted above; input wrapper on `--surface-2` with `1px --border`, ~46px tall, leading icon in `--text-faint`. Focus: border→`--primary`, bg→`--surface`, `0 0 0 3px --primary-soft` glow. Inputs are borderless/transparent inside the wrapper. `accent-color: var(--primary)` on checkboxes.

**Status pill** — `999px` radius, tone-colored text on `14%` tinted fill with `28%` tinted border.

**Worklist row / activity feed** — grid rows with a ref chip (tinted), title/subtitle, right-aligned value, status pill; hover fills `--surface-hover`. Feed rows have a soft icon tile + text + faint timestamp.

**Progress bar** — 8px track on `--surface-2`, fill = gradient of the module accent.

---

## 6. Accessibility & interaction rules

- Maintain WCAG **AA** for all body text on its surface.
- Focus: `:focus-visible` → `2px solid --primary`, `2px` offset. Inside dark pills use `outline-offset: -2px`.
- `::selection` uses `--primary-soft`.
- `@media (prefers-reduced-motion: reduce)` disables all animation/transition globally.
- Scrollbars: 10px, `--border-strong` thumb with a 2px `--bg` inset; teal-toned inside the sidebar.
- Fully responsive: sidebar collapses, KPI/tile grids reflow, secondary columns stack, status pills may hide on the smallest breakpoint.

---

## 7. Stack & conventions for new products

- **React 18 + Vite**, `react-router-dom`, **lucide-react** icons (stroke, ~44px tiles).
- Theme via `ThemeContext` (`data-theme` on `<html>`, persisted to `localStorage['dm-theme']`, OS default on first visit). Reuse it — don't reinvent theming.
- One global `styles/index.css` owns tokens + base + shared utilities (`.btn`, `.icon-btn`, `.fade-in`); components ship their own scoped CSS consuming only variables.
- Every new module: pick/extend a **module accent** (§3), reuse the ModuleHome layout (breadcrumb → header w/ gradient mark → KPI strip → function tiles → two-column panels), and stay on teal for primary actions.
- **Rule of thumb:** if you're about to type a hex code in a component, stop — use a token or add one to both themes.
