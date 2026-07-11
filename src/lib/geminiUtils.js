/**
 * Gemini response parsing and fallback utilities.
 * These are pure functions that can be unit-tested without any network calls.
 */

/**
 * Attempts to extract and parse a JSON object from a Gemini response string.
 * Gemini sometimes wraps JSON in markdown code blocks — this strips them.
 * @param {string} responseText - Raw text response from Gemini.
 * @returns {{ success: boolean, data: Object | null, rawText: string }}
 */
export function parseGeminiResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return { success: false, data: null, rawText: responseText ?? '' };
  }

  // Strip markdown code fences if present
  const stripped = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const data = JSON.parse(stripped);
    return { success: true, data, rawText: responseText };
  } catch {
    // Try to extract first {...} block if surrounding text exists
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        return { success: true, data, rawText: responseText };
      } catch {
        return { success: false, data: null, rawText: responseText };
      }
    }
    return { success: false, data: null, rawText: responseText };
  }
}

/**
 * Returns the hardcoded fallback alert object when Gemini fails.
 * Always specific, never generic. Logged with a reference for debugging.
 * @param {string} zoneName - The name of the zone that triggered the alert.
 * @param {string} [refCode='AI-fallback'] - Debug reference code.
 * @returns {{ instruction: string, reason: string, isFallback: boolean, ref: string }}
 */
export function getAlertFallback(zoneName, refCode = 'AI-fallback') {
  return {
    instruction: `Zone "${zoneName}" has exceeded 80% capacity. Redirect incoming fans to the nearest lower-capacity gate. Escalate to security lead immediately.`,
    reason: 'AI reasoning temporarily unavailable. This is a standard safety protocol response.',
    isFallback: true,
    ref: refCode,
  };
}

/**
 * Returns the hardcoded fallback translation when Gemini translation fails.
 * Returns the English original with a visible warning flag.
 * @param {string} originalText - The original English instruction.
 * @returns {{ text: string, language: 'en', isFallback: boolean, warning: string }}
 */
export function getTranslationFallback(originalText) {
  return {
    text: originalText,
    language: 'en',
    isFallback: true,
    warning: 'Translation service temporarily unavailable — showing English original.',
  };
}

/**
 * Validates that a Gemini alert response has the required fields.
 * @param {Object} data - Parsed JSON object from Gemini.
 * @returns {boolean} True if both `instruction` and `reason` are non-empty strings.
 */
export function isValidAlertResponse(data) {
  if (!data || typeof data !== 'object') return false;
  return (
    typeof data.instruction === 'string' &&
    data.instruction.trim().length > 0 &&
    typeof data.reason === 'string' &&
    data.reason.trim().length > 0
  );
}

