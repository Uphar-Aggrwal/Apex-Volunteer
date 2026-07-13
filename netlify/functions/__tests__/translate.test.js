jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn() }));
const { _buildTranslationPrompt } = require('../translate');

describe('translate Netlify Function', () => {
  describe('buildTranslationPrompt', () => {
    it('includes the target language name', () => {
      const prompt = _buildTranslationPrompt('Redirect fans to Gate 4.', 'Spanish', 'formal');
      expect(prompt).toContain('Spanish');
    });

    it('includes the original text to translate', () => {
      const prompt = _buildTranslationPrompt('Redirect fans to Gate 4.', 'French', 'formal');
      expect(prompt).toContain('Redirect fans to Gate 4.');
    });

    it('includes formal tone instruction for PA', () => {
      const prompt = _buildTranslationPrompt('Move fans.', 'German', 'formal');
      expect(prompt).toContain('formal');
      expect(prompt).toContain('public address system');
    });

    it('includes casual tone instruction for direct conversation', () => {
      const prompt = _buildTranslationPrompt('Move fans.', 'Hindi', 'casual');
      expect(prompt).toContain('casual');
      expect(prompt).toContain('one-on-one conversation');
    });
  });
});
