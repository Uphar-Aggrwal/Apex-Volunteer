/**
 * Dashboard — main view: zone grid + alert engine.
 * Reads live data from Firestore via useZoneListener.
 * Handles AI alert generation and translation via Cloud Functions.
 */
import { useState, useCallback } from 'react';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../firebase/init';
import { useZoneListener } from '../hooks/useZoneListener';
import { ZoneCard } from './ZoneCard';
import { AlertBanner } from './AlertBanner';
import { CSVUploader } from './CSVUploader';
import { getAlertFallback, getTranslationFallback, parseGeminiResponse, isValidAlertResponse } from '../lib/geminiUtils';

const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_BASE_URL ?? '';
const MAX_UPLOAD_RETRIES = 3;

export function Dashboard() {
  const { zones, connectionState, error: listenerError, isFromCache } = useZoneListener();

  const [activeZone, setActiveZone] = useState(null);
  const [alert, setAlert] = useState(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [translation, setTranslation] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  /** Fetch AI alert from Cloud Function */
  const fetchAlert = useCallback(async (zone) => {
    setActiveZone(zone);
    setAlert(null);
    setTranslation(null);
    setAlertLoading(true);

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/generateAlert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          zone: zone.zone,
          occupancy: zone.occupancy,
          nearbyZones: zones
            .filter((z) => z.id !== zone.id)
            .slice(0, 3)
            .map((z) => ({ name: z.zone, load: `${Math.round(z.occupancy)}%` })),
        }),
      });

      if (res.status === 429) {
        // Quota — use fallback and let UI show retry countdown
        setAlert({ ...getAlertFallback(zone.zone, 'AI-quota-429'), quota: true });
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      const parsed = parseGeminiResponse(typeof data === 'string' ? data : JSON.stringify(data.result ?? data));

      if (parsed.success && isValidAlertResponse(parsed.data ?? data)) {
        setAlert(parsed.data ?? data);
      } else {
        setAlert(getAlertFallback(zone.zone, 'AI-malformed'));
      }
    } catch (err) {
      const refCode = err.name === 'TimeoutError' ? 'AI-timeout' : 'AI-network';
      setAlert(getAlertFallback(zone.zone, refCode));
    } finally {
      setAlertLoading(false);
    }
  }, [zones]);

  /** Fetch translation from Cloud Function */
  const handleTranslate = useCallback(async ({ langCode, tone, instruction }) => {
    if (!instruction) return;
    setTranslating(true);
    setTranslation(null);

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ text: instruction, targetLanguage: langCode, tone }),
      });

      if (!res.ok) {
        throw new Error(`Translation server error: ${res.status}`);
      }

      const data = await res.json();
      setTranslation({ text: data.translation ?? instruction, language: langCode, tone });
    } catch {
      setTranslation(getTranslationFallback(instruction));
    } finally {
      setTranslating(false);
    }
  }, []);

  /** Write uploaded CSV rows to Firestore in a batch */
  const handleUploadSuccess = useCallback(async (rows) => {
    setUploadError(null);
    let attempt = 0;

    const writeRows = async () => {
      const batch = writeBatch(db);
      rows.forEach((row) => {
        const ref = doc(COLLECTIONS.zones, String(row.zone).replace(/\s+/g, '-').toLowerCase());
        batch.set(ref, {
          zone: String(row.zone).trim(),
          occupancy: Number(row.occupancy),
          timestamp: serverTimestamp(),
        });
      });
      await batch.commit();
    };

    while (attempt < MAX_UPLOAD_RETRIES) {
      try {
        await writeRows();
        return;
      } catch (err) {
        attempt += 1;
        if (err.code === 'resource-exhausted') {
          const waitMs = 1000 * Math.pow(2, attempt);
          setUploadError(`Server busy. Retrying in ${waitMs / 1000}s... (attempt ${attempt}/${MAX_UPLOAD_RETRIES})`);
          await new Promise((r) => setTimeout(r, waitMs));
        } else {
          setUploadError(`❌ Upload failed: ${err.message}. Please try again.`);
          return;
        }
      }
    }
    setUploadError(`❌ Upload failed after ${MAX_UPLOAD_RETRIES} retries. Please try again later.`);
  }, []);

  const handleResolve = useCallback(() => {
    setActiveZone(null);
    setAlert(null);
    setTranslation(null);
  }, []);

  return (
    <main className="dashboard" aria-label="Apex Volunteer — Live Zone Dashboard">
      {/* Connection status banner */}
      {connectionState !== 'connected' && (
        <div
          className={`dashboard__status dashboard__status--${connectionState}`}
          role="status"
          aria-live="polite"
        >
          {connectionState === 'connecting' && '⏳ Connecting to live data...'}
          {connectionState === 'disconnected' && (isFromCache ? '📶 Showing cached data — reconnecting...' : '⚠️ Disconnected. Retrying...')}
          {connectionState === 'error' && `❌ ${listenerError}`}
        </div>
      )}

      {/* Alert Engine */}
      {activeZone && (
        <AlertBanner
          zone={activeZone}
          alert={alert}
          loading={alertLoading}
          onResolve={handleResolve}
          onTranslate={handleTranslate}
          translation={translation}
          translating={translating}
        />
      )}

      {/* Zone Grid */}
      <section className="dashboard__zones" aria-label="Stadium zone occupancy grid">
        <h1 className="dashboard__title">
          🏟️ Apex Volunteer — FIFA 2026 Crowd Co-pilot
          <span className="dashboard__live-badge" aria-label="Live data indicator">● LIVE</span>
        </h1>

        {zones.length === 0 && connectionState === 'connected' && (
          <p className="dashboard__empty" role="status">
            No zone data yet. Upload a CSV to get started.
          </p>
        )}

        <div className="dashboard__grid" role="list" aria-label="Zone cards">
          {zones.map((zone) => (
            <div key={zone.id} role="listitem">
              <ZoneCard zone={zone} onAlertClick={fetchAlert} />
            </div>
          ))}
        </div>
      </section>

      {/* CSV Uploader */}
      <aside className="dashboard__uploader" aria-label="Upload zone data panel">
        <CSVUploader onUploadSuccess={handleUploadSuccess} />
        {uploadError && (
          <p className="dashboard__upload-error" role="alert" aria-live="assertive">
            {uploadError}
          </p>
        )}
      </aside>
    </main>
  );
}

export default Dashboard;
