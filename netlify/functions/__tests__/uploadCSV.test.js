
const { _validateRows } = require('../uploadCSV');

describe('uploadCSV Netlify Function', () => {
  describe('validateRows', () => {
    it('returns valid for well-formed array of rows', () => {
      const rows = [{ zone: 'Gate 1', occupancy: 50 }, { zone: 'Gate 2', occupancy: '80' }];
      const result = _validateRows(rows);
      expect(result.valid).toBe(true);
      expect(result.count).toBe(2);
    });

    it('rejects empty arrays', () => {
      const result = _validateRows([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty array');
    });

    it('rejects non-array payloads', () => {
      const result = _validateRows(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty array');
    });

    it('rejects rows missing a zone', () => {
      const rows = [{ occupancy: 50 }];
      const result = _validateRows(rows);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing a valid "zone"');
    });

    it('rejects rows with invalid occupancy', () => {
      const rows = [{ zone: 'Gate 1', occupancy: 'abc' }];
      const result = _validateRows(rows);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be 0–100');
    });

    it('rejects rows with out of bounds occupancy', () => {
      const rows = [{ zone: 'Gate 1', occupancy: 105 }];
      const result = _validateRows(rows);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be 0–100');
    });
  });
});
