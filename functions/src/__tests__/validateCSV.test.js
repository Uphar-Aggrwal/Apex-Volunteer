const { validateRow, validateCSVPayload } = require('../validateCSV');

describe('validateRow', () => {
  it('accepts a valid row', () => {
    const result = validateRow({ zone: 'Gate 1', occupancy: '75', timestamp: '2026-01-01' }, 1);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('rejects negative occupancy with exact row number', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '-5', timestamp: 't' }, 3);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 3');
    expect(result.error).toContain('-5');
  });

  it('rejects occupancy > 100', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '150', timestamp: 't' }, 4);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('150');
  });

  it('rejects non-numeric occupancy', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: 'bad', timestamp: 't' }, 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a number');
  });

  it('rejects empty zone', () => {
    const result = validateRow({ zone: '  ', occupancy: '50', timestamp: 't' }, 5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 5');
  });

  it('rejects missing timestamp field', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '50' }, 6);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('"timestamp"');
  });

  it('accepts boundary value 0', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '0', timestamp: 't' }, 1);
    expect(result.valid).toBe(true);
  });

  it('accepts boundary value 100', () => {
    const result = validateRow({ zone: 'Gate A', occupancy: '100', timestamp: 't' }, 1);
    expect(result.valid).toBe(true);
  });
});

describe('validateCSVPayload', () => {
  it('accepts a valid payload', () => {
    const rows = [
      { zone: 'Gate 1', occupancy: '75', timestamp: '2026-01-01' },
      { zone: 'Gate 2', occupancy: '30', timestamp: '2026-01-01' },
    ];
    const result = validateCSVPayload(rows);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(2);
  });

  it('rejects null input', () => {
    const result = validateCSVPayload(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-empty array');
  });

  it('rejects empty array', () => {
    const result = validateCSVPayload([]);
    expect(result.valid).toBe(false);
  });

  it('stops at first invalid row and returns correct row number', () => {
    const rows = [
      { zone: 'Gate 1', occupancy: '50', timestamp: 't' },
      { zone: 'Gate 2', occupancy: '-10', timestamp: 't' },
    ];
    const result = validateCSVPayload(rows);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Row 2');
  });

  it('rejects non-array input', () => {
    const result = validateCSVPayload('not an array');
    expect(result.valid).toBe(false);
  });
});
