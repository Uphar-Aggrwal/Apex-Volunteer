/**
 * Netlify Serverless Function — generateAlert
 * POST /api/generateAlert
 *
 * Receives a zone name + occupancy from the React frontend.
 * Uses Gemini 2.5 Flash to generate a structured JSON crowd management
 * instruction that is reasoned, specific, and actionable.
 *
 * Falls back gracefully if Gemini is unavailable or returns malformed JSON.
 *
 * Environment variables required (set in Netlify UI → Site Settings → Env Vars):
 *   GEMINI_API_KEY  — Google AI Studio API key
 */

const { GoogleGenAI } = require('@google/genai');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(zone, occupancy, nearbyZones) {
  const nearby = nearbyZones.length
    ? nearbyZones.map((z) => `${z.name} at ${z.load}`).join(', ')
    : 'no nearby zone data available';

  return `You are "Apex-1", the central AI Crowd Control Coordinator for FIFA 2026. 
Your job is to give ultra-precise, authoritative, real-time tactical directives to ground volunteers.

CONTEXT:
- Zone: "${zone}"
- Current occupancy: ${occupancy}%
- Nearby zones: ${nearby}

TASK: Generate a critical intervention directive for the volunteer stationed at ${zone}.

RULES:
1. "instruction" must be 1 authoritative sentence commanding the volunteer what physical action to take (e.g., "Deploy barricades at East corridor and reroute pedestrian flow to Gate 4."). Reference the exact occupancy level.
2. "reason" must be 1 sentence explaining the crowd dynamics/safety protocol basis.
3. Suggest a specific nearby zone to redirect fans to if available.
4. Use professional security/operations terminology (e.g., "bottleneck", "load balancing", "pedestrian flow").
5. Do NOT use soft language like "please" or "kindly".

RESPOND STRICTLY IN THIS JSON FORMAT (no extra text, no markdown):
{"instruction": "...", "reason": "..."}`;
}

// ── Gemini call with one retry ────────────────────────────────────────────────
async function callGemini(prompt, apiKey) {
  const ai = new GoogleGenAI({ apiKey });

  const attempt = async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 256,
      },
    });
    const text = response.text;
    if (!text || !text.trim()) throw new Error('Empty response from Gemini');
    return JSON.parse(text.trim());
  };

  try {
    return await attempt();
  } catch (firstErr) {
    // Retry once with a stricter prompt
    console.warn('[generateAlert] First attempt failed, retrying:', firstErr.message);
    const strictPrompt = prompt + '\n\nIMPORTANT: Respond with ONLY valid JSON. No extra text.';
    return await attempt.call({ prompt: strictPrompt });
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { zone, occupancy, nearbyZones = [] } = body;
  if (!zone || occupancy === undefined) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Request must include "zone" and "occupancy".' }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[generateAlert] GEMINI_API_KEY not set — returning fallback');
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        instruction: `Zone "${zone}" is at ${occupancy}% capacity. Immediately redirect incoming fans to the nearest lower-occupancy gate.`,
        reason: 'Standard safety protocol applied — AI not configured in this environment.',
        isFallback: true,
        ref: 'AI-no-key',
      }),
    };
  }

  try {
    const prompt = buildPrompt(zone, Number(occupancy), nearbyZones);
    const result = await callGemini(prompt, apiKey);

    if (!result.instruction || !result.reason) {
      throw new Error('Gemini response missing required fields');
    }

    console.log(`[generateAlert] Success — zone: ${zone}, occupancy: ${occupancy}%`);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ instruction: result.instruction, reason: result.reason, isFallback: false }),
    };
  } catch (err) {
    console.error('[generateAlert] Error:', err.message);

    // Gemini quota hit
    if (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'))) {
      return {
        statusCode: 429,
        headers: CORS,
        body: JSON.stringify({ error: 'AI quota reached. Please retry in a moment.', ref: 'AI-quota-429' }),
      };
    }

    // Graceful fallback for all other errors
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        instruction: `Zone "${zone}" is at ${occupancy}% capacity. Redirect fans via the nearest available gate immediately.`,
        reason: 'AI response was unavailable. Standard crowd management protocol applied.',
        isFallback: true,
        ref: 'AI-error',
      }),
    };
  }
};

// ── Exports for Testing ───────────────────────────────────────────────────────
exports._buildPrompt = buildPrompt;
exports._callGemini = callGemini;
