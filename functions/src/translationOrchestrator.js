/**
 * Translation orchestrator — translates alert instructions via Gemini.
 * Checks Firestore cache first (24h TTL) before calling Gemini.
 * Falls back to English original on failure. Never silently fails.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const LANGUAGE_NAMES = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  hi: 'Hindi',
  en: 'English',
};

/**
 * Builds the Gemini translation prompt with tone adaptation.
 * @param {string} text - The English instruction to translate.
 * @param {string} language - Target language name.
 * @param {'formal'|'casual'} tone
 */
function buildTranslationPrompt(text, language, tone) {
  const toneInstruction =
    tone === 'formal'
      ? 'Use formal language suitable for a public address (PA) system. Use "please", "proceed", "kindly". Imperative, polite, clear.'
      : 'Use casual, friendly language for direct 1-on-1 conversation. Use "hey", "head over", "go ahead". Warm and approachable.';

  return `Translate the following crowd management instruction to ${language}.

TONE REQUIREMENT: ${toneInstruction}

FEW-SHOT EXAMPLES (formal vs casual):
Formal ES: "Por favor, diríjase a la Puerta 4 inmediatamente."
Casual ES: "¡Oye! Ve a la Puerta 4, ¿sí?"
Formal FR: "Veuillez vous diriger vers la Porte 4 immédiatement."
Casual FR: "Hé, dirigez-vous vers la Porte 4 !"

INSTRUCTION TO TRANSLATE:
"${text}"

OUTPUT: Return ONLY the translated text. No JSON, no markdown, no explanation.`;
}

/**
 * Generates a cache key for a translation.
 * @param {string} text
 * @param {string} langCode
 * @param {string} tone
 */
function buildCacheKey(text, langCode, tone) {
  // Simple hash: first 40 chars of text + lang + tone
  const textKey = text.slice(0, 40).replace(/\s+/g, '_').toLowerCase();
  return `${textKey}__${langCode}__${tone}`;
}

/**
 * Translates an instruction to a target language with tone adaptation.
 * Reads from Firestore cache; calls Gemini only on cache miss.
 * Falls back to English on Gemini failure.
 *
 * @param {string} text - English instruction text.
 * @param {string} langCode - Target language code (es, fr, de, hi).
 * @param {'formal'|'casual'} tone
 * @param {string} apiKey - Gemini API key.
 * @returns {Promise<{ translation: string, language: string, tone: string, fromCache: boolean, isFallback?: boolean, warning?: string }>}
 */
async function translateInstruction(text, langCode, tone, apiKey) {
  if (langCode === 'en') {
    return { translation: text, language: 'en', tone, fromCache: false };
  }

  const languageName = LANGUAGE_NAMES[langCode] ?? langCode;
  const cacheKey = buildCacheKey(text, langCode, tone);
  const db = admin.firestore();

  // Check cache
  try {
    const cacheRef = db.collection('translations').doc(cacheKey);
    const cached = await cacheRef.get();

    if (cached.exists) {
      const data = cached.data();
      const age = Date.now() - (data.createdAt?.toMillis() ?? 0);
      if (age < CACHE_TTL_MS) {
        return { translation: data.translation, language: langCode, tone, fromCache: true };
      }
    }
  } catch (cacheErr) {
    console.warn('[translation-cache-miss] Could not read cache:', cacheErr.message);
  }

  // Call Gemini
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = buildTranslationPrompt(text, languageName, tone);

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      ),
    ]);

    const translated = result.response.text().trim();

    // Write to cache
    try {
      const db2 = admin.firestore();
      await db2.collection('translations').doc(cacheKey).set({
        translation: translated,
        language: langCode,
        tone,
        originalText: text.slice(0, 200),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (writeErr) {
      console.warn('[translation-cache-write] Could not write cache:', writeErr.message);
    }

    return { translation: translated, language: langCode, tone, fromCache: false };
  } catch (err) {
    console.error('[translation-gemini-error]', err.message);
    return {
      translation: text,
      language: 'en',
      tone,
      fromCache: false,
      isFallback: true,
      warning: `Translation to ${languageName} temporarily unavailable — showing English original.`,
    };
  }
}

module.exports = { translateInstruction, buildTranslationPrompt, buildCacheKey };
