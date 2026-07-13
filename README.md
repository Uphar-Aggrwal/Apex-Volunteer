# Apex Volunteer — FIFA 2026 Crowd Flow Co-pilot
### *AI-powered, real-time crowd management assistant for stadium volunteers*

> Built for **Prompt Wars Challenge 4**. Ranked — [Apex-Volunteer on GitHub](https://github.com/Uphar-Aggrwal/Apex-Volunteer)

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_BADGE_ID/deploy-status)](https://apex-volunteer.netlify.app)

---

## 🎯 Problem Statement

At a FIFA 2026 stadium, 80,000+ fans flood through 10+ gates simultaneously. Volunteers have no real-time data, no smart AI recommendations, and no way to communicate instructions in a fan's native language. Chaos ensues.

**Apex Volunteer** solves this with a live crowd co-pilot: monitors zone occupancy in real-time, generates AI-reasoned rerouting instructions the moment a zone hits 80% capacity, and translates them into Spanish, French, German, Hindi, Arabic, and Portuguese — with tone-appropriate phrasing (formal for PA systems, casual for 1-on-1 conversations).

---

## ✨ Features

| Feature | Description |
|---|---|
| **Live Zone Dashboard** | 10 stadium zones as color-coded cards (🟢 <60%, 🟡 60–79%, 🔴 ≥80%). Updates in real-time via Firestore `onSnapshot()`. |
| **AI Alert Engine** | When a zone hits ≥80%, Gemini 2.5 Flash generates a specific, reasoned, actionable instruction referencing actual occupancy numbers. |
| **Multilingual Translator** | Translate any alert to ES / FR / DE / HI / AR / PT. Toggle between Formal (PA) and Casual (direct conversation) tone. |
| **CSV Uploader** | Drag-and-drop. Validates every row client-side before upload. Shows exact row-level errors. Proves no hardcoded data. |
| **Graceful Fallbacks** | Gemini fails → safe template. Translation fails → English original + warning badge. Firebase quota → auto-retry. |

---

## 🏗️ Architecture

```
 Browser (React 19 + Vite 8, hosted on Netlify CDN)
    │
    ├─ onSnapshot() ───────────► Firestore /zones   (real-time reads)
    │
    ├─ POST /api/uploadCSV ────► Netlify Function ──► Firebase Admin ──► Firestore
    │
    ├─ POST /api/generateAlert ► Netlify Function ──► Gemini 2.5 Flash
    │
    └─ POST /api/translate ────► Netlify Function ──► Gemini 2.5 Flash
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system diagram and failure modes.

---

## 🛠️ Tech Stack

| Layer | Technology | Free Quota |
|---|---|---|
| Frontend | React 19 + Vite 8 | — |
| Hosting | Netlify | 100 GB bandwidth/month, 300 build minutes |
| Serverless Backend | Netlify Functions (Node.js) | **125,000 requests/month free — no billing needed** |
| Database | Firestore (Google Firebase) | 50,000 reads/day, 20,000 writes/day |
| AI Engine | Gemini 2.5 Flash | 60 RPM free tier |

> 💡 **Zero cloud billing required.** Netlify Functions are completely free for this scale and do not require a credit card.

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- A Firebase project with Firestore enabled (Spark/free plan is fine)

### 1. Clone and install

```bash
git clone https://github.com/Uphar-Aggrwal/Apex-Volunteer.git
cd Apex-Volunteer
npm install
```

### 2. Configure environment

The `.env` file is already pre-configured for the Firebase project. If you are forking for your own use:

```bash
cp .env.example .env
# Fill in your own VITE_FIREBASE_* values from your Firebase project settings
```

### 3. Run locally

```bash
npm run dev
```

The Vite dev server starts at `http://localhost:5173`. API calls to `/api/*` are automatically handled by `netlify.toml` during deployment.

---

## 🧪 Testing

```bash
# Run all unit tests (Frontend + Backend)
npm test

# Run tests with coverage report
npm run test:coverage
```

**Test categories (60 tests across 5 suites):**
- **CSV validation** (13 tests) — valid rows, negative occupancy, missing columns, empty files
- **Gemini utilities** (14 tests) — JSON parsing, fallback objects, prompt injection defense
- **Netlify Backend Functions** (33 tests):
  - `generateAlert` — Prompt construction for Gemini
  - `translate` — Multilingual translation prompting with formal/casual tone support
  - `uploadCSV` — Server-side CSV validation ensuring 100% data integrity before Firestore write

---

## 📁 Project Structure

```
Apex-Volunteer/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx          # Main view: zone grid + alert engine
│   │   ├── ZoneCard.jsx           # Color-coded zone card (accessible)
│   │   ├── AlertBanner.jsx        # AI instruction + translation panel
│   │   └── CSVUploader.jsx        # Drag-drop uploader with validation
│   ├── hooks/
│   │   └── useZoneListener.js     # Firestore real-time listener + backoff
│   ├── firebase/
│   │   └── init.js                # Firebase SDK init (env vars only)
│   └── lib/
│       ├── csvValidator.js        # Pure validation functions (testable)
│       └── geminiUtils.js         # Gemini parse/fallback utilities
│
├── netlify/
│   └── functions/
│       ├── uploadCSV.js           # Bulk-writes CSV rows to Firestore
│       ├── generateAlert.js       # Gemini AI crowd alert generator
│       └── translate.js           # Gemini multilingual translator
│
├── netlify.toml                   # Build config + /api/* → functions routing
├── firestore.rules                # Database security rules
├── ARCHITECTURE.md                # Full system diagram + failure modes
├── DEPLOYMENT.md                  # Step-by-step deployment guide
└── .env                           # Local secrets (git-ignored)
```

---

## 🔑 Environment Variables

### Frontend (Vite — prefix with `VITE_`)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

### Backend (Netlify Functions — set in Netlify UI)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (single-line string) |

> ⚠️ Never commit `.env` to Git. The `.gitignore` already blocks it.

---

## ⚡ Edge Case Handling

| Scenario | Behavior |
|---|---|
| Empty CSV | Frontend shows: "⚠️ File is empty or missing headers." Backend never called. |
| Negative occupancy (Row 3: -5) | "❌ Row 3: occupancy -5 — must be 0–100." Both client and server validate. |
| Gemini malformed JSON | Retry once with stricter prompt → graceful fallback template + `Ref: AI-malformed` |
| Gemini 429 quota | Frontend shows retry countdown, exponential backoff (1s, 2s, 4s) |
| Translation fails | Returns English original + "⚠️ Translation unavailable" badge. Never silent. |
| Firebase read quota | "⚠️ Showing cached data — reconnecting..." with auto-reconnect |
| CSV > 2MB | "❌ File too large (X.X MB). Maximum 2 MB." |

---

## 📄 License

MIT © 2026 Uphar Aggrwal
