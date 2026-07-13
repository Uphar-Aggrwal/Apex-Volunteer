/**
 * Netlify Serverless Function — uploadCSV
 * POST /api/uploadCSV
 *
 * Receives validated CSV rows from the React frontend and bulk-writes
 * zone data to Firestore using the REST API + a service account JWT.
 * Uses ONLY built-in Node.js modules (crypto, fetch) — no firebase-admin.
 *
 * Environment variables required (set in Netlify UI → Site Settings → Env Vars):
 *   FIREBASE_PROJECT_ID    — Your Firebase project ID
 *   FIREBASE_CLIENT_EMAIL  — Service account client email
 *   FIREBASE_PRIVATE_KEY   — Service account private key (with literal \n)
 */

const { createSign } = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── JWT / OAuth helpers ───────────────────────────────────────────────────────
function b64url(str) {
  return Buffer.from(str).toString('base64url');
}

async function getAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }));

  const toSign = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(toSign);
  const sig = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${toSign}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Firestore REST write ──────────────────────────────────────────────────────
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string')      fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  }
  // 'timestamp' must match the orderBy('timestamp') in useZoneListener.js
  fields.timestamp = { stringValue: new Date().toISOString() };
  return fields;
}

async function firestorePatch(projectId, collection, docId, data, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore PATCH ${docId} failed: ${err}`);
  }
}

// ── Server-side CSV validation (mirrors frontend — defence in depth) ──────────
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

  const validation = validateRows(body.rows);
  if (!validation.valid) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: validation.error }) };
  }

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('[uploadCSV] Missing Firebase env vars.');
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'Server not configured. Check Firebase env vars.' }) };
  }

  try {
    const token = await getAccessToken(clientEmail, privateKey);

    await Promise.all(
      body.rows.map((row) => {
        const docId = String(row.zone).replace(/\s+/g, '-').toLowerCase();
        return firestorePatch(projectId, 'zones', docId, {
          zone:      String(row.zone).trim(),
          occupancy: Number(row.occupancy),
        }, token);
      })
    );

    console.log(`[uploadCSV] Committed ${validation.count} zone rows via REST API.`);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, rowCount: validation.count }) };
  } catch (err) {
    console.error('[uploadCSV] Error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to save data. Please try again.' }) };
  }
};

// ── Exports for Testing ───────────────────────────────────────────────────────
exports._validateRows = validateRows;
