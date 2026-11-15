# êmet — project rules

AI-powered brand governance platform. Hackathon build.

## Environment (do not change without asking)

- macOS 12.6.7 (Monterey), Intel i5, 8 GB RAM — optimise for low memory.
- Node.js 22 LTS via nvm; pinned in `.nvmrc`. **Do not use Node 24.**
- npm only. **Do not introduce pnpm, yarn, bun, Docker or Homebrew.**
- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · ESLint · Turbopack.

## Design system — "Midnight Luxury" (permanent)

Dark, sophisticated, minimal, premium enterprise. Every screen uses this
identity. Never introduce a second visual language on an individual page.

Colour tokens live in `app/globals.css`. **Use the token names, never raw hex.**

| Token | Hex | Use |
|---|---|---|
| `background` | `#0B1120` | Page canvas |
| `background-secondary` | `#101827` | Section bands, sidebars |
| `surface` | `#151E2E` | Cards, panels |
| `surface-elevated` | `#1C293B` | Modals, popovers, hover states |
| `accent` | `#C8AA72` | Champagne gold — emphasis only, never large fills |
| `silver` | `#AAB4C3` | Icons, meta, quiet UI |
| `foreground` | `#F3F0E8` | Primary text |
| `foreground-muted` | `#929EAF` | Secondary text |
| `border` | `#1C293B` | Hairline rules |
| `critical` | `#F07878` | Coral — critical findings, negative indicators |
| `positive` | `#43C6A0` | Emerald — positive performance, improvements |
| `gold` | `#E0B967` | Champagne — primary data series, current period |
| `activity` | `#789BFA` | Sapphire — activity and volume series |
| `analysis` | `#B18AE8` | Amethyst — secondary analytical series |
| `turquoise` | `#53C2D1` | Ramp partner for sapphire |

`accent` (`#C8AA72`) is the brand gold for UI chrome — buttons, eyebrows, nav,
focus rings. `gold` (`#E0B967`) is its brighter sibling, for **data only**.
Chart roles are fixed: never reassign a hue per chart, or a reader who learned
"sapphire means volume" is misled when it means something else elsewhere.

### Why the data palette is brighter than the UI

Chroma below 0.08 stops reading as colour at all. The first chart palette
measured 0.024–0.093 and genuinely looked grey; these all clear the floor.

Measured against the panel surface (`#151E2E`), OKLab ΔE×100, floor 15:

- **Severity four (coral / champagne / sapphire / emerald): PASSES**, worst
  pair 16.7. The earlier muted set managed only 11.0.
- One caveat: coral ↔ emerald is ΔE 5.7 under deuteranopia — the classic
  red/green confusion. So severity is **always** paired with its written
  label, and the donut ships a legend with counts and percentages.
- `silver` is intentionally near-neutral (chroma 0.024). Use it for neutral
  data only, never as a category hue.

Rules that follow:
- Severity never travels on colour alone — always a label beside it.
- Part-to-whole: donut with a legend carrying name, count and percentage.
- One hue per row when categories are compared, assigned in fixed order and
  **never cycled**; past the palette's end, fall back to silver.
- Every chart keeps its table view, so no value needs colour to be read.

## Phase 2 — real AI

- **Gemini**, via the official `@google/genai` SDK. Server-side only, in
  `app/api/audit/route.ts`. The key is read from `GEMINI_API_KEY` in
  `.env.local` and never reaches the client; the page passes down only a
  boolean and the model name.
- Model from `GEMINI_MODEL`, default `gemini-3.8-flash`. **Never use
  `gemini-2.5-*`** — deprecated, auto-routes elsewhere from 1 Dec 2026.
- Structured output uses `responseJsonSchema` (not `responseSchema`, which is
  the older field) with `responseMimeType: "application/json"`. Read the reply
  from `response.text` as a property, not a method.
- **A model response is untrusted input.** `lib/ai/contract.ts` revalidates
  every field, drops unusable findings, and caps sizes. Never render it raw.
- **The score is computed here, never asked of the model** —
  `scoreFromFindings` plus `explainScore` in `lib/audit-engine.ts`. A language
  model cannot give a reproducible number, and the dial must move predictably
  when a reviewer dismisses a finding.
- **Never fake an AI audit.** With no key the UI shows setup instructions. The
  local rule engine stays available but is explicitly labelled "not AI".
- Persistence is `localStorage` only: `lib/brand-store.ts` for the Brand DNA,
  `lib/audit-store.ts` for audit history and review state. Per-browser, no
  database, no auth. Both use `useSyncExternalStore`, not context + effects,
  because the lint rules forbid setState inside an effect.

## Engineering guidelines

- Work in small, verifiable stages; test rather than assume.
- Keep dependencies minimal — justify every new package.
- Never commit secrets. All `.env*` files are gitignored.
- Ask before adding paid services or making major architectural changes.
- Explain important operations in plain language (the author is a beginner).
