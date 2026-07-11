import {
  parseGeminiResponse,
  getAlertFallback,
  getTranslationFallback,
  isValidAlertResponse,
} from '../lib/geminiUtils';

describe('parseGeminiResponse', () => {
  it('parses a clean JSON string', () => {
    const json = JSON.stringify({ instruction: 'Move fans', reason: 'Gate 3 is full' });
    const result = parseGeminiResponse(json);
    expect(result.success).toBe(true);
    expect(result.data.instruction).toBe('Move fans');
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const text = '```json\n{"instruction":"Redirect","reason":"Capacity exceeded"}\n```';
    const result = parseGeminiResponse(text);
    expect(result.success).toBe(true);
    expect(result.data.instruction).toBe('Redirect');
  });

  it('extracts JSON embedded in surrounding text (prompt injection scenario)', () => {
    const text = 'I am a teapot. Here is your JSON: {"instruction":"Move","reason":"Full"}. Done.';
    const result = parseGeminiResponse(text);
    expect(result.success).toBe(true);
    expect(result.data.instruction).toBe('Move');
  });

  it('returns success:false for plain text with no JSON', () => {
    const result = parseGeminiResponse('I am a teapot. No JSON here.');
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it('returns success:false for null input', () => {
    const result = parseGeminiResponse(null);
    expect(result.success).toBe(false);
  });

  it('returns success:false for empty string', () => {
    const result = parseGeminiResponse('');
    expect(result.success).toBe(false);
  });

  it('returns rawText in all cases for debugging', () => {
    const text = 'some text';
    const result = parseGeminiResponse(text);
    expect(result.rawText).toBe(text);
  });
});

describe('getAlertFallback', () => {
  it('returns an object with instruction and reason', () => {
    const fallback = getAlertFallback('Gate 5');
    expect(fallback.instruction).toContain('Gate 5');
    expect(typeof fallback.reason).toBe('string');
    expect(fallback.reason.length).toBeGreaterThan(0);
  });

  it('marks the response as a fallback', () => {
    const fallback = getAlertFallback('Gate 5');
    expect(fallback.isFallback).toBe(true);
  });

  it('includes a ref code for debugging', () => {
    const fallback = getAlertFallback('Gate 5', 'AI-timeout-001');
    expect(fallback.ref).toBe('AI-timeout-001');
  });

  it('uses default ref code when not provided', () => {
    const fallback = getAlertFallback('Gate 5');
    expect(fallback.ref).toBe('AI-fallback');
  });
});

describe('getTranslationFallback', () => {
  it('returns the original text unchanged', () => {
    const original = 'Please redirect fans to Gate 2.';
    const result = getTranslationFallback(original);
    expect(result.text).toBe(original);
  });

  it('marks language as English', () => {
    const result = getTranslationFallback('Move fans.');
    expect(result.language).toBe('en');
  });

  it('marks response as fallback with a warning message', () => {
    const result = getTranslationFallback('Move fans.');
    expect(result.isFallback).toBe(true);
    expect(typeof result.warning).toBe('string');
    expect(result.warning.length).toBeGreaterThan(0);
  });
});

describe('isValidAlertResponse', () => {
  it('returns true for a valid alert object', () => {
    const data = { instruction: 'Move fans.', reason: 'Gate is full.' };
    expect(isValidAlertResponse(data)).toBe(true);
  });

  it('returns false when instruction is missing', () => {
    expect(isValidAlertResponse({ reason: 'Gate full.' })).toBe(false);
  });

  it('returns false when instruction is empty string', () => {
    expect(isValidAlertResponse({ instruction: '', reason: 'Gate full.' })).toBe(false);
  });

  it('returns false when reason is missing', () => {
    expect(isValidAlertResponse({ instruction: 'Move fans.' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidAlertResponse(null)).toBe(false);
  });

  it('returns false for a non-object (plain string)', () => {
    expect(isValidAlertResponse('{"instruction":"x"}')).toBe(false);
  });
});
