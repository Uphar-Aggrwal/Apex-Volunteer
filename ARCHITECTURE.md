# Apex Volunteer — System Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          VOLUNTEER BROWSER                                    │
│  ┌────────────────┐   ┌────────────────────┐   ┌──────────────────────────┐ │
│  │  Zone          │   │  Alert Engine       │   │  CSV Uploader            │ │
│  │  Dashboard     │   │  (AI Banner)        │   │  (Drag & Drop)           │ │
│  │  (Live Grid)   │   │  + Translator       │   │                          │ │
│  └───────┬────────┘   └────────┬────────────┘   └──────────┬───────────────┘ │
│          │ onSnapshot()        │ POST /api/*               │ POST /api/*      │
└──────────┼─────────────────────┼───────────────────────────┼─────────────────┘
           │                     │                           │
           ▼                     ▼                           ▼
┌──────────────────┐   ┌──────────────────────────────────────────────────────┐
│  Firestore DB    │   │               NETLIFY SERVERLESS FUNCTIONS            │
│  ─────────────── │   │   (Node.js — deployed automatically via GitHub push)  │
│  /zones/{id}     │   │  ┌────────────────┐  ┌───────────────────────────┐   │
│                  │◄──│  │ /uploadCSV     │  │ /generateAlert            │   │
│  Real-time reads │   │  │  validateRows  │  │  buildPrompt()            │   │
│  via onSnapshot  │   │  │  Firebase Admin│  │  Gemini 2.5 Flash         │   │
│                  │   │  │  bulkWrite     │  │  JSON parse + fallback    │   │
│  (asia-south1)   │   │  └────────────────┘  └───────────────────────────┘   │
│                  │   │  ┌────────────────────────────────────────────────┐   │
│                  │   │  │ /translate                                      │   │
│                  │   │  │  buildTranslationPrompt() — tone-aware         │   │
│                  │   │  │  Gemini 2.5 Flash → natural idiomatic output   │   │
│                  │   │  │  graceful fallback to English original          │   │
│                  │   │  └────────────────────────────────────────────────┘   │
└──────────────────┘   └──────────────────────────────────────────────────────┘
                                            │
                                            ▼
                               ┌─────────────────────┐
                               │   Gemini 2.5 Flash   │
                               │   (Google AI API)    │
                               └─────────────────────┘
```

## Data Flow

1. **CSV Upload**: User drags `.csv` file → PapaParse parses locally → frontend validates every row → POST `/api/uploadCSV` → Netlify Function validates server-side (defence-in-depth) → Firebase Admin SDK bulk-writes to Firestore `/zones`
2. **Real-time Display**: All connected dashboards receive updates via Firestore `onSnapshot()` listeners. No polling.
3. **Alert Trigger**: Frontend detects zone ≥ 80% occupancy → volunteer clicks zone card → POST `/api/generateAlert`
4. **AI Generation**: Netlify Function builds structured JSON prompt with few-shot context → Gemini 2.5 Flash → parse JSON → retry once if malformed → graceful fallback template if retry fails
5. **Translation**: Volunteer selects language + tone → POST `/api/translate` → Netlify Function → tone-aware Gemini prompt → idiomatic translated text → always returns English original as fallback

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + Vite 8 | JSX, hooks, CSS custom properties |
| Hosting | Netlify CDN | Auto-deploys on `git push` |
| **Backend** | **Netlify Serverless Functions** | **Replaced Firebase Cloud Functions — 0 billing required** |
| Database | Firebase Firestore (Spark plan) | Real-time `onSnapshot()`, free tier |
| AI Engine | Gemini 2.5 Flash (`@google/genai` v2) | Structured JSON prompts, temperature 0.2 |
| Auth (backend) | Firebase Admin SDK + Service Account | Used only inside Netlify Functions |

## Why Netlify Functions Instead of Firebase Cloud Functions

Firebase Cloud Functions require the **Blaze (pay-as-you-go) billing plan** to deploy, which requires a credit card and RBI e-mandate authorization in India. This is a significant barrier for open-source/portfolio projects.

Netlify Serverless Functions provide:
- **125,000 free executions/month** — permanently free, no credit card required
- **Automatic deployment** on every `git push` (same as the frontend)
- **Full Node.js environment** — same code, same libraries, same logic
- **Zero configuration** — `netlify.toml` handles all routing automatically

The application's **functionality is 100% identical** — the only change is where the backend code runs.

## Failure Modes & Fallbacks

| Failure | Detection | Response |
|---|---|---|
| Gemini returns malformed JSON | `JSON.parse()` throws | Retry once with stricter prompt → fallback template |
| Gemini 429 quota | HTTP 429 response | Frontend shows countdown, exponential backoff (1s, 2s, 4s) |
| Empty/malformed CSV | Client-side `validateCSV()` | Row-level error message, backend never called |
| Server-side CSV invalid | Server `validateRows()` | HTTP 400 with exact row + field error |
| Gemini translation fails | Any exception | Return English original + `isFallback: true` flag |
| Firestore `onSnapshot()` drops | `metadata.fromCache` flag | "📶 Showing cached data — reconnecting..." badge |
| `FIREBASE_SERVICE_ACCOUNT` missing | Admin SDK init fails | HTTP 503 with clear error message |

## Security Model

- **Gemini API key** is stored as a Netlify environment variable, never in frontend code or git history
- **Firebase Service Account** is stored as a Netlify environment variable, never in git
- **Firestore rules** block all client writes — only the Admin SDK (in Netlify Functions) can write
- **Client reads** are allowed from Firestore for real-time `onSnapshot()` updates
- **CORS headers** on all Netlify Functions restrict to `Content-Type: application/json` POST requests
