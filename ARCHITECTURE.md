# VolunteerAI — System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VOLUNTEER BROWSER                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Zone        │  │  Alert Engine    │  │  Chat Assistant      │  │
│  │  Dashboard   │  │  (AI Banner)     │  │  (RAG Sidebar)       │  │
│  │  (Live Map)  │  │  + Translate     │  │                      │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│         │ onSnapshot()      │ fetch()                │ fetch()      │
└─────────┼───────────────────┼────────────────────────┼─────────────┘
          │                   │                         │
          ▼                   ▼                         ▼
┌─────────────────┐  ┌──────────────────────────────────────────────┐
│   Firestore     │  │         Firebase Cloud Functions              │
│  ─────────────  │  │  ┌──────────────┐  ┌─────────────────────┐  │
│  /zones/{id}    │  │  │ /uploadCSV   │  │ /generateAlert      │  │
│  /alerts/{id}   │  │  │  validateCSV │  │  geminiOrchestrator │  │
│  /translations/ │  │  │  bulkWrite   │  │  JSON parse+fallback│  │
│                 │  │  └──────────────┘  └─────────────────────┘  │
│  (asia-south1)  │  │  ┌──────────────┐                            │
│                 │  │  │ /translate   │                            │
└─────────────────┘  │  │  translation │                            │
                     │  │  Orch+cache  │                            │
                     │  └──────────────┘                            │
                     └──────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  Gemini 2.5 Flash │
                              │  (Google AI API)  │
                              └──────────────────┘
```

## Data Flow

1. **Simulation**: Client timer writes random occupancy to Firestore `/zones` every 5s
2. **CSV Upload**: User uploads `.csv` → PapaParse → frontend validates → Cloud Function validates → bulk-writes to Firestore
3. **Alert Trigger**: Frontend detects zone ≥ 80% → calls `/generateAlert` Cloud Function
4. **AI Generation**: Cloud Function builds JSON prompt + few-shot → Gemini → parse → fallback if malformed → write to `/alerts`
5. **Translation**: Volunteer clicks language → `/translate` Cloud Function → Gemini → cache in `/translations` → return to UI
6. **Real-time Sync**: All connected dashboards receive updates via `onSnapshot()` listeners

## Tech Stack

- **Frontend**: React 18 (Vite), hosted on Netlify CDN
- **Database**: Firestore Native Mode, region `asia-south1`, `onSnapshot()` for real-time delta updates
- **Backend**: Firebase Cloud Functions (Node.js 18), 3 HTTP endpoints
- **AI Engine**: Gemini 2.5 Flash — structured JSON prompts with few-shot examples
- **Maps**: Google Maps JavaScript API — zone polygon overlays with color-coded heatmap
- **CI/CD**: GitHub Actions → Netlify (frontend) + Firebase CLI (functions)

## Failure Modes & Fallbacks

1. **Gemini returns malformed JSON** → retry with stricter prompt → fallback template: `"Zone X is over 80%. Escalate manually."` + warning ref logged
2. **Gemini 429 quota hit** → Cloud Function returns HTTP 429 → frontend shows countdown + exponential backoff retry (1s, 2s, 4s)
3. **Empty/malformed CSV** → frontend validates before upload, Cloud Function validates before Firestore write → specific row-level error shown, never crashes
4. **Firestore listener drops** → detect via `snapshot.metadata.fromCache` → show "Reconnecting..." badge → auto-reconnect with backoff
5. **Gemini translation fails** → retry once → return English original + visible warning badge (never silent failure)
