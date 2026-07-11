/**
 * Cloud Functions HTTP router — Apex Volunteer backend.
 * Endpoints: POST /uploadCSV, POST /generateAlert, POST /translate
 * All inputs validated. All Gemini calls wrapped in error handling.
 * Structured Cloud Logging on every request.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { validateCSVPayload } = require('./validateCSV');
const { generateAlert } = require('./geminiOrchestrator');
const { translateInstruction } = require('./translationOrchestrator');

admin.initializeApp();

// Read Gemini key from Firebase Functions config (never hardcoded)
const getGeminiKey = () => {
  try {
    return functions.config().gemini.key;
  } catch {
    return process.env.GEMINI_API_KEY ?? null;
  }
};

/** CORS headers — allow Netlify frontend */
function setCORS(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * POST /uploadCSV
 * Validates uploaded zone rows and bulk-writes to Firestore.
 * Returns HTTP 400 with exact row error if validation fails.
 */
exports.uploadCSV = functions
  .region('asia-south1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onRequest(async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }

    const { rows } = req.body ?? {};
    const validation = validateCSVPayload(rows);

    if (!validation.valid) {
      functions.logger.warn('CSV validation failed', { error: validation.error });
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const db = admin.firestore();
      const batch = db.batch();

      rows.forEach((row) => {
        const id = String(row.zone).replace(/\s+/g, '-').toLowerCase();
        const ref = db.collection('zones').doc(id);
        batch.set(ref, {
          zone: String(row.zone).trim(),
          occupancy: Number(row.occupancy),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      functions.logger.info('CSV uploaded', { rowCount: validation.count });
      res.status(200).json({ success: true, rowCount: validation.count });
    } catch (err) {
      if (err.code === 8 || err.message?.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({ error: 'Server busy. Please retry in a moment.', code: 'QUOTA' });
        return;
      }
      functions.logger.error('Firestore write failed', { error: err.message });
      res.status(500).json({ error: 'Failed to save data. Please try again.' });
    }
  });

/**
 * POST /generateAlert
 * Generates an AI crowd management instruction for a zone ≥ 80% capacity.
 * Returns HTTP 429 on Gemini quota hit (frontend handles backoff).
 */
exports.generateAlert = functions
  .region('asia-south1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onRequest(async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }

    const { zone, occupancy, nearbyZones = [] } = req.body ?? {};

    if (!zone || occupancy === undefined) {
      res.status(400).json({ error: 'Request must include "zone" and "occupancy".' });
      return;
    }

    const apiKey = getGeminiKey();
    if (!apiKey) {
      functions.logger.warn('GEMINI_API_KEY not configured — returning fallback');
      res.status(200).json({
        instruction: `Zone "${zone}" is over 80% capacity. Escalate to security lead.`,
        reason: 'AI not configured. Standard protocol applied.',
        isFallback: true,
        ref: 'AI-no-key',
      });
      return;
    }

    try {
      const alert = await generateAlert(zone, Number(occupancy), nearbyZones, apiKey);
      functions.logger.info('Alert generated', { zone, occupancy, isFallback: alert.isFallback });
      res.status(200).json(alert);
    } catch (err) {
      if (err.code === 429) {
        res.status(429).json({ error: 'AI quota reached. Retry shortly.', ref: err.ref });
        return;
      }
      functions.logger.error('Alert generation failed', { error: err.message });
      res.status(500).json({ error: 'Alert generation failed. Please retry.' });
    }
  });

/**
 * POST /translate
 * Translates an instruction to a target language with tone adaptation.
 * Checks Firestore cache first. Falls back to English on failure.
 */
exports.translate = functions
  .region('asia-south1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onRequest(async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }

    const { text, targetLanguage, tone = 'formal' } = req.body ?? {};

    if (!text || !targetLanguage) {
      res.status(400).json({ error: 'Request must include "text" and "targetLanguage".' });
      return;
    }

    const apiKey = getGeminiKey();
    const result = await translateInstruction(text, targetLanguage, tone, apiKey ?? '');
    functions.logger.info('Translation served', {
      language: targetLanguage,
      tone,
      fromCache: result.fromCache,
      isFallback: result.isFallback ?? false,
    });
    res.status(200).json(result);
  });
