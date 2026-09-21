# Sentinel visual system

## Core terminal cleanup (current implementation)

For all terminal screens and shared navigation, `tailwind.config.ts` is
the palette authority; historical hex values and workstation sketches below
are reference only. `app/terminal.css` scopes refinements to the app shell.
Use Inter for prose, JetBrains Mono for figures, 13px default text (12px in dense controls), an 11px
label floor, and 6px control radii. Spacing follows 4/8/12/16/24px steps.
The density setting adjusts card padding and table rows, not the type floor.
Discover fills the remaining dynamic viewport; Overview and Trade scroll.
Trade uses a flexible chart with a 320px order rail from 1280px; smaller
screens stack chart, order controls, then detail tabs. New depth panels are
not part of this visual cleanup.

### Shared interaction rules

- Keep the five primary destinations in desktop navigation; secondary destinations live in More and the mobile drawer. Search remains visible at every width.
- Use concise page titles and `data-page-header` for the shared heading/action layout. Settings, Help, and Developers use a centered reading width.
- `Panel`, `MetricTile`, `Button`, `Input`, `Tabs`, and `DataTable` are the presentation primitives. Semantic palette aliases (`card`, `muted`, `primary`, `border`) resolve to the same graphite/azure tokens.
- Dialogs trap focus, restore it on close, and own scroll locking. Popovers close on Escape, outside interaction, and navigation; compound popovers begin closed.
- Tables provide keyboard-operated sort buttons and announce sort direction. Selected tab buttons use `aria-pressed`.
- Primary mobile actions are at least 44px high; mobile text-entry fields use 16px type to avoid automatic browser zoom. Honor reduced motion.
- Preview data must be labeled as sample data, never as a live feed.
- Keep Discover cards compact: approximately 176–192px at normal desktop column widths. Do not expand every audit detail into a separate row.

The historical guidance below describes intent, not additional constraints that
override the implemented tokens and interaction rules above.

The UI reads as sloppy not because individual components are broken but because
there is no system underneath them — every component picked its own padding, its
own border, its own emphasis. This file is the system. It is short on purpose:
rules you can hold in your head are the only ones that get followed.

## 1. Borders are boundaries, not decoration

**The single biggest problem in the current UI.** Nearly every element is
`rounded-xl border border-sentinel-800 bg-…`, so the screen is boxes inside
boxes inside boxes. When everything is separated, nothing is grouped, and the
eye has no way to rank what it sees.

- A border marks a **genuine region boundary** — the order panel, a modal, a
  scrolling column. Roughly 2–4 per screen.
- Everything else groups with **space and alignment**. A row of statistics is a
  row of statistics because it is aligned and evenly spaced, not because each
  number is in its own bordered tile.
- Where a divider is genuinely needed inside a region, use a single hairline
  (`border-t border-sentinel-800/80`), not a box.

## 2. One spacing scale

Only these values. No `p-2.5`, no `gap-1.5`, no `space-y-2.5`.

| Token | Tailwind | Use |
|---|---|---|
| 1 | `gap-1` / `p-1` (4px) | inside a pill or chip |
| 2 | `gap-2` / `p-2` (8px) | between tightly-related items (icon + label) |
| 3 | `gap-3` / `p-3` (12px) | inside a component; between rows of a list |
| 4 | `gap-4` / `p-4` (16px) | component padding; between components |
| 6 | `gap-6` / `p-6` (24px) | between regions |
| 8 | `gap-8` (32px) | between major sections |

## 3. Three type tiers, and only three

Density fails without hierarchy. Currently almost everything is 11–12px
semibold, so dense becomes noisy.

- **Primary** — `text-2xl`/`text-xl`, `font-bold`, `text-slate-100`.
  The one number or name a screen exists to show. **One per region.**
- **Secondary** — `text-sm`/`text-xs`, `font-semibold`, `text-slate-200`.
  Supporting values, row content, headings.
- **Label** — `.label-micro` (11px, uppercase, tracked, `text-slate-400`).
  Names a value. Never bold, never emphasized, never coloured.

The label is always quieter than the thing it labels. If you find yourself
styling both halves, neither will read.

## 4. Colour means one thing at a time

- **Azure** (`accent`, `sky-*`) — interactive and selected state only. Links,
  active tabs, focus. Never "important".
- **Buy green / sell red** (`emerald-*` / `rose-*`) — direction only. Price up,
  price down, buy side, sell side. Never a call-to-action, never decoration.
- **Amber** — a warning that needs a human. Rare by definition.
- Everything else is graphite. A screen where four hues fire at once has no
  emphasis at all.

**Corollary:** the primary action button is not green because green is nice —
it is green only when the action is *buy*. A neutral action gets a neutral
button.

## 5. Badges are earned

The current UI puts `LIVE`, `NEW`, `OPS`, `STANDARD`, `Clusters`, `VERIFIED`,
`TRENDING`, `SMART MONEY` on screen simultaneously. Every one of them is
shouting, so none is heard.

- A badge marks something **exceptional** — a risk flag, a non-default state.
- A count, a status, or a routine attribute is **plain text**.
- Aim for at most 1–2 badges visible per region.

## 6. Numbers

- Tabular figures everywhere (already set on `body`).
- Money, amounts and addresses in `font-numeric`; prose in Inter.
- Never render a raw fixed-point string — format at the boundary.
- Unknown is `—`, never `0`, never a fabricated default.

## 7. Density with a spine

Dense is correct for this product. Dense *and* readable requires:

- A consistent left alignment down each column, so the eye tracks vertically.
- Fixed-width abbreviated values (`48.3M`, not `$48,312,904.11`) so columns
  don't jitter as data updates.
- Whitespace between groups doing the work borders currently do.

## 8. Applying this

Do not retrofit everything at once. Take one screen, rebuild it against these
rules, look at it, and only then propagate. A rule that survives contact with a
real screen is worth keeping; one that doesn't should be changed here first.

---

# Chosen direction: B — dense trader terminal

Picked from the three-treatment mockup. Closest to Axiom/Trojan: maximum
information per screen, signal colour used deliberately, order controls always
reachable. These are the concrete values to build against — the rules above
still hold, this section makes them specific.

## Surfaces

| Role | Hex | Tailwind |
|---|---|---|
| Page ground | `#080A0E` | `sentinel-950` |
| Panel / raised | `#11151C` | `sentinel-850` |
| Border / divider | `#1D222B` | `sentinel-700` |
| Primary text | `#EAEEF5` | `slate-100` |
| Muted text | `#7E8794` | `slate-400` |

Note the border is a *visible* step off the panel. The earlier ramp had them
within 3–5 RGB points, which is why everything read flat.

## Semantic

| Meaning | Hex |
|---|---|
| Buy / up | `#12B574` |
| Sell / down | `#EC5A5F` |
| Interactive / selected | `#3B8FF0` |

Nothing else is coloured. A pill, a count, a status: plain text.

## Density

- Base body size **12px**; row content **11px**.
- Row padding **4px vertical / 10px horizontal**. Component padding **10px**.
- Gap between controls **10px**; **4px** inside a button cluster.
- Corner radius **6px**. Not 12px — large radii read soft, which fights density.
- Hero (the price) **22px bold**. It is the only large number on the screen.

**Deviation from the mockup, deliberate:** the mock used 10px labels. The app
keeps the **11px floor** (`text-2xs`). Uppercase micro-labels below 11px stop
being readable on a real display, and the mock flattered them at mockup scale.
Density comes from padding and row height, not from shrinking type past legible.

## Layout — trading workstation

Supersedes the earlier "statistics strip + order rail" sketch. The screen is a
*workstation*, not a page about a token: someone who has already decided what to
trade needs depth, tape, exposure and working orders visible at all times.

```
┌─ status rail ─ symbol · last · bid/ask/spread · H/L/vol · RPC+slot ─┐
├──────────────────────────┬───────────────┬─────────────────────────┤
│ chart + volume + VWAP    │ order book    │ order ticket            │
│ (holds the centre)       │ (depth ladder)│ side · size · limit      │
│                          │ spread inline │ cost · fee · slippage    │
├──────────────────────────┴───────────────┼─────────────────────────┤
│ time & sales (aggressor-coloured)        │ position / orders / fills│
├──────────────────────────────────────────┴─────────────────────────┤
│ equity · buying power · day P&L · margin · clock                   │
└────────────────────────────────────────────────────────────────────┘
```

Grid: `1fr 210px 250px` for the main band; `1fr 420px` for the lower band.

**Non-negotiables** (each was missing before and is why it read as a website):

- **Order book with size bars.** Bar length *is* resting size, so imbalance reads
  without parsing digits. Spread sits between the sides, quoted absolute **and in
  basis points** — bp is how execution cost is judged.
- **Position P&L is permanent**, average entry beside mark. Exposure is never
  behind a click.
- **Working orders cancellable in place**, listed under the position they protect.
- **Time & sales coloured by aggressor** (who crossed the spread), not by tick
  direction. Different information; this is the useful one.
- **Hotkeys printed, not hidden.** Volume traders do not use a mouse.
- **RPC latency and slot height always on screen.** On-chain, these are trading
  inputs, not diagnostics.

**Metrics:** 11px base, **2.5px** row padding, **zero rounded panels** in the
workspace (radius is for controls only, 3–4px). Colour restricted to bid/ask
plus one accent for interactive. Panels divide with 1px `--line`, never a box.

## Data required

- **Order book** — live DEX depth (Raydium CLMM pool state, or an aggregator).
  Does not exist today. Blocking for that panel only.
- **Time & sales** — per-swap stream with aggressor side. The Helius pipeline can
  feed this, but currently drops most events because it cannot derive a mint from
  logs alone; needs the `getTransaction` enrichment step.
- Everything else maps onto existing endpoints.

## Build order

1. Trade page — statistics strip, order rail, trade rows.
2. Discover columns and cards (already closest to this).
3. Dashboard cards.
4. Portfolio, alerts, settings.
5. Landing page last — it is a different audience and can stay distinct.
