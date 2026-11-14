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

Principles: elegant typography and strong hierarchy · generous whitespace ·
minimal structured layouts · subtle borders and restrained shadows ·
refined, low-key transitions · consistent components and spacing ·
responsive on desktop and mobile.

Avoid: generic dashboards, overcrowded cards, heavy gradients, neon colour,
gratuitous animation, decorative filler.

## Engineering guidelines

- Work in small, verifiable stages; test rather than assume.
- Keep dependencies minimal — justify every new package.
- Never commit secrets. All `.env*` files are gitignored.
- Ask before adding paid services or making major architectural changes.
- Explain important operations in plain language (the author is a beginner).
