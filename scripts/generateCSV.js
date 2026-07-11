/**
 * Synthetic data generator for Apex Volunteer.
 * Run locally to generate a realistic stadium CSV for testing.
 *
 * Usage:
 *   node scripts/generateCSV.js > stadium_data.csv
 *   node scripts/generateCSV.js --zones 15 --duration 120 > big_test.csv
 */

const args = process.argv.slice(2);
const getArg = (flag, defaultVal) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? Number(args[idx + 1]) : defaultVal;
};

const ZONE_COUNT = getArg('--zones', 10);
const DURATION_MINUTES = getArg('--duration', 60);
const INTERVAL_SECONDS = 30;

const ZONE_NAMES = [
  'Gate A - North', 'Gate B - North', 'Gate C - East',
  'Gate D - East', 'Gate E - South', 'Gate F - South',
  'Gate G - West', 'Gate H - West', 'Concourse Level 1',
  'Concourse Level 2', 'VIP Entrance', 'Media Zone',
  'Family Section', 'Emergency Exit North', 'Emergency Exit South',
];

/**
 * Simulates realistic occupancy using a sine wave with peak at halftime.
 * Different zones peak at different times (staggered by 2 minutes each).
 */
function simulateOccupancy(zoneIndex, timeElapsedSeconds, totalDurationSeconds) {
  const halfTime = totalDurationSeconds / 2;
  const phaseOffset = zoneIndex * 120; // 2 min stagger between zones
  const normalised = (timeElapsedSeconds + phaseOffset) / totalDurationSeconds;

  // Base: sine wave that peaks at halftime
  const base = 50 + 35 * Math.sin(normalised * Math.PI);

  // Noise: ±10%
  const noise = (Math.random() - 0.5) * 20;

  // Clamp to [5, 100]
  return Math.min(100, Math.max(5, Math.round(base + noise)));
}

const totalSeconds = DURATION_MINUTES * 60;
const rows = [];

// Header
rows.push('zone,occupancy,timestamp');

const start = new Date('2026-07-18T14:00:00Z');

for (let t = 0; t <= totalSeconds; t += INTERVAL_SECONDS) {
  const ts = new Date(start.getTime() + t * 1000).toISOString();
  for (let z = 0; z < ZONE_COUNT; z++) {
    const zone = ZONE_NAMES[z] ?? `Zone ${z + 1}`;
    const occupancy = simulateOccupancy(z, t, totalSeconds);
    rows.push(`"${zone}",${occupancy},${ts}`);
  }
}

process.stdout.write(rows.join('\n') + '\n');
process.stderr.write(`Generated ${rows.length - 1} rows for ${ZONE_COUNT} zones over ${DURATION_MINUTES} minutes.\n`);
