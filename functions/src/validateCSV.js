/**
 * CSV row and payload validation for the Cloud Function upload endpoint.
 * Defense-in-depth: validates again on the server even if frontend already validated.
 * Returns HTTP 400 with exact row number and field on any failure.
 */

const REQUIRED_FIELDS = ['zone', 'occupancy', 'timestamp'];

/**
 * Validates a single data row from the uploaded CSV payload.
 * @param {Object} row - The row object.
 * @param {number} rowIndex - 1-based row number for error messages.
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateRow(row, rowIndex) {
  for (const field of REQUIRED_FIELDS) {
    if (row[field] === undefined || row[field] === null || String(row[field]).trim() === '') {
      return {
        valid: false,
        error: `Row ${rowIndex}: missing required field "${field}".`,
      };
    }
  }

  const occupancy = Number(row.occupancy);
  if (isNaN(occupancy)) {
    return {
      valid: false,
      error: `Row ${rowIndex}: "occupancy" must be a number, got "${row.occupancy}".`,
    };
  }

  if (occupancy < 0 || occupancy > 100) {
    return {
      valid: false,
      error: `Row ${rowIndex}: "occupancy" is ${occupancy} — must be 0–100.`,
    };
  }

  const zone = String(row.zone).trim();
  if (!zone) {
    return {
      valid: false,
      error: `Row ${rowIndex}: "zone" must not be empty.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates the full CSV payload sent to the Cloud Function.
 * @param {Array} rows - Array of row objects from the parsed CSV.
 * @returns {{ valid: boolean, error: string | null, count: number }}
 */
function validateCSVPayload(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, error: 'Payload must be a non-empty array of rows.', count: 0 };
  }

  for (let i = 0; i < rows.length; i++) {
    const result = validateRow(rows[i], i + 1);
    if (!result.valid) {
      return { valid: false, error: result.error, count: rows.length };
    }
  }

  return { valid: true, error: null, count: rows.length };
}

module.exports = { validateRow, validateCSVPayload };
