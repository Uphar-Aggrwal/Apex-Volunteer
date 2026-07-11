import {
  validateHeaders,
  validateRow,
  validateCSV,
  getOccupancyTier,
  alertThreshold,
  REQUIRED_HEADERS,
} from '../lib/csvValidator';

describe('validateHeaders', () => {
  it('accepts all required headers (case-insensitive)', () => {
    const result = validateHeaders(['Zone', 'Occupancy', 'Timestamp']);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts extra columns beyond required', () => {
    const result = validateHeaders(['zone', 'occupancy', 'timestamp', 'extra_col']);
    expect(result.valid).toBe(true);
  });

  it('rejects when zone column is missing', () => {
    const result = validateHeaders(['occupancy', 'timestamp']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('"zone"');
  });

  it('rejects when occupancy column is missing', () => {
    const result = validateHeaders(['zone', 'timestamp']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('"occupancy"');
  });

  it('rejects completely empty headers array', () => {
    const result = validateHeaders([]);
    expect(result.valid).toBe(false);
  });

  it('REQUIRED_HEADERS contains exactly zone, occupancy, timestamp', () => {
    expect(REQUIRED_HEADERS).toEqual(['zone', 'occupancy', 'timestamp']);
  });
});

describe('validateRow', () => {
  it('accepts a valid row', () => {
    const result = validateRow({ zone: 'Gate 1', occupancy: '75', timestamp: '2026-01-01' }, 1);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts occupancy of 0 (edge: minimum valid)', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '0', timestamp: 't' }, 1);
    expect(result.valid).toBe(true);
  });

  it('accepts occupancy of 100 (edge: maximum valid)', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '100', timestamp: 't' }, 1);
    expect(result.valid).toBe(true);
  });

  it('rejects occupancy of -5 and includes row number', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '-5', timestamp: 't' }, 3);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 3');
    expect(result.error).toContain('-5');
  });

  it('rejects occupancy of 101', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '101', timestamp: 't' }, 4);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 4');
    expect(result.error).toContain('101');
  });

  it('rejects non-numeric occupancy', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: 'abc', timestamp: 't' }, 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('"occupancy" must be a number');
  });

  it('rejects empty zone name', () => {
    const result = validateRow({ zone: '', occupancy: '50', timestamp: 't' }, 5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 5');
    expect(result.error).toContain('"zone" is empty');
  });

  it('rejects missing occupancy field', () => {
    const result = validateRow({ zone: 'Gate B', occupancy: '', timestamp: 't' }, 6);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 6');
  });
});

describe('validateCSV', () => {
  const validParsed = {
    data: [
      { zone: 'Gate 1', occupancy: '75', timestamp: '2026-01-01T10:00:00Z' },
      { zone: 'Gate 2', occupancy: '45', timestamp: '2026-01-01T10:00:00Z' },
    ],
    meta: { fields: ['zone', 'occupancy', 'timestamp'] },
  };

  it('accepts a valid parsed CSV', () => {
    const result = validateCSV(validParsed);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(2);
  });

  it('rejects null input', () => {
    const result = validateCSV(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects empty data array', () => {
    const result = validateCSV({ data: [], meta: { fields: [] } });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Required columns');
  });

  it('rejects when zone column is missing from headers', () => {
    const parsed = {
      data: [{ occupancy: '50', timestamp: 't' }],
      meta: { fields: ['occupancy', 'timestamp'] },
    };
    const result = validateCSV(parsed);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('"zone"');
  });

  it('rejects first invalid row and reports correct row number', () => {
    const parsed = {
      data: [
        { zone: 'Gate 1', occupancy: '50', timestamp: 't' },
        { zone: 'Gate 2', occupancy: '150', timestamp: 't' }, // invalid
      ],
      meta: { fields: ['zone', 'occupancy', 'timestamp'] },
    };
    const result = validateCSV(parsed);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 2');
    expect(result.error).toContain('150');
  });
});

describe('getOccupancyTier', () => {
  it('returns green for occupancy < 60', () => {
    expect(getOccupancyTier(0)).toBe('green');
    expect(getOccupancyTier(59)).toBe('green');
  });

  it('returns yellow for 60 ≤ occupancy < 80', () => {
    expect(getOccupancyTier(60)).toBe('yellow');
    expect(getOccupancyTier(79)).toBe('yellow');
  });

  it('returns red for occupancy ≥ 80', () => {
    expect(getOccupancyTier(80)).toBe('red');
    expect(getOccupancyTier(100)).toBe('red');
  });
});

describe('alertThreshold', () => {
  it('returns false for occupancy of 79 (below threshold)', () => {
    expect(alertThreshold(79)).toBe(false);
  });

  it('returns true for occupancy of 80 (at threshold)', () => {
    expect(alertThreshold(80)).toBe(true);
  });

  it('returns true for occupancy of 100', () => {
    expect(alertThreshold(100)).toBe(true);
  });

  it('returns false for occupancy of 0', () => {
    expect(alertThreshold(0)).toBe(false);
  });
});
