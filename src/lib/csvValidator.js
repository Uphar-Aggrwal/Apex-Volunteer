/**
 * CSV validation utilities for Apex Volunteer.
 * All validation happens on the frontend before any network call is made.
 * Errors are row-specific and actionable, never generic.
 */

/** Required CSV column headers */
export const REQUIRED_HEADERS = ['zone', 'occupancy', 'timestamp'];

/** Maximum file size: 2MB */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Validates that all required headers are present in the parsed CSV.
 * @param {string[]} headers - Array of header strings from PapaParse result.
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateHeaders(headers) {
  const normalised = headers.map((h) => h.trim().toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!normalised.includes(required)) {
      return {
        valid: false,
        error: `Missing required column: "${required}". Required columns: ${REQUIRED_HEADERS.join(', ')}.`,
      };
    }
  }
  return { valid: true, error: null };
}

/**
 * Validates a single CSV data row.
 * @param {Object} row - Parsed row object from PapaParse.
 * @param {number} rowIndex - 1-based row number for error messages.
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateRow(row, rowIndex) {
  const zone = String(row.zone || '').trim();
  if (!zone) {
    return {
      valid: false,
      error: `Row ${rowIndex}: "zone" is empty. Each row must have a zone name.`,
    };
  }

  const rawOccupancy = row.occupancy;
  const occupancy = Number(rawOccupancy);

  if (rawOccupancy === '' || rawOccupancy === null || rawOccupancy === undefined) {
    return {
      valid: false,
      error: `Row ${rowIndex}: "occupancy" is missing.`,
    };
  }

  if (isNaN(occupancy)) {
    return {
      valid: false,
      error: `Row ${rowIndex}: "occupancy" must be a number, got "${rawOccupancy}".`,
    };
  }

  if (occupancy < 0 || occupancy > 100) {
    return {
      valid: false,
      error: `Row ${rowIndex}: "occupancy" is ${occupancy} — must be between 0 and 100.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates an entire parsed CSV dataset (headers + all rows).
 * Stops at first error to give the user actionable feedback immediately.
 * @param {{ data: Object[], meta: { fields: string[] } }} parsed - PapaParse result.
 * @returns {{ valid: boolean, error: string | null, rowCount: number }}
 */
export function validateCSV(parsed) {
  if (!parsed || !parsed.data || parsed.data.length === 0) {
    return {
      valid: false,
      error: '⚠️ File is empty or missing headers. Required columns: zone, occupancy, timestamp.',
      rowCount: 0,
    };
  }

  const headers = parsed.meta?.fields ?? [];
  const headerResult = validateHeaders(headers);
  if (!headerResult.valid) {
    return { valid: false, error: `⚠️ ${headerResult.error}`, rowCount: 0 };
  }

  // Filter out completely empty rows (PapaParse artefacts)
  const dataRows = parsed.data.filter(
    (row) => Object.values(row).some((v) => String(v).trim() !== '')
  );

  if (dataRows.length === 0) {
    return {
      valid: false,
      error: '⚠️ File has headers but no data rows.',
      rowCount: 0,
    };
  }

  for (let i = 0; i < dataRows.length; i++) {
    const result = validateRow(dataRows[i], i + 1);
    if (!result.valid) {
      return { valid: false, error: `❌ ${result.error}`, rowCount: dataRows.length };
    }
  }

  return { valid: true, error: null, rowCount: dataRows.length };
}

/**
 * Determines the alert threshold for a given occupancy.
 * @param {number} occupancy - Occupancy percentage (0–100).
 * @returns {'green' | 'yellow' | 'red'} Color tier for UI display.
 */
export function getOccupancyTier(occupancy) {
  if (occupancy < 60) return 'green';
  if (occupancy < 80) return 'yellow';
  return 'red';
}

/**
 * Checks if a zone's occupancy meets the alert threshold.
 * @param {number} occupancy - Occupancy percentage (0–100).
 * @returns {boolean} True if occupancy is ≥ 80 (alert should trigger).
 */
export function alertThreshold(occupancy) {
  return occupancy >= 80;
}
