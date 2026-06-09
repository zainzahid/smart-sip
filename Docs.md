# Smart SIP — Documentation

## Setup

### 1. Firebase
1. Go to [Firebase Console](https://console.firebase.google.com) and create a project.
2. Enable **Firestore Database** (start in test mode for personal use).
3. Go to Project Settings → Your apps → Add a Web app.
4. Copy the config values into `.env.local`:
   ```
   cp .env.example .env.local
   ```
5. Set Firestore rules (Security → Rules):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;  // personal use only — lock down before sharing
       }
     }
   }
   ```

### 2. Run
```bash
yarn dev       # development server at http://localhost:5173
yarn build     # production build → dist/
yarn preview   # preview the build
```

### 3. Mock mode (no Firebase / no PSX needed)
```bash
# in .env.local:
VITE_USE_MOCK_PRICES=true
```
Mock prices are defined in `priceService.ts` → `MOCK_PRICES`.

---

## Usage

### Portfolio Allocations
- Add each stock symbol and its target % (e.g. MARI = 25%).
- `CASH` is a special symbol — treated as a cash reserve, no price lookup.
- Total must equal **100%** before saving or calculating.
- Click **Save Allocations** to persist to Firestore.

### SIP Calculator
- Enter your monthly SIP amount in PKR.
- Press **Enter** or click **Calculate**.
- The app fetches the latest price for each stock from PSX, then shows:

| Column | Description |
|---|---|
| Symbol | Stock ticker |
| Alloc % | Your target % |
| Price | Latest price from PSX |
| Alloc Amt | `sipAmount × alloc%` |
| Shares | `floor(allocAmt / price)` |
| Invested | `shares × price` |
| Remaining | `allocAmt − invested` (leftover cash) |

- **Summary cards** show totals: SIP Amount, Total Invested, Cash Reserve, Unallocated Cash.
- The last SIP amount is saved automatically to Firestore (restored on next visit).

---

## Price fetching

Prices are scraped from `https://dps.psx.com.pk/company/<SYMBOL>` via the
[allorigins.win](https://allorigins.win) CORS proxy.

The parser tries three strategies in order:
1. JSON data embedded in `<script>` tags
2. DOM CSS selectors matching common price element classes
3. Raw HTML regex patterns

If prices fail to parse after a PSX page redesign, update `parsePriceFromHtml()` in
`src/services/priceService.ts` — it is intentionally isolated for this reason.

---

## Architecture notes

```
UI layer (React components)
        ↕ props / callbacks
State layer (App.tsx useState)
        ↕ async calls
Service layer (firebaseService · priceService · sipCalculator)
        ↕
External (Firebase Firestore · dps.psx.com.pk)
```

Business logic in `sipCalculator.ts` is a pure function with no side effects —
easy to unit test independently.
