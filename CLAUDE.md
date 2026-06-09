# Smart SIP — Claude Context

## What this is
A personal SPA for calculating monthly PSX stock purchases based on target portfolio allocations.
Built with React + TypeScript + Vite + Firebase Firestore.

## Directory structure
```
src/
  config/firebase.ts        — Firebase init + isFirebaseConfigured flag
  types/index.ts            — All shared TypeScript interfaces
  services/
    firebaseService.ts      — Firestore read/write (allocations + preferences)
    priceService.ts         — PSX price fetching via Vite dev proxy; parsePriceFromHtml()
    sipCalculator.ts        — Pure calculation logic (no side effects)
  components/
    AllocationManager.tsx   — CRUD UI for portfolio allocations
    SipSection.tsx          — SIP amount input, Calculate button, results table
    LoadingSpinner.tsx      — SVG spinner (CSS animation: spin)
  App.tsx                   — Bootstrap + layout + state wiring
  index.css                 — All styles (CSS variables design system, no framework)
```

## Key architectural decisions
- **No Redux**: state lives in App.tsx and is passed via props.
- **Vite dev proxy**: `priceService.ts` fetches `/psx/company/:symbol`, which Vite proxies to
  `https://dps.psx.com.pk` server-side (see `vite.config.ts`). No third-party proxy needed.
  If the page structure changes, update `parsePriceFromHtml()`.
- **Mock mode**: set `VITE_USE_MOCK_PRICES=true` in `.env.local` to skip real fetches.
- **Firestore rules**: must allow read/write for the collections `allocations` and `settings`.
  Lock these down with Firebase Authentication before sharing the app publicly.

## Firebase Firestore schema
- Collection `allocations`: docs `alloc_000`, `alloc_001`… → `{ symbol: string, allocation: number }`
- Collection `settings`: doc `preferences` → `{ lastSipAmount?: number }`

## Common tasks
- Add a stock price data source: replace/extend `fetchStockPrice()` in `priceService.ts`.
- Add a user preference: add the field to `UserPreferences` in `types/index.ts`, then use
  `savePreferences / loadPreferences` in `firebaseService.ts`.
- Change the PSX proxy target: update `vite.config.ts` server.proxy and `PSX_BASE` in `priceService.ts`.

## Running locally
```bash
cp .env.example .env.local   # fill in Firebase values
yarn dev
```

## Future features (not implemented — see App.tsx footer comment)
- Rebalancing engine
- Historical SIP records
