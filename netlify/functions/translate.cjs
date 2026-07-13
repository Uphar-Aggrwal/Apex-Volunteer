/**
 * Netlify Serverless Function — translate
 * POST /api/translate
 *
 * Translates a crowd management instruction to a target language
 * with tone-appropriate phrasing (formal for PA systems, casual for 1-on-1).
 *
 * Falls back to returning the original English text if translation fails,
 * so the UI never shows a broken or empty message to the volunteer.
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

const LANGUAGE_MAP = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  hi: 'Hindi',
  ar: 'Arabic',
  pt: 'Portuguese',
};

// ── Prompt builder ─────────────────────────────────────────────────────────────
function buildTranslationPrompt(text, targetLanguage, tone) {
  const langName = LANGUAGE_MAP[targetLanguage] || targetLanguage;
  const toneDescription = tone === 'formal'
    ? 'formal and professional, suitable for a public address system announcement'
    : 'casual and friendly, suitable for a direct one-on-one conversation with a fan';

  return `You are a multilingual FIFA 2026 stadium communications assistant. Translate the following crowd management instruction accurately.

SOURCE INSTRUCTION (English): "${text}"
TARGET LANGUAGE: ${langName}
TONE: ${toneDescription}

REQUIREMENTS:
1. The translation must be natural and idiomatic, not word-for-word.
2. Maintain the urgency and clarity of the original instruction.
3. Keep the tone as specified (${tone}).

RESPOND STRICTLY IN THIS JSON FORMAT (no extra text, no markdown):
{"translatedText": "..."}`;
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

  const { text, targetLanguage, tone = 'formal' } = body;
  if (!text || !targetLanguage) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Request must include "text" and "targetLanguage".' }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[translate] GEMINI_API_KEY not set — returning original text');
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ translatedText: text, fromCache: false, isFallback: true }),
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildTranslationPrompt(text, targetLanguage, tone);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 256,
      },
    });

    const respText = response.text;
    if (!respText || !respText.trim()) throw new Error('Empty response from Gemini');

    const json = JSON.parse(respText.trim());
    if (!json.translatedText) throw new Error('Gemini response missing translatedText');

    console.log(`[translate] Success — lang: ${targetLanguage}, tone: ${tone}`);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ translatedText: json.translatedText, fromCache: false, isFallback: false }),
    };
  } catch (err) {
    console.error('[translate] Error:', err.message);
    // Graceful fallback — always return the original English so the UI never breaks
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        translatedText: text,
        fromCache: false,
        isFallback: true,
        warning: 'Translation unavailable — showing original English.',
      }),
    };
  }
};

// ── Exports for Testing ───────────────────────────────────────────────────────
exports._buildTranslationPrompt = buildTranslationPrompt;
