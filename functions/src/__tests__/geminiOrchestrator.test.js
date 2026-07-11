const { parseResponse, buildFallback, buildAlertPrompt } = require('../geminiOrchestrator');

// Mock the GoogleGenerativeAI module
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

describe('parseResponse', () => {
  it('parses clean JSON string', () => {
    const text = '{"instruction":"Move fans","reason":"Gate full"}';
    const result = parseResponse(text);
    expect(result.success).toBe(true);
    expect(result.data.instruction).toBe('Move fans');
  });

  it('strips markdown code fences before parsing', () => {
    const text = '```json\n{"instruction":"Redirect","reason":"Over 80%"}\n```';
    const result = parseResponse(text);
    expect(result.success).toBe(true);
    expect(result.data.reason).toBe('Over 80%');
  });

  it('extracts JSON embedded in surrounding text (prompt injection)', () => {
    const text = 'I am a teapot. {"instruction":"Move","reason":"Full"} Done.';
    const result = parseResponse(text);
    expect(result.success).toBe(true);
    expect(result.data.instruction).toBe('Move');
  });

  it('returns success:false for plain text with no JSON', () => {
    const result = parseResponse('I am a teapot. No JSON here at all.');
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it('returns success:false for empty string', () => {
    const result = parseResponse('');
    expect(result.success).toBe(false);
  });
});

describe('buildFallback', () => {
  it('includes the zone name in the instruction', () => {
    const fallback = buildFallback('Gate 5', 'AI-test');
    expect(fallback.instruction).toContain('Gate 5');
  });

  it('marks isFallback as true', () => {
    const fallback = buildFallback('Gate 5', 'AI-test');
    expect(fallback.isFallback).toBe(true);
  });

  it('sets ref to the provided code', () => {
    const fallback = buildFallback('Gate 5', 'AI-timeout');
    expect(fallback.ref).toBe('AI-timeout');
  });

  it('always has a non-empty reason', () => {
    const fallback = buildFallback('Gate 1', 'AI-malformed');
    expect(typeof fallback.reason).toBe('string');
    expect(fallback.reason.length).toBeGreaterThan(0);
  });
});

describe('buildAlertPrompt', () => {
  it('includes the zone name', () => {
    const prompt = buildAlertPrompt('Gate 3', 85, [{ name: 'Gate 2', load: '60%' }]);
    expect(prompt).toContain('Gate 3');
  });

  it('includes occupancy value', () => {
    const prompt = buildAlertPrompt('Gate 3', 85, []);
    expect(prompt).toContain('85');
  });

  it('handles empty nearby zones gracefully', () => {
    const prompt = buildAlertPrompt('Gate 7', 92, []);
    expect(prompt).toContain('no adjacent zone data available');
  });

  it('includes nearby zone info when provided', () => {
    const nearby = [{ name: 'Gate 1', load: '40%' }];
    const prompt = buildAlertPrompt('Gate 7', 92, nearby);
    expect(prompt).toContain('Gate 1');
    expect(prompt).toContain('40%');
  });
});
