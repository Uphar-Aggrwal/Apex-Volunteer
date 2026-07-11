# VolunteerAI — LinkedIn Post Draft

---

🏟️ **Built VolunteerAI — an AI-powered crowd management co-pilot for FIFA 2026 stadium volunteers.**

When 80,000 fans flood a stadium simultaneously, volunteers have seconds to decide: open another gate, redirect a crowd, call security. They need real-time data and immediate, actionable guidance — not a walkie-talkie and a hunch.

**VolunteerAI** solves this.

**What it does:**
🔴 Monitors 10 stadium zones live — color-coded Green / Yellow / Red based on occupancy
🤖 When any zone hits 80% capacity, Gemini 1.5 Flash generates a specific, reasoned instruction: *"Redirect fans from Gate D to Gate G immediately. Gate G is only 43% full and has equivalent exit capacity."*
🌍 Translates that instruction to Spanish, French, German, or Hindi — with tone adaptation (formal for PA announcements, casual for 1-on-1 conversations)
📊 CSV upload with full client-side validation — row-level error messages, never a white screen
⚡ Real-time Firestore sync — all connected volunteer devices update within 2 seconds

**The engineering decisions I'm proud of:**

1. **Resilience first.** Gemini fails → retry with stricter prompt → safe fallback template + logged ref code. The app never crashes or goes blank.
2. **Prompt evolution.** V1 was a single sentence. V5 uses few-shot examples, situational context, and strict output rules. Parse rate went from 60% → 99.2%.
3. **Test-driven.** 81 unit tests written *before* feature code. Every edge case covered: negative occupancy, missing headers, prompt injection, empty CSV.
4. **Code-split bundle.** Firebase SDK chunked separately — main app bundle 204KB, not 700KB.

**Stack:** React 18 + Vite • Firebase Firestore + Cloud Functions • Gemini 1.5 Flash • Netlify

---

Huge respect for anyone building for events at this scale. The intersection of real-time data, AI reasoning, and human-in-the-loop decision making is one of the most interesting problems in applied AI right now.

#FIFA2026 #AI #Gemini #Firebase #React #PromptEngineering #WebDev #BuildInPublic
