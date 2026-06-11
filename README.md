# QShot Web App (Builder + Dashboard)

Web port of the QShot / SpeakNet mobile app (Flutter). This is the **builder + account
dashboard** that profile owners use to sign in and create/edit their profiles, QR codes,
bookings, analytics, etc. The public visitor-facing renderer stays on the Nuxt app for now.

> Full plan: see `../docs/web-app-study/00-STUDY.md` and the mobile reference appendix.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **next-intl** — 9 locales (en, ar, sv, zh, fr, it, ku, no, pt) with RTL for Arabic
- **Tailwind CSS v4** — design tokens mirror the mobile theme (`globals.css`)
- **Zustand** (auth/editor state) + **TanStack Query** (server cache)
- **react-hook-form + zod** (forms) · **ky** (HTTP) · **lucide-react** (icons)

## Requirements

- **Node 22** (or ≥18.18). Run `nvm use` (`.nvmrc` pins 22.17.0). The default global Node 16
  will NOT work.

## Getting started

```bash
nvm use
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE
npm run dev
```

Open http://localhost:3000 → redirects to `/en/login`.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | `https://api.qshot.com` | Backend REST base (mobile uses `api.speaknet.app`) |
| `NEXT_PUBLIC_CDN_BASE` | `https://cdn.qshot.com` | Media CDN |

## Structure

```
src/
  i18n/            routing, navigation, request config (next-intl)
  middleware.ts    locale routing
  app/[locale]/
    (auth)/        login, register
    (app)/         dashboard (auth-guarded shell)
    layout.tsx     <html dir lang> + fonts + providers
  components/      ui/ primitives, language-switcher, providers
  lib/
    api/           client (ky+bearer), auth, profiles, account
    types/         api, blocks (16 block model), profile
  stores/          auth-store (zustand + persist)
messages/          <locale>.json
```

## Status (MVP, phase 0–1 of the study)

- [x] i18n + RTL + design tokens
- [x] Auth (email login/register) — pixel-matched to the mobile app, token persisted
- [x] Auth-guarded dashboard listing user profiles
- [x] TS model for all 16 block types
- [x] Profile **builder** skeleton: 3-pane editor (palette / live phone preview /
      settings), drag-reorder (dnd-kit), click-to-select, add/delete, save to API.
      Blocks live now: Header, Text, Button, Social, Divider, Spacer + Hero header.
- [ ] OAuth (Google/Apple) — pending backend web-flow confirmation
- [ ] Remaining 10 blocks (Images, Products, Reviews, Booking, …) · QR · booking
      dashboard · analytics (next phases)

### Builder structure

```
src/stores/editor-store.ts          editor state (blocks, settings, select, CRUD)
src/lib/builder/catalog.ts          palette entries + default block factories
src/lib/builder/color.ts            ARGB <-> CSS (mirrors the Nuxt renderer)
src/components/builder/
  BuilderShell.tsx                  3-pane layout + top bar + load/save
  BuilderCanvas.tsx                 phone frame + dnd-kit sortable list
  SortableBlock.tsx                 draggable/selectable block wrapper
  AddBlockMenu.tsx                  palette
  SettingsPanel.tsx                 hero + per-block forms
  preview/Hero.tsx, preview/BlockView.tsx   read-only renderers
```

## Notes

- `proxy` vs `middleware`: Next 16 deprecates the `middleware` filename in favor of `proxy`.
  We keep `middleware.ts` because next-intl targets it; revisit when next-intl supports `proxy`.
- Block JSON must match what the Flutter app produces so the Nuxt renderer displays it
  identically. The mobile entities are the source of truth.
