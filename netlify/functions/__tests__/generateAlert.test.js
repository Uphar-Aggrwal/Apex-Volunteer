jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn() }));
const { _buildPrompt } = require('../generateAlert');

describe('generateAlert Netlify Function', () => {
  describe('buildPrompt', () => {
    it('includes the zone name', () => {
      const prompt = _buildPrompt('Gate 3', 85, [{ name: 'Gate 2', load: '60%' }]);
      expect(prompt).toContain('Gate 3');
    });

    it('includes occupancy value', () => {
      const prompt = _buildPrompt('Gate 3', 85, []);
      expect(prompt).toContain('85');
    });

    it('handles empty nearby zones gracefully', () => {
      const prompt = _buildPrompt('Gate 7', 92, []);
      expect(prompt).toContain('no nearby zone data available');
    });

    it('includes nearby zone info when provided', () => {
      const nearby = [{ name: 'Gate 1', load: '40%' }];
      const prompt = _buildPrompt('Gate 7', 92, nearby);
      expect(prompt).toContain('Gate 1');
      expect(prompt).toContain('40%');
    });
  });
});
