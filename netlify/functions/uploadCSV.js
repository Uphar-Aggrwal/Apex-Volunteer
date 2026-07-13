/**
 * Netlify Serverless Function — uploadCSV
 * POST /api/uploadCSV
 *
 * Receives validated CSV rows from the React frontend,
 * authenticates with Firestore via a Firebase Admin service account,
 * and bulk-writes zone data in a single batch commit.
 *
 * Environment variables required (set in Netlify UI → Site Settings → Env Vars):
 *   FIREBASE_SERVICE_ACCOUNT  — Full JSON of the Firebase service account key (single line)
 */

const admin = require('firebase-admin');

// ── Firebase Admin init (singleton pattern) ─────────────────────────────────
if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('[uploadCSV] FIREBASE_SERVICE_ACCOUNT env var is missing.');
  } else {
    try {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    } catch (e) {
      console.error('[uploadCSV] Firebase Admin init failed:', e.message);
    }
  }
}

// ── Server-side CSV validation (mirrors frontend, defence-in-depth) ──────────
function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, error: 'Payload must be a non-empty array of rows.' };
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.zone || typeof row.zone !== 'string' || !row.zone.trim()) {
      return { valid: false, error: `Row ${i + 1} is missing a valid "zone" string.` };
    }
    const occ = Number(row.occupancy);
    if (isNaN(occ) || occ < 0 || occ > 100) {
      return { valid: false, error: `Row ${i + 1}: occupancy "${row.occupancy}" must be 0–100.` };
    }
  }
  return { valid: true, count: rows.length };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Handler ──────────────────────────────────────────────────────────────────
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

  const validation = validateRows(body.rows);
  if (!validation.valid) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: validation.error }) };
  }

  if (!admin.apps.length) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'Firebase not initialised. Check FIREBASE_SERVICE_ACCOUNT env var.' }) };
  }

  try {
    const db = admin.firestore();
    const batch = db.batch();

    body.rows.forEach((row) => {
      const id = String(row.zone).replace(/\s+/g, '-').toLowerCase();
      batch.set(db.collection('zones').doc(id), {
        zone:      String(row.zone).trim(),
        occupancy: Number(row.occupancy),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`[uploadCSV] Committed ${validation.count} zone rows.`);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, rowCount: validation.count }) };
  } catch (err) {
    console.error('[uploadCSV] Firestore write failed:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to save data. Please try again.' }) };
  }
};

// ── Exports for Testing ───────────────────────────────────────────────────────
exports._validateRows = validateRows;
