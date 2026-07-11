# VolunteerAI — FIFA 2026 Crowd Flow Co-pilot [PromptWars - Challenge 4]

> AI-powered real-time crowd management assistant for stadium volunteers. Built for Prompt Wars Challenge 4.

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_BADGE_ID/deploy-status)](https://volunteerai.netlify.app)

---

## 🎯 Problem Statement

At a FIFA 2026 stadium, 80,000+ fans flood through 10+ gates simultaneously. Volunteers on the ground have no real-time data, no smart recommendations, and no way to communicate instructions in a fan's native language. Chaos ensues.

**VolunteerAI** solves this with a live crowd co-pilot: monitors zone occupancy in real-time, generates AI-reasoned rerouting instructions the moment a zone hits 80% capacity, and translates them into Spanish, French, German, or Hindi with tone-appropriate phrasing (formal for PA systems, casual for 1-on-1).

---

## ✨ Features

| Feature | Description |
|---|---|
| **Live Zone Dashboard** | 10 stadium zones as color-coded cards (Green <60%, Yellow 60–79%, Red ≥80%). Updates every 5s via Firestore `onSnapshot()`. |
| **AI Alert Engine** | When a zone hits ≥80%, Gemini 1.5 Flash generates a specific, reasoned instruction referencing actual occupancy numbers. |
| **Multilingual Translator** | Translate any alert to ES/FR/DE/HI. Toggle between Formal (PA) and Casual (direct conversation) tone. |
| **CSV Uploader** | Drag-and-drop. Validates every row client-side before upload. Shows exact row-level errors. Proves no hardcoded data. |
| **Graceful Fallbacks** | Gemini fails → safe template. Translation fails → English original + warning badge. Firebase quota → retry with backoff. |

---

## 🏗️ Architecture

```
Browser (React + Vite, Netlify CDN)
   │
   ├─ onSnapshot() ──────────► Firestore /zones (asia-south1)
   │
   ├─ POST /generateAlert ───► Cloud Function ──► Gemini 1.5 Flash
   │
   ├─ POST /translate ───────► Cloud Function ──► Gemini 1.5 Flash
   │                                          (cache in /translations)
   └─ POST /uploadCSV ───────► Cloud Function ──► Firestore bulk write
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system diagram and failure modes.

---

## 🛠️ Tech Stack

| Layer | Technology | Free Quota |
|---|---|---|
| Frontend | React 18 + Vite | Netlify: 100 GB bandwidth/month |
| Hosting | Netlify | 300 build minutes/month |
| Database | Firestore (asia-south1) | 50k reads/day, 20k writes/day |
| Backend | Firebase Cloud Functions (Node 18) | 2M invocations/month |
| AI Engine | Gemini 1.5 Flash | 60 RPM free |
| Maps | Google Maps JS API | 28k map loads/month |

---

## 🚀 Setup

### Prerequisites
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with Firestore + Cloud Functions enabled

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/volunteer-ai.git
cd volunteer-ai
npm install
cd functions && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all VITE_* values from your Firebase project settings
```

### 3. Set Gemini API key (Cloud Functions only — never on frontend)

```bash
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
```

### 4. Run locally

```bash
npm run dev
```

### 5. Deploy

```bash
# Deploy Cloud Functions
npm run deploy:func

# Deploy frontend (push to GitHub → Netlify auto-deploys)
git push origin main
```

---

## 🧪 Testing

```bash
# Frontend unit tests
npm test

# Frontend with coverage report (target: >85%)
npm run test:coverage

# Cloud Function unit tests
cd functions && npm test

# Cloud Function with coverage
cd functions && npm run test:coverage
```

**Test categories:**
- CSV validation (13 tests) — valid rows, negative occupancy, missing columns, empty files
- Gemini utilities (14 tests) — JSON parsing, fallback objects, prompt injection
- Cloud Function CSV validator (13 tests) — server-side defense-in-depth
- Gemini orchestrator (13 tests) — retry logic, malformed JSON, timeout handling
- Translation orchestrator (9 tests) — prompt building, cache key generation

---

## 📁 Project Structure

```
volunteer-ai/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx        # Main view: zone grid + alert engine
│   │   ├── ZoneCard.jsx         # Color-coded zone card (accessible)
│   │   ├── AlertBanner.jsx      # AI instruction + translation panel
│   │   └── CSVUploader.jsx      # Drag-drop uploader with validation
│   ├── hooks/
│   │   └── useZoneListener.js   # Firestore real-time listener + backoff
│   ├── firebase/
│   │   └── init.js              # Firebase SDK init (env vars only)
│   ├── lib/
│   │   ├── csvValidator.js      # Pure validation functions (testable)
│   │   └── geminiUtils.js       # Gemini parse/fallback utilities
│   └── __tests__/               # Frontend unit tests
├── functions/
│   ├── src/
│   │   ├── index.js             # Cloud Function HTTP router
│   │   ├── validateCSV.js       # Server-side CSV validation
│   │   ├── geminiOrchestrator.js # Gemini alert generation + retry
│   │   ├── translationOrchestrator.js # Translation + Firestore cache
│   │   └── __tests__/           # Cloud Function unit tests
│   └── package.json
├── ARCHITECTURE.md
├── firestore.rules              # Security rules
├── firebase.json
├── netlify.toml
└── .env.example
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase project API key |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase auth domain |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase app ID |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase sender ID |
| `VITE_FUNCTIONS_BASE_URL` | ✅ | Cloud Functions base URL |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | Google Maps (zone visualization) |
| `GEMINI_API_KEY` | Cloud Functions only | Set via `firebase functions:config:set` |

> ⚠️ Never commit `.env` or add `GEMINI_API_KEY` to frontend environment variables.

---

## ⚡ Edge Case Handling

| Scenario | Behavior |
|---|---|
| Empty CSV | Frontend shows: "⚠️ File is empty or missing headers." Cloud Function never called. |
| Negative occupancy (Row 3: -5) | "❌ Row 3: occupancy is -5 — must be 0–100." |
| Gemini malformed JSON | Retry once with stricter prompt → fallback template + `Ref: AI-malformed` |
| Gemini 429 quota | Frontend shows countdown, exponential backoff (1s, 2s, 4s) |
| Translation fails | Returns English original + "⚠️ Translation unavailable" badge |
| Firebase quota hit | "Server busy. Retrying in Xs..." with auto-retry |
| CSV > 2MB | "❌ File too large (X.X MB). Maximum 2 MB." |

---

## 📄 License

MIT
