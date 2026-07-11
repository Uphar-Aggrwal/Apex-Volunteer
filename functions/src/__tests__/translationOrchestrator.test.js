const { buildTranslationPrompt, buildCacheKey } = require('../translationOrchestrator');

// Mock external deps so tests run without network or Firebase
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(),
}));
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: jest.fn(), set: jest.fn() })) })),
  })),
}));

describe('buildTranslationPrompt', () => {
  it('includes the target language name', () => {
    const prompt = buildTranslationPrompt('Redirect fans to Gate 4.', 'Spanish', 'formal');
    expect(prompt).toContain('Spanish');
  });

  it('includes the original text to translate', () => {
    const prompt = buildTranslationPrompt('Redirect fans to Gate 4.', 'French', 'formal');
    expect(prompt).toContain('Redirect fans to Gate 4.');
  });

  it('includes formal tone instruction for PA', () => {
    const prompt = buildTranslationPrompt('Move fans.', 'German', 'formal');
    expect(prompt).toContain('formal');
    expect(prompt.toLowerCase()).toContain('please');
  });

  it('includes casual tone instruction for direct conversation', () => {
    const prompt = buildTranslationPrompt('Move fans.', 'Hindi', 'casual');
    expect(prompt.toLowerCase()).toContain('casual');
    expect(prompt.toLowerCase()).toContain('hey');
  });
});

describe('buildCacheKey', () => {
  it('generates a consistent key for the same inputs', () => {
    const key1 = buildCacheKey('Move fans to Gate 4.', 'es', 'formal');
    const key2 = buildCacheKey('Move fans to Gate 4.', 'es', 'formal');
    expect(key1).toBe(key2);
  });

  it('generates different keys for different languages', () => {
    const key1 = buildCacheKey('Move fans.', 'es', 'formal');
    const key2 = buildCacheKey('Move fans.', 'fr', 'formal');
    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different tones', () => {
    const key1 = buildCacheKey('Move fans.', 'es', 'formal');
    const key2 = buildCacheKey('Move fans.', 'es', 'casual');
    expect(key1).not.toBe(key2);
  });

  it('handles long text by using only the first 40 characters', () => {
    const longText = 'A'.repeat(100);
    const key = buildCacheKey(longText, 'es', 'formal');
    // Key should not be excessively long
    expect(key.length).toBeLessThan(100);
  });

  it('returns a string', () => {
    const key = buildCacheKey('Redirect.', 'hi', 'casual');
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });
});
