# Kosca Design System — Portable

**Status:** v1
**Scope:** Brand-level design language. Stack-agnostic. Drop into any Kosca-family app (web, admin, future products) and pair with an app-specific addendum that re-anchors components and the audit backlog to that app's framework.

This document is the **what** and the **why**. The per-app design law is the **where** (which files, which framework primitives).

---

## §1 Identity

A Kosca surface is recognizable in one glance by:

- **Palette.** Lavender + indigo + cream. `--page-bg: #f0eff9` (cream-lavender). `--header-bg: #dddcf2` (lavender). `--accent-primary: #4d47a8` (indigo).
- **Typography.** Inter at 400 / 600 / 700. No other typeface.
- **Header.** Sticky, 48px tall, lavender background, lavender border-bottom. Three-column layout: brand left, primary nav centered, controls right (theme toggle, identity, sign-out). On `<md` viewports the centered nav collapses into a hamburger that opens the mobile drawer (§5).
- **Brand mark.** A raster or vector "K" logo (square aspect, transparent bg) sits at the left of every shell — header (32px), mobile drawer (28px), survey-taker (28px), auth pages (40–48px). The logo is the brand. Wordmark "Kosca {AppName}" sits next to it.
- **Avatars (user identity).** Gradient circle (`linear-gradient(135deg, var(--accent-gradient-from), var(--accent-gradient-to))`) with a single uppercase initial. Four canonical sizes: 20px / 28px / 32px / 80px. Avatars represent **users**, not the brand — never use the gradient circle as a logo placeholder.
- **Dark mode.** Class-toggled (`html.dark`); every token has a dark-mode pair. Desaturated indigo + warm grays in dark.

Anything that violates these markers stops looking like Kosca.

---

## §2 Tokens

All visual colors must come from a CSS custom property defined once in a global stylesheet (or framework theme config). Adding a new color requires adding BOTH a light and dark value.

### Token table

| Token | Light value | Dark value | Print value | Use |
|---|---|---|---|---|
| `--page-bg` | `#f0eff9` | `#1e2230` | `#ffffff` | Body / page background |
| `--header-bg` | `#dddcf2` | `#282d3c` | `#dddcf2` | Sticky header background |
| `--header-border` | `#b8b3e3` | `#3a4052` | — | Header bottom border |
| `--surface-primary` | `#ffffff` | `#242838` | `#ffffff` | Cards, panels, modal surfaces |
| `--surface-secondary` | `#f8fafc` | `#1e2230` | — | Alt surface (table alt rows, input bg fallback) |
| `--surface-tertiary` | `#f0eff9` | `#2e3342` | — | Tertiary tint (hover states, badges) |
| `--text-primary` | `#111827` | `#c8cdd6` | `#111827` | Body copy, labels, headings |
| `--text-secondary` | `#312d63` | `#9da5b4` | `#312d63` | Secondary labels, subheadings |
| `--text-tertiary` | `#3d3878` | `#a6aebb` | `#3d3878` | Inactive tabs, muted labels |
| `--text-muted` | `#9188d4` | `#6c7686` | — | Placeholder text, empty-state copy |
| `--text-light` | `#6b7280` | `#6c7686` | — | Very subtle labels |
| `--border-primary` | `#e5e7eb` | `#343a4a` | `#e5e7eb` | Default card / input borders |
| `--border-secondary` | `#b8b3e3` | `#3e4456` | — | Stronger borders (header, accented panels) |
| `--border-subtle` | `#f1f5f9` | `#2a2f3e` | — | Very faint borders (dividers inside surfaces) |
| `--accent-primary` | `#4d47a8` | `#9892d6` | — | Primary interactive color (buttons, active nav, focus ring base) |
| `--accent-secondary` | `#6b5fc4` | `#aca6e2` | — | Button hover, secondary accents |
| `--accent-hover` | `#c9c5e8` | `#2e3342` | — | Ghost button hover background |
| `--accent-gradient-from` | `#4d47a8` | `#9892d6` | — | Avatar / primary-button gradient start |
| `--accent-gradient-to` | `#3d3878` | `#7a74c2` | — | Avatar / primary-button gradient end |
| `--nav-active-bg` | `#4d47a8` | `#9892d6` | — | Active nav item background |
| `--nav-active-text` | `#ffffff` | `#ffffff` | — | Active nav item text |
| `--dropdown-bg` | `#ffffff` | `#282d3c` | — | Dropdown panel background |
| `--dropdown-border` | `#f3f4f6` | `#3a4052` | — | Dropdown panel border |
| `--dropdown-shadow` | `0 8px 24px rgba(0,0,0,0.1)` | `0 8px 24px rgba(0,0,0,0.20)` | — | Dropdown elevation |
| `--dropdown-hover` | `#f9fafb` | `#313744` | — | Dropdown item hover |
| `--dropdown-active-bg` | `#f5f3ff` | `#33304e` | — | Selected dropdown item bg |
| `--dropdown-active-text` | `#6d28d9` | `#c4bef0` | — | Selected dropdown item text |
| `--dropdown-divider` | `#f3f4f6` | `#3a4052` | — | Horizontal rule between dropdown sections |
| `--table-header-bg` | `#312d63` | `#282d3c` | — | Table header row bg |
| `--table-total-bg` | `#dddcf2` | `#2e3342` | — | Table totals row bg |
| `--table-row-hover` | `#f8fafc` | `#2a2f3e` | — | Table row hover |
| `--table-row-alt` | `#f3f4f6` | `#232838` | — | Alternating table row |
| `--scrollbar-thumb` | `#e2e8f0` | `#3e4456` | — | Custom scrollbar thumb |
| `--input-bg` | `#ffffff` | `#282d3c` | — | Form input bg |
| `--input-border` | `#e5e7eb` | `#3a4052` | — | Form input border |
| `--input-text` | `#111827` | `#c8cdd6` | — | Form input text |
| `--badge-bg` | `#f0eff9` | `#2e3342` | — | Default badge bg |
| `--badge-text` | `#4d47a8` | `#c4bef0` | — | Default badge text |
| `--status-success-bg/text/border` | `#ecfdf5 / #047857 / #a7f3d0` | dark-mode emerald rgba pair | — | Success pill / banner |
| `--status-info-bg/text/border` | `#eff6ff / #1d4ed8 / #bfdbfe` | dark-mode blue rgba pair | — | Info pill / banner |
| `--status-warn-bg/text/border` | `#fffbeb / #b45309 / #fde68a` | dark-mode amber rgba pair | — | Warning pill / banner |
| `--status-danger-bg/text/border` | `#fef2f2 / #b91c1c / #fecaca` | dark-mode red rgba pair | — | Destructive pill / banner |
| `--status-neutral-bg/text/border` | `#f1f5f9 / #334155 / #e2e8f0` | `#2a2f3e / #c8cdd6 / #3a4052` | — | Neutral / default pill |
| `--error-text` | `#dc2626` | `#f87171` | — | Inline form-error text color |

### Never use

- **Any `*-violet-*` Tailwind utility.** Violet is a dead palette color. Replace with the equivalent `*-indigo-*` shade or a `var(--*)` token.
- **Raw hex literals in component markup.** Add a named token to the global stylesheet (`:root` + `.dark`) and reference via `var(--*)`. Exception: email templates (email-client constraint — see §6).
- **Undocumented arbitrary font sizes** (e.g. `text-[NNpx]` outside the exceptions in §3).

---

## §3 Typography

### Font family

Inter, loaded via Google Fonts or self-hosted. Applied globally to `body` via `font-family: 'Inter', sans-serif`. Never override `font-family` in a component.

### Canonical scale

| Class (Tailwind) | Size | Primary use |
|---|---|---|
| `text-xs` | 12px | Secondary labels, metadata, small table copy, tag text |
| `text-sm` | 14px | Standard body copy, form values, card content |
| `text-base` | 16px | Page body prose (rarely used) |
| `text-lg` | 18px | Section subheadings |
| `text-xl` | 20px | Modal titles, section headings |
| `text-2xl` | 24px | Page `<h1>` headings |

### Allowed small-label exceptions

| Size | Context |
|---|---|
| `text-[11px]` | Inline form validation error below an input |
| `text-[10px]` | Uppercase column headers, inline data pills inside compact tables |
| `text-[9px]` | Role pill in global header (uppercase, font-bold) |
| `text-[8px]` | Compact metadata in dense tables (late badges, mini status pills) |

Any new arbitrary size requires being documented in your app's design law before use.

### Weights

| Weight | Class | Use |
|---|---|---|
| 400 | `font-normal` | Body copy (default) |
| 600 | `font-semibold` | Nav links, card labels, table headers, button text |
| 700 | `font-bold` | Emphasis, headings, role badges |

### Tracking

| Class | Use |
|---|---|
| `tracking-tight` | Brand / marketing text (logo area) |
| `tracking-wide` | Small uppercase labels (column headers) |
| `tracking-wider` | Micro-labels in compact contexts |
| `tracking-widest` | Maximum emphasis on tiny uppercase labels |

### Uppercase-label convention

Short category / status labels use `uppercase font-semibold text-xs tracking-wide` (or `tracking-wider`).

---

## §4 Spacing & layout

### Page container

- **Content pages:** `max-w-7xl mx-auto px-4 lg:px-8`
- **Header inner:** `px-4 lg:px-8` (same horizontal gutters, no `max-w-7xl` — header spans full width)
- **Print / statement view:** `max-w-4xl` — documented exception for print/share layouts

### Header height

`h-12` (48px). Sticky (`sticky top-0 z-30`).

### Avatar sizes (four-tier system)

| Size | Class | Context |
|---|---|---|
| 20px | `h-5 w-5` | Compact / summary lists |
| 28px | `h-7 w-7` | Global header, mobile drawer |
| 32px | `h-8 w-8` | Comment thread |
| 80px | `h-20 w-20` | Profile hero |

### Nav button padding

- Desktop header nav links: `px-2.5 py-1`
- Dropdown menu items: `px-3 py-1.5 text-xs`
- Mobile drawer nav links: `padding: 9px 12px`

### Border-radius rhythm

| Class | px | Use |
|---|---|---|
| `rounded-md` | 6px | Nav buttons, standard form inputs |
| `rounded-lg` | 8px | Icon containers, card elements, badge pills |
| `rounded-xl` | 12px | Dropdown panels, content cards, dropzone |
| `rounded-2xl` | 16px | Page header cards |
| `rounded-full` | 50% | Avatars, filter pills, status dots |

### Logo sizes

- Header: 32×32px
- Mobile drawer: 28×28px

---

## §5 Components

For each component: anatomy (what it's made of), DO markup (canonical), DON'T markup (forbidden). Snippets use Tailwind + plain HTML; translate idioms to your framework as needed (React: replace `style="…"` with `style={{…}}`; Vue: `:style` binding; etc.).

### Button — primary

**Anatomy:** `var(--accent-primary)` bg, `var(--accent-secondary)` on hover, white text, `text-xs font-semibold`, `rounded-md` or `rounded-lg`, `px-2.5 py-1` (small) or `px-4 py-2` (standard).

**DO:**
```html
<button class="px-2.5 py-1 rounded-md text-xs font-semibold text-white transition-colors"
        style="background:var(--accent-primary)"
        onmouseover="this.style.background='var(--accent-secondary)'"
        onmouseout="this.style.background='var(--accent-primary)'">
  Save changes
</button>
```

**DON'T:**
```html
<!-- raw Tailwind color: bypasses token, no dark-mode pair -->
<button class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded">Submit</button>
```

### Button — secondary

**Anatomy:** Transparent bg, `var(--border-primary)` border, `var(--text-primary)` text, hover fills with `var(--accent-hover)`.

**DO:**
```html
<button class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors border"
        style="color:var(--text-muted); border-color:var(--border-primary)"
        onmouseover="this.style.background='var(--accent-hover)'"
        onmouseout="this.style.background=''">
  Cancel
</button>
```

### Button — ghost (icon-only)

**Anatomy:** No background, no border. `p-1 rounded` with `transition-colors`. On hover: `hover:bg-indigo-50 dark:hover:bg-indigo-950/40`. Wraps a single SVG icon.

**DO:**
```html
<button class="p-1 rounded transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
        style="color:var(--text-muted)" title="Reply">
  <svg class="w-3.5 h-3.5">...</svg>
</button>
```

### Badge / chip

**Anatomy:** `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset`. Semantic color variants by meaning (aging band, status). Role badges use `text-[9px] uppercase font-bold tracking-wider`.

**DO:**
```html
<span class="text-[9px] uppercase font-bold tracking-wider rounded-full px-1.5 py-[1px]"
      style="background:var(--badge-bg); color:var(--badge-text)">ADMIN</span>
```

**DON'T:**
```html
<!-- violet palette -->
<span class="bg-violet-50 text-violet-700 border border-violet-200 ...">Bulk</span>
```

### Card

**Anatomy:** `rounded-xl border shadow-sm` with `var(--surface-primary)` background and `var(--border-primary)` border. Inner padding `p-4` or `p-6`.

**DO:**
```html
<div class="rounded-xl border shadow-sm p-6"
     style="background:var(--surface-primary); border-color:var(--border-primary)">
  <!-- card content -->
</div>
```

**DON'T:**
```html
<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">...</div>
```

**Interactive cards (clickable summary tiles).** When a card is also a link, indicate hover with a **border-color shift to `var(--accent-primary)` + a small shadow lift** (`hover:shadow-md`), and shift the label/header text from `--text-secondary` → `var(--accent-primary)`. **Do not** swap the entire card background to `var(--accent-hover)` — the saturated lavender washes out muted-lavender label text.

### Table

**Anatomy:** Full-width, `text-sm`, **`border-collapse: separate; border-spacing: 0`** so an outer `border + border-radius: 8px + overflow: hidden` works. Header row gradient is applied to the **`<thead> <tr>`** (not per `<th>`) so it stays seamless across columns:
`background: radial-gradient(ellipse at top left, var(--accent-secondary), var(--accent-primary) 50%, var(--table-header-bg))`. Header cells: `text-[10px] font-semibold uppercase tracking-wider text-center` with `color: rgba(255,255,255,0.92)` and a subtle `border-left: 1px solid rgba(255,255,255,0.18)` between adjacent `<th>` for column legibility. Body cells: `text-center align-middle`, `border-top + border-right: 1px solid var(--border-primary)`. Optional zebra striping with `var(--table-row-alt)` on even rows; row hover with `var(--table-row-hover)`. Totals row: `var(--table-total-bg)`.

**Sort indicators inside `<th>`** must inherit `currentColor` so the white header text shows through; do not hard-code `var(--text-primary)` on a sort-link `<a>`/`<button>` inside a header cell.

**DO (table shell):**
```html
<table style="border-collapse:separate; border-spacing:0; border:1px solid var(--border-primary); border-radius:8px; overflow:hidden">
  <thead>
    <tr style="background: radial-gradient(ellipse at top left, var(--accent-secondary), var(--accent-primary) 50%, var(--table-header-bg))">
      <th class="text-[10px] font-semibold uppercase tracking-wider text-center" style="color:rgba(255,255,255,0.92)">Invoice No</th>
      <!-- … -->
    </tr>
  </thead>
  …
</table>
```

**DON'T:**
```html
<!-- hardcoded gradient hex, applied per-cell so seams appear between columns -->
<th style="background: radial-gradient(ellipse at top left, #5548a0, #3d3878 50%, #2d2a5e)">
```

### Dropdown menu

**Anatomy:** State-toggle wrapper. Trigger button with `aria-expanded` and `aria-haspopup="menu"`. Panel: `absolute z-50 w-44 rounded-xl py-1.5` with `var(--dropdown-bg)` bg, `var(--dropdown-border)` border, `var(--dropdown-shadow)` shadow. Items: `px-3 py-1.5 text-xs font-medium transition-colors`. Close on outside-click AND Escape — both required. Enter/leave transitions 100–150ms.

**DO (using Alpine.js as the example — translate to React/Vue state hooks as needed):**
```html
<div class="relative" x-data="{ open: false }"
     @click.outside="open = false"
     @keydown.escape.window="open = false">
  <button @click="open = !open"
          :aria-expanded="open.toString()"
          aria-haspopup="menu"
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors">Settings</button>
  <div x-show="open"
       x-transition:enter="transition ease-out duration-150"
       x-transition:leave="transition ease-in duration-100"
       class="absolute right-0 mt-1 w-44 rounded-xl py-1.5 z-50"
       style="background:var(--dropdown-bg); border:1px solid var(--dropdown-border); box-shadow:var(--dropdown-shadow)">
    <a href="#" class="block px-3 py-1.5 text-xs font-medium transition-colors rounded-lg mx-1">Item</a>
  </div>
</div>
```

**DON'T:** Omit either the outside-click handler or the Escape handler — that's a keyboard trap.

### Drawer (mobile nav)

**Anatomy:** Fixed-position overlay teleported to `<body>`. Global state (not local component state) so any nav can open/close it. Backdrop: `bg-black/50` with `transition-opacity duration-200`. Panel: `fixed inset-y-0 left-0 z-50`, `width: 72vw; max-width: 280px`, `var(--surface-primary)` bg. Enter: `transition-transform duration-250 ease-out` from `-translate-x-full`. Leave: `transition-transform duration-200 ease-in` to `-translate-x-full`.

### Modal / confirmation

**There is no custom modal component.** Confirmation dialogs use one of four canonical patterns:

1. Browser-native `confirm()` triggered before a destructive request (e.g. via HTMX `hx-confirm`, framework router guards, or `onsubmit="return confirm('…')"`).
2. `window.confirm()` inside a click handler.
3. Type-to-confirm pattern for irreversible system-level operations: input bound to a button that stays `disabled` until the user types a specific token (e.g. `'RESTORE'`).
4. App-defined dialog component (if your stack provides one), *only* if it's reviewed and added to your app's design law.

### Form input

**Anatomy:** `block w-full rounded-md border py-1.5 px-2.5 text-xs` with `var(--input-bg)` bg, `var(--input-border)` border, `var(--input-text)` text. Focus ring via `focus:ring-2 focus:ring-inset` with ring color set from `var(--accent-primary)`.

**DO:**
```html
<textarea class="block w-full rounded-md border py-1.5 px-2.5 text-xs resize-none focus:ring-2 focus:ring-inset"
          style="background:var(--input-bg); border:1px solid var(--input-border); color:var(--input-text)"
          onfocus="this.style.setProperty('--tw-ring-color','var(--accent-primary)')"></textarea>
```

### File upload

**Anatomy:** Drop-zone `<label>`: `flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-colors` with `border-indigo-200 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30`. Cloud-upload SVG icon `w-8 h-8 mb-2 text-indigo-400`. Copy: "Click to upload" + "drag and drop" + file-type hint. Hidden `<input type="file">`. Selected-file indicator with indigo tint + checkmark. Submit button: full-width `rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60` (or token equivalents).

### Status pill / status dot

- **Aging-band pill:** `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset`. Semantic color by band (red / orange / amber / blue / emerald).
- **Alert dot:** `w-2 h-2 rounded-full` with a named token color.
- **Settled / success badge:** `bg-emerald-50 text-emerald-700 ring-emerald-200`.

**Helper classes (use these instead of raw Tailwind colors so dark-mode pairs are automatic):**

| Class | Token source | Use |
|---|---|---|
| `.pill-success` | `--status-success-{bg,text,border}` | Submitted / settled / completed |
| `.pill-info` | `--status-info-{bg,text,border}` | Confirmed / in-progress info |
| `.pill-warn` | `--status-warn-{bg,text,border}` | Must-action / overdue soft warn |
| `.pill-danger` | `--status-danger-{bg,text,border}` | Failed / blocked |
| `.pill-neutral` | `--status-neutral-{bg,text,border}` | Generic neutral state (e.g. "Sent") |

Each pill class sets `background`, `color`, and `box-shadow: inset 0 0 0 1px <border>` (so they compose cleanly with the `.badge` shape primitive: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold`).

### Banner (server-rendered flash / inline alert)

**Anatomy:** `rounded-xl px-4 py-2.5 text-xs font-medium`. Use the helper classes paired with `role="alert"` for accessibility:

| Class | Token source |
|---|---|
| `.banner-success` | `--status-success-{bg,text,border}` |
| `.banner-info` | `--status-info-{bg,text,border}` |
| `.banner-warn` | `--status-warn-{bg,text,border}` |
| `.banner-danger` | `--status-danger-{bg,text,border}` |

### Code-pill (click-to-copy)

**Anatomy:** Any element with a `data-copy-code="<value>"` attribute. The click handler is registered globally and **never re-implemented per page**. On click: text replaced with "Copied", an emerald flash class applied for 1200ms, then restored. Uses `navigator.clipboard.writeText()` with `execCommand('copy')` fallback.

**DO:**
```html
<span class="font-mono text-xs cursor-pointer rounded px-1.5 py-0.5"
      style="background:var(--badge-bg); color:var(--badge-text)"
      data-copy-code="INV-2024-0001">INV-2024-0001</span>
```

### Toast / inline error

- **Toast:** Fixed-position float using `var(--toast-bg)` / `var(--toast-text)` tokens.
- **Flash banner (server-rendered):** `rounded-xl px-4 py-2.5 text-xs font-medium` with semantic color classes — success `bg-emerald-50 text-emerald-700 border border-emerald-200`; error `bg-red-50 text-red-700 border border-red-200`; info `bg-indigo-50 text-indigo-700 border border-indigo-200`.
- **Inline form error:** `.form-error` helper — applies `mt-2 text-[11px] color: var(--error-text)` and is shown directly below the offending input.
- All error banners and inline errors must carry `role="alert"`.

### Empty state

**No illustration component.** Empty states are inline text-only — a short `<p>` with `style="color:var(--text-muted)"`. No icons, no SVG illustrations, no "Oops!" copy.

**DO:**
```html
<p class="text-center text-xs py-5" style="color:var(--text-muted)">
  No invoices match this filter.
</p>
```

If an action is warranted, add it immediately after as a plain-text link or secondary button.

### Pagination

**Anatomy.** Every list view paginates with two visually-separated parts:

- **Top right (above the table):** **rows-per-page select** + **range counter** (`from–to of total`). Right-aligned inside the table card.
- **Bottom center (below the table):** **page navigator** — first, prev, current `X / Y`, next, last. Centered.

**Rows-per-page options:** `10 / 25 / 50` (canonical). Apps may extend with larger steps (100 / 250) but must keep `10` as the smallest option.

**Default per-page:** `10`. Persist the user's choice via the URL (`?page=1&perPage=25`) for server-rendered tables, or via local component state for client-only tables. Changing per-page resets to page 1.

**DO (top-right stats slot):**
```html
<div class="flex items-center justify-end gap-2 text-xs" style="color:var(--text-secondary)">
  <span>Rows per page</span>
  <select class="input" style="padding:2px 8px; font-size:12px; width:auto">
    <option>10</option><option>25</option><option>50</option>
  </select>
  <span>1–10 of 247</span>
</div>
```

**DO (bottom-center nav slot):**
```html
<div class="flex items-center justify-center gap-1 text-xs">
  <button class="px-2 py-1 rounded-md border" disabled>«</button>
  <button class="px-2 py-1 rounded-md border" disabled>‹</button>
  <span class="px-2 font-semibold" style="color:var(--text-primary)">1 / 25</span>
  <button class="px-2 py-1 rounded-md border">›</button>
  <button class="px-2 py-1 rounded-md border">»</button>
</div>
```

**DON'T:**
- Combine stats + nav in a single bottom strip (loses the right-aligned stats convention).
- Render only `< 1 >` without a total / range counter — users need to know the dataset size.
- Mix client and server pagination on the same page.

---

## §6 Page skeleton

### Standard page

```
[Header / layout-top]   ← sticky, 48px, lavender
[Subnav / breadcrumbs]  ← optional per app
<main id="main-content" class="max-w-7xl mx-auto px-4 lg:px-8">
  <h1 class="text-2xl font-bold tracking-tight" style="color:var(--text-primary)">Page title</h1>
  <!-- page body -->
</main>
[Layout-bottom / footer]
```

Required on every standard page:

- `<main id="main-content">` — the skip-link in the header targets this exact id. Do not rename.
- Container `max-w-7xl mx-auto px-4 lg:px-8` on `<main>`.
- A page `<h1>` as the first content block.

### Documented exceptions

- **Auth pages (login / error):** Standalone, no header/subnav. Centered card on full-bleed `--page-bg`. No skip-link required.
- **Print / share views (statements, invoices for export):** Narrower container (`max-w-4xl`). May omit subnav.
- **Email templates:** Table-based layout, inline hex styles, system font stack (`Arial, Helvetica, sans-serif` or similar — Inter does not render in most email clients). No CSS variables. No dark-mode variants. §2 and §8 do not apply.

---

## §7 Interaction

### Open/close pattern (dropdowns, dialogs, popovers)

Every open/close component must:

1. Toggle on the trigger.
2. Close on click outside.
3. Close on `Escape`.
4. Bind `aria-expanded` to the open state on the trigger.
5. Use `aria-haspopup="menu"` on dropdown triggers.

Neither outside-click nor Escape is optional. Implementation differs by stack (Alpine `@click.outside` / `@keydown.escape.window`, React `useEffect` on `mousedown` + `keydown`, etc.) but the rules don't.

### Mobile drawer

Use a global state store (not local component state) so any nav element can open it. Slide-in from the left, backdrop fades in. See §5 Drawer for transition timings.

### Copy-to-clipboard

Register a single global handler that delegates on a data attribute (`data-copy-code` or equivalent). Never reimplement per component — duplicate handlers break the flash-state.

### Confirm patterns

Pick by context:
1. Browser-native `confirm()` for routine destructive actions.
2. Type-to-confirm only for irreversible system-level operations (e.g. backup restore).
3. Custom dialog only if your app's design law defines one.

### Optimistic vs pessimistic

Default to **pessimistic**: show loading state, wait for server, then update UI. Optimistic updates require explicit design review.

### Page-scoped CSS variables

Allowed: define page-specific `--page-*` vars in a scoped style block. Must include both light and dark counterparts.

---

## §8 Dark mode

- **Toggle:** `html.dark` class. Added/removed by a theme-toggle button. The toggle is **three-state** and cycles `light → dark → system → light`. Saved as `localStorage.theme` ∈ `{'light' | 'dark' | 'system'}`.
- **Default:** `light`. First-time visitors see light mode regardless of OS preference. Only switch to dark when (a) the user explicitly picks dark, or (b) the user picks `system` AND `prefers-color-scheme: dark` is set.
- **Pre-paint script:** Apply the `dark` class in a `<head>` inline script that reads `localStorage.theme` BEFORE first paint, so dark-mode users never flash light. Add `suppressHydrationWarning` (or framework equivalent) to `<html>` because the script mutates a server-rendered attribute.
- **`system` mode** must subscribe to `(prefers-color-scheme: dark)` `matchMedia` change events while active, so OS-level theme switches take effect live.
- **Token pairing:** Every visual color **must** come from a CSS custom property. Light value in `:root`, dark value in `.dark`. The two blocks are always edited together.
- **Adding a new color:** Add BOTH the light value to `:root` and the dark value to `.dark`. Never inline a one-off hex without a corresponding dark variant.
- **Print override:** A `@media print` block forces light values for tokens that affect paper output. Add new print-sensitive tokens there.
- **Email templates and standalone pages:** Documented exceptions. May use inline hex.

---

## §9 Accessibility (WCAG AA floor)

- **Skip-link.** `<a href="#main-content" class="sr-only focus:not-sr-only ...">` in the header. Target must be `<main id="main-content">`.
- **Focus-visible.** All interactive elements show a visible focus ring (`focus:ring-2 focus:ring-offset-2` with ring color `var(--accent-primary)`). Never suppress default focus without a visible replacement.
- **ARIA on dropdowns.** Triggers carry `aria-expanded` bound to state and `aria-haspopup="menu"`.
- **Form labels.** Every input/textarea/select has a visible `<label for>` or `aria-label`. Placeholder is not a label.
- **Error announcements.** Server-rendered error banners and inline form errors carry `role="alert"`.
- **Contrast.** Token pairs in §2 are pre-selected for WCAG AA. Verify any new color with a contrast tool before adding.
- **Image alt.** Decorative `alt=""`; meaningful images get descriptive alt.
- **Keyboard.** Dropdowns close on Escape. Drawers close on backdrop click.
- **Live regions.** Use `aria-live="polite"` for content that updates without a full-page reload.

---

## §10 Motion

| Element | Timing |
|---|---|
| Color transitions (hover, theme toggle) | 150ms ease-in-out (`transition-colors`) |
| Dropdown panels | 100–150ms ease |
| Drawer enter | 250ms ease-out |
| Drawer leave | 200ms ease-in |
| Backdrop enter | 200ms |
| Backdrop leave | 150ms |
| Chevron / disclosure rotate | 200ms |
| Copy-pill flash | 1200ms (JS timeout, not a CSS transition) |

**No load animations.** Pages render instantly. Animation is reserved for user-triggered state changes (open/close, hover, async response).

**Keyframes:** Only `animate-spin` on loading spinners. New `@keyframes` require design review.

**Reduced motion:** Honor `prefers-reduced-motion`. Tailwind respects it for `animate-*` utilities; never introduce custom animations that ignore it.

---

## §11 Microcopy

### Button verbs

Concrete, specific. Sentence case. No punctuation.

| DO | DON'T |
|---|---|
| Save changes | Submit |
| Send invite | OK |
| Delete user | Yes |
| Upload report | Upload |
| Sync now | Refresh |
| Sign in / Sign out | Login / Logout |
| Reply | Post |
| Click to upload | Browse |

Loading states append an ellipsis: "Uploading…".

### Empty states

One sentence, matter-of-fact tone. No chirpy copy, no emoji, no "Oops!" framing. If an action is available, add it as a plain-text link or secondary button immediately after.

Examples:
- "No data available"
- "No comments yet."
- "Never" — for last-sync timestamps when no sync has occurred.
- Em-dash `—` as a null placeholder in table cells.

### Error tone

Plain language. No stack traces in the UI. No "Oops". No emoji. No apology. State what failed; suggest what to do next.

### Confirmation copy

Direct imperative question + question mark. For irreversible actions, append "This cannot be undone."

Examples:
- "Delete this comment?"
- "Delete ALL comments for this invoice? This cannot be undone."
- "Mark this customer as disputed?"

Past-tense for completed-action toasts: "User deleted."

### Numbers and currency

Use your locale's native formatting consistently across the app — don't mix `en-US` and `en-IN` (or whatever applies). For India-deployed Kosca apps: Indian formatting, INR currency, no `$`.

Recommended:
- **Primary (no decimals):** `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`
- **Precise (2 decimals):** `.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
- **Count:** `.toLocaleString('en-IN')`

Centralize formatters in a single utility module — never inline locale literals in templates.

### Date format

| Context | Format | Example |
|---|---|---|
| Display | `DD-MON-YYYY` | `05-APR-2026` |
| Timestamp with time (local TZ) | `DD Mon YYYY, HH:MM am/pm` | `05 Apr 2026, 06:20 am` |
| Time-of-day only | `HH:MM am/pm` | `06:20 am` |
| Date input (user editing) | `YYYY-MM-DD` (native `<input type="date">`) | `2026-04-05` |

Never use `en-US` formatting or `MM/DD/YYYY` order anywhere in the UI.

---

## §12 Forbidden patterns

These are bugs by inspection. To change a rule, deprecate it via PR — do not bypass.

| ID | Pattern | Why it's forbidden |
|---|---|---|
| F1 | Legacy template-literal layout patterns that bake the page body into a JS string passed to a layout partial | Produced quote-escape bugs. Use a proper layout/composition primitive in your framework. |
| F2 | Any `*-violet-*` Tailwind utility | Dead palette. Violet was never a Kosca brand color. Use `*-indigo-*` or a `var(--accent-*)` token. |
| F3 | Raw hex literal (`#xxxxxx` or `rgb(…)`) in component markup | Bypasses the token system. Add a named token pair to `:root` and `.dark`. Exception: email templates. |
| F4 | A visual color with no dark-mode counterpart | Dark mode is a hard requirement. Every color must behave correctly in `html.dark`. |
| F5 | A standard page without `<main id="main-content">` | Breaks the skip-link. |
| F6 | Manually re-initializing interactive bindings after a server-rendered partial swap | Use the framework's lifecycle hook once, globally. Duplicate listeners break state. |
| F7 | Manual CSRF token logic in a page/component | Inject globally (interceptor, middleware, or fetch wrapper). Manual code drifts and risks getting out of sync. |
| F8 | Inline `onclick` attributes for non-trivial logic | Use framework event bindings or declarative confirm helpers. Inline strings are hard to test and easy to miss in security review. Simple one-liners (e.g. `onclick="this.classList.toggle('hidden')"`) are acceptable. |

---

## §13 Per-page checklist

Tick every item before saving any UI edit. Mark each ✓ / ✗ / N/A (with a one-line reason for N/A) before proceeding.

- [ ] All colors are CSS variables (`var(--*)`) or canonical Tailwind tokens (custom `indigo-*` palette, neutral grays). No raw hex. No `*-violet-*`.
- [ ] Every visible color has a dark-mode counterpart.
- [ ] Inter font is in use (inherited from `<body>` — do not override `font-family`).
- [ ] Typography uses the canonical scale (§3). No arbitrary `text-[NNpx]` outside documented exceptions.
- [ ] Page uses the standard header + subnav + footer skeleton, or a documented exception (auth, error, print-share, email).
- [ ] Skip-link works — `<main id="main-content">` is present.
- [ ] All interactive elements have a visible focus state.
- [ ] Server-rendered partial swaps reuse the global lifecycle hook — no per-page re-init.
- [ ] Motion timings match §10. No load animations.
- [ ] Microcopy: button verbs are concrete action phrases (§11). Empty states are one sentence + (optional) primary action.
- [ ] Lists are paginated per §5: rows-per-page select + range counter top-right; centered first/prev/X·of·Y/next/last bottom.
- [ ] Status pills and banners use the `.pill-*` / `.banner-*` helper classes — no raw `bg-*-100 text-*-800` Tailwind utilities.
- [ ] Inline form errors use `.form-error` and carry `role="alert"`.
- [ ] Theme toggle cycles `light → dark → system`; default is `light`; pre-paint script + `suppressHydrationWarning` are in place (§8).
- [ ] Brand mark (logo) is the leading element in every shell header — never the gradient avatar circle (§1).

---

## How to adopt this in a new app

1. **Drop the token block (§2) into your global stylesheet** — one CSS file with `:root`, `.dark`, and `@media print` blocks. Or translate to your framework's theme config (Tailwind preset, CSS-in-JS theme object, etc.).
2. **Adopt Inter** via Google Fonts or self-host. Set it on `body`.
3. **Implement the four-tier avatar component, primary button, card, dropdown, table header, and form input** as your app's primitives — copy the anatomy + DO snippets from §5 and translate to your framework.
4. **Add a header partial** with a sticky 48px lavender bar, skip-link, theme toggle, and the gradient-circle avatar.
5. **Write the per-app design law** — a short addendum covering: framework idioms, file paths, component locations, your app-specific audit backlog (analogous to §13 of the per-app law). Keep it next to this document.
6. **Add a save-time linter** that blocks `*-violet-*`, raw hex outside the token file, and missing `main-content` ids — same forbidden patterns as §12.
