/**
 * ZoneCard — displays a single stadium zone with color-coded occupancy.
 * Renders a <button> when the zone is in alert state (accessible, no lint warnings).
 * Renders a <div role="status"> when the zone is normal.
 */
import PropTypes from 'prop-types';
import { alertThreshold, getOccupancyTier } from '../lib/csvValidator';

const TIER_STYLES = {
  green: { bg: 'zone-card--green', label: 'Low occupancy' },
  yellow: { bg: 'zone-card--yellow', label: 'Moderate occupancy' },
  red: { bg: 'zone-card--red', label: 'High occupancy — alert active' },
};

/** Inner content shared by both the button and status variants */
function ZoneCardContent({ zone, occupancy, tier }) {
  return (
    <>
      <span className="zone-card__name">{zone.zone}</span>
      <span className="zone-card__occupancy" aria-hidden="true">
        {occupancy}%
      </span>
      <div
        className="zone-card__bar"
        role="progressbar"
        aria-valuenow={occupancy}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Occupancy bar: ${occupancy}%`}
      >
        <div className={`zone-card__bar-fill zone-card__bar-fill--${tier}`} style={{ width: `${occupancy}%` }} />
      </div>
      {alertThreshold(occupancy) && (
        <span className="zone-card__alert-badge" aria-hidden="true">
          ⚠️ View AI Action
        </span>
      )}
    </>
  );
}

ZoneCardContent.propTypes = {
  zone: PropTypes.shape({
    zone: PropTypes.string.isRequired,
  }).isRequired,
  occupancy: PropTypes.number.isRequired,
  tier: PropTypes.string.isRequired,
};

export function ZoneCard({ zone, onAlertClick }) {
  const occupancy = Math.round(Number(zone.occupancy ?? 0));
  const tier = getOccupancyTier(occupancy);
  const isAlert = alertThreshold(occupancy);
  const styles = TIER_STYLES[tier];

  // When alert: native <button> — fully accessible, no jsx-a11y warnings
  if (isAlert) {
    return (
      <button
        type="button"
        className={`zone-card ${styles.bg}`}
        onClick={() => onAlertClick(zone)}
        aria-label={`${zone.zone}: ${occupancy} percent full. ${styles.label}. Press to view AI recommendation.`}
      >
        <ZoneCardContent zone={zone} occupancy={occupancy} tier={tier} />
      </button>
    );
  }

  // Normal state: non-interactive status div
  return (
    <div
      className={`zone-card ${styles.bg}`}
      role="status"
      aria-label={`${zone.zone}: ${occupancy} percent full. ${styles.label}.`}
    >
      <ZoneCardContent zone={zone} occupancy={occupancy} tier={tier} />
    </div>
  );
}

ZoneCard.propTypes = {
  zone: PropTypes.shape({
    id: PropTypes.string,
    zone: PropTypes.string.isRequired,
    occupancy: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  }).isRequired,
  onAlertClick: PropTypes.func.isRequired,
};

export default ZoneCard;
