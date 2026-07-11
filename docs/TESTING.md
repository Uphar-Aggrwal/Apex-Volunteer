# VolunteerAI — Testing Guide

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/volunteer-ai.git
cd volunteer-ai
npm install
cd functions && npm install && cd ..
cp .env.example .env
# Fill in .env with your Firebase and Google Maps keys
```

---

## Running Tests

### Frontend (React + Vite)

```bash
# All tests
npm test

# With coverage report
npm run test:coverage

# Single file
npm test -- csvValidator
```

### Cloud Functions (Node.js)

```bash
cd functions

# All tests
npm test

# With coverage report
npm run test:coverage
```

---

## Test Categories

### Frontend (46 tests across 2 suites)

| Suite | Tests | What it covers |
|---|---|---|
| `csvValidator.test.js` | 32 | Header validation, row validation, full payload, tier colors, alert threshold |
| `geminiUtils.test.js` | 14 | JSON parsing (clean, markdown-wrapped, embedded), fallback objects, validation |

### Cloud Functions (35 tests across 3 suites)

| Suite | Tests | What it covers |
|---|---|---|
| `validateCSV.test.js` | 13 | Row validation, payload validation, edge values |
| `geminiOrchestrator.test.js` | 13 | JSON parsing, fallback, prompt injection, prompt building |
| `translationOrchestrator.test.js` | 9 | Prompt building, cache key generation, tone differentiation |

**Total: 81 tests**

---

## Coverage Targets

| Metric | Target | Command |
|---|---|---|
| Lines | ≥ 85% | `npm run test:coverage` |
| Functions | ≥ 85% | `npm run test:coverage` |
| Branches | ≥ 80% | `npm run test:coverage` |
| Statements | ≥ 85% | `npm run test:coverage` |

---

## Evaluator Proof Checklist

Run through these scenarios to prove the app handles all edge cases:

### CSV Upload

- [ ] Upload `empty.csv` (0 bytes) → banner shows "⚠️ File is empty or missing headers. Required columns: zone, occupancy, timestamp."
- [ ] Upload CSV with `occupancy: -5` on row 3 → banner shows "❌ Row 3: occupancy is -5 — must be 0–100."
- [ ] Upload CSV with `occupancy: 101` → rejected with row-specific error
- [ ] Upload a `.txt` file renamed to `.csv` → "❌ Invalid file type."
- [ ] Upload a valid 10-zone CSV → dashboard redraws with new zones within 2 seconds
- [ ] Upload the same CSV twice → identical dashboard state (deterministic)

### AI Alert Generation

- [ ] Set a zone to 85% → alert banner drops down with specific instruction referencing that zone's occupancy
- [ ] Check that instruction differs for a zone at 82% vs 95% (proves AI reasons from data, not template)
- [ ] Remove Gemini API key temporarily → grey fallback banner appears with ref code, app does not crash

### Translation

- [ ] Click "Español" with Formal tone → returns "Por favor..." style instruction
- [ ] Click "Español" with Casual tone → returns "¡Oye!..." style instruction
- [ ] Click 4 language buttons sequentially → 4 different outputs, no mixing

### Real-time

- [ ] Upload CSV in one browser tab → second tab updates within 3 seconds (Firestore `onSnapshot`)

---

## Accessibility Check

Run Lighthouse in Chrome DevTools (Ctrl+Shift+J → Lighthouse tab):

```
Target scores:
  Accessibility: > 90
  Performance: > 80
  Best Practices: > 90
  SEO: > 80
```

Manual checks:
- [ ] Tab through entire app without mouse — all interactive elements reachable
- [ ] Press Enter on a red zone card → alert banner opens
- [ ] Press ESC or click "Resolve" → alert closes
- [ ] Screen reader: each zone card announces "Gate A - North: 85 percent full. High occupancy — alert active. Press Enter to view AI recommendation."

---

## Known Limitations

1. **Firebase listener timeout**: In very rare network conditions, the Firestore listener may drop silently. The `isFromCache` flag detects this and shows a "Reconnecting..." badge. Auto-reconnect triggers within 4s.

2. **Gemini API rate limit**: Free tier is 60 RPM. Simultaneous alerts across all 10 zones in rapid succession could hit this. The Cloud Function returns HTTP 429, and the frontend shows a countdown + exponential backoff.

3. **CSV > 2MB**: Rejected at the frontend before parsing. User must split into smaller files.

4. **Browser offline mode**: Firestore SDK caches the last known state. When connection restores, `onSnapshot` auto-syncs. No data loss.

5. **Translation cache TTL**: Translations are cached for 24 hours. If the source instruction changes, the old translation may appear briefly until the cache entry expires or is overwritten.
