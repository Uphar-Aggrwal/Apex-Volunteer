/**
 * Gemini AI orchestration for alert generation.
 * Structured JSON prompts with few-shot examples.
 * Retry once on malformed JSON, then fall back to safe template.
 * Never crashes. Always returns an object the frontend can display.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ref codes for debugging — logged and returned to frontend
const REF = {
  MALFORMED_RETRY: 'AI-malformed-retry',
  MALFORMED_FALLBACK: 'AI-malformed-fallback',
  TIMEOUT: 'AI-timeout',
  QUOTA: 'AI-quota-429',
  NETWORK: 'AI-network-error',
};

/**
 * Returns a safe fallback alert object when Gemini fails.
 * @param {string} zoneName
 * @param {string} ref
 */
function buildFallback(zoneName, ref) {
  return {
    instruction: `Zone "${zoneName}" has exceeded 80% capacity. Redirect incoming fans to the nearest lower-capacity gate and escalate to the security lead immediately.`,
    reason: 'AI reasoning temporarily unavailable. Standard safety protocol applied.',
    isFallback: true,
    ref,
  };
}

/**
 * Constructs the structured JSON prompt for Gemini alert generation.
 * @param {string} zone
 * @param {number} occupancy
 * @param {Array} nearbyZones
 */
function buildAlertPrompt(zone, occupancy, nearbyZones) {
  const nearbyText = nearbyZones.length
    ? nearbyZones.map((z) => `${z.name}: ${z.load}`).join(', ')
    : 'no adjacent zone data available';

  return `You are a FIFA 2026 crowd safety officer AI. Generate exactly ONE short volunteer instruction.

CURRENT SITUATION:
- Triggered zone: ${zone}
- Current load: ${occupancy}% (threshold: 80%)
- Adjacent zones: ${nearbyText}

FEW-SHOT EXAMPLES:
Input: Gate 1 at 82%, Gate 4 at 55%
Output: {"instruction":"Divert arriving fans from Gate 1 to Gate 4 immediately.","reason":"Gate 4 is only 55% full and has equivalent exit capacity."}

Input: Gate 7 at 91%, Gate 6 at 88%, Gate 8 at 43%
Output: {"instruction":"Stop entry at Gate 7 and Gate 6. Direct all fans to Gate 8.","reason":"Gate 8 is the only adjacent gate below threshold at 43%."}

RULES:
- Output ONLY valid JSON. No markdown, no explanation, no code fences.
- Instruction must be ≤ 25 words and imperative (start with a verb).
- Reason must explain WHY based on the occupancy numbers.

OUTPUT FORMAT (strict):
{"instruction":"<string>","reason":"<string>"}`;
}

/**
 * Attempts to parse a JSON object from Gemini's response text.
 * Strips markdown fences, then tries full parse, then regex extract.
 * @param {string} text
 * @returns {{ success: boolean, data: Object|null }}
 */
function parseResponse(text) {
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return { success: true, data: JSON.parse(stripped) };
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return { success: true, data: JSON.parse(match[0]) };
      } catch { /* fall through */ }
    }
    return { success: false, data: null };
  }
}

/**
 * Generates a crowd management instruction using Gemini 2.5 Flash.
 * Retries once on malformed JSON. Falls back to template on second failure.
 * @param {string} zone - Zone name.
 * @param {number} occupancy - Occupancy percentage.
 * @param {Array} nearbyZones - Array of {name, load} objects.
 * @param {string} apiKey - Gemini API key.
 * @returns {Promise<Object>} Alert object: {instruction, reason, isFallback?, ref?}
 */
async function generateAlert(zone, occupancy, nearbyZones, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const basePrompt = buildAlertPrompt(zone, occupancy, nearbyZones);

  // Attempt 1
  try {
    const result = await Promise.race([
      model.generateContent(basePrompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      ),
    ]);

    const text = result.response.text();
    const parsed = parseResponse(text);

    if (parsed.success && parsed.data?.instruction && parsed.data?.reason) {
      return { ...parsed.data, isFallback: false };
    }

    // Attempt 2 — stricter prompt
    const strictPrompt = `${basePrompt}\n\nCRITICAL: Your previous response was not valid JSON. Return ONLY the JSON object. Nothing else.`;
    const result2 = await Promise.race([
      model.generateContent(strictPrompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      ),
    ]);

    const text2 = result2.response.text();
    const parsed2 = parseResponse(text2);

    if (parsed2.success && parsed2.data?.instruction && parsed2.data?.reason) {
      return { ...parsed2.data, isFallback: false };
    }

    // Both attempts malformed — use fallback
    console.warn(`[${REF.MALFORMED_FALLBACK}] Gemini returned malformed JSON twice for zone: ${zone}`);
    return buildFallback(zone, REF.MALFORMED_FALLBACK);
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      console.warn(`[${REF.TIMEOUT}] Gemini timed out for zone: ${zone}`);
      return buildFallback(zone, REF.TIMEOUT);
    }
    if (err.status === 429) {
      console.warn(`[${REF.QUOTA}] Gemini quota hit for zone: ${zone}`);
      throw { code: 429, ref: REF.QUOTA };
    }
    console.error(`[${REF.NETWORK}] Gemini network error:`, err.message);
    return buildFallback(zone, REF.NETWORK);
  }
}

module.exports = { generateAlert, buildAlertPrompt, parseResponse, buildFallback };
