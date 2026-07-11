/**
 * AlertBanner — displays the AI-generated crowd instruction for a critical zone.
 * Shows instruction + reasoning + multilingual translation options.
 * Falls back gracefully when AI is unavailable.
 */
import { useState } from 'react';
import PropTypes from 'prop-types';

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
];

export function AlertBanner({
  zone,
  alert,
  loading,
  onResolve,
  onTranslate,
  translation,
  translating,
}) {
  const [tone, setTone] = useState('formal');

  if (!zone) return null;

  const handleTranslate = (langCode) => {
    onTranslate({ langCode, tone, instruction: alert?.instruction });
  };

  const handleToneChange = (e) => {
    setTone(e.target.value);
  };

  return (
    <section
      className="alert-banner"
      role="alert"
      aria-live="assertive"
      aria-label={`Critical alert for ${zone.zone}`}
    >
      <header className="alert-banner__header">
        <span className="alert-banner__icon" aria-hidden="true">🚨</span>
        <h2 className="alert-banner__title">
          {zone.zone} — {Math.round(zone.occupancy)}% Capacity
        </h2>
        <button
          className="alert-banner__resolve"
          onClick={onResolve}
          aria-label={`Resolve alert for ${zone.zone}`}
          type="button"
        >
          ✓ Resolve
        </button>
      </header>

      <div className="alert-banner__body">
        {loading && (
          <p className="alert-banner__loading" aria-live="polite">
            <span aria-hidden="true">⏳</span> Generating AI recommendation...
          </p>
        )}

        {!loading && alert && (
          <>
            {alert.isFallback && (
              <p className="alert-banner__fallback-notice" role="status">
                ⚠️ AI temporarily unavailable (Ref: {alert.ref}). Standard protocol applied.
              </p>
            )}
            <blockquote className="alert-banner__instruction">
              {alert.instruction}
            </blockquote>
            <p className="alert-banner__reason">
              <strong>Reason:</strong> {alert.reason}
            </p>
          </>
        )}
      </div>

      {!loading && alert && (
        <footer className="alert-banner__footer">
          <div className="alert-banner__tone" role="group" aria-label="Translation tone selector">
            <label htmlFor="tone-select" className="alert-banner__tone-label">
              Tone:
            </label>
            <select
              id="tone-select"
              className="alert-banner__tone-select"
              value={tone}
              onChange={handleToneChange}
              aria-label="Select translation tone: Formal for PA announcements or Casual for direct conversation"
            >
              <option value="formal">📢 Formal (PA)</option>
              <option value="casual">💬 Casual (Fan)</option>
            </select>
          </div>

          <div
            className="alert-banner__languages"
            role="group"
            aria-label="Translate instruction to another language"
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className="alert-banner__lang-btn"
                onClick={() => handleTranslate(lang.code)}
                disabled={translating}
                aria-label={`Translate to ${lang.label} in ${tone} tone`}
                type="button"
              >
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>

          {translating && (
            <p className="alert-banner__translating" aria-live="polite">
              Translating...
            </p>
          )}

          {translation && !translating && (
            <div
              className={`alert-banner__translation ${translation.isFallback ? 'alert-banner__translation--fallback' : ''}`}
              role="region"
              aria-label={`Translated instruction in ${translation.language}, ${translation.tone} tone`}
            >
              {translation.isFallback && translation.warning && (
                <p className="alert-banner__translation-warning">{translation.warning}</p>
              )}
              <p className="alert-banner__translation-text">{translation.text}</p>
            </div>
          )}
        </footer>
      )}
    </section>
  );
}

AlertBanner.propTypes = {
  zone: PropTypes.shape({
    zone: PropTypes.string.isRequired,
    occupancy: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  }),
  alert: PropTypes.shape({
    instruction: PropTypes.string.isRequired,
    reason: PropTypes.string.isRequired,
    isFallback: PropTypes.bool,
    ref: PropTypes.string,
  }),
  loading: PropTypes.bool.isRequired,
  onResolve: PropTypes.func.isRequired,
  onTranslate: PropTypes.func.isRequired,
  translation: PropTypes.shape({
    text: PropTypes.string.isRequired,
    language: PropTypes.string.isRequired,
    tone: PropTypes.string,
    isFallback: PropTypes.bool,
    warning: PropTypes.string,
  }),
  translating: PropTypes.bool.isRequired,
};

AlertBanner.defaultProps = {
  zone: null,
  alert: null,
  translation: null,
};

export default AlertBanner;
