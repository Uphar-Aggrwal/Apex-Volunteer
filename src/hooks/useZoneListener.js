/**
 * Custom React hook: real-time Firestore zone listener.
 * Handles connection drops, permission errors, and exponential backoff retry.
 * Never leaks subscriptions — always cleans up on unmount.
 */
import { useState, useEffect, useRef } from 'react';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { COLLECTIONS } from '../firebase/init';

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

/**
 * @returns {{
 *   zones: Array<{id: string, zone: string, occupancy: number, timestamp: string}>,
 *   connectionState: 'connecting' | 'connected' | 'disconnected' | 'error',
 *   error: string | null,
 *   isFromCache: boolean
 * }}
 */
export function useZoneListener() {
  const [zones, setZones] = useState([]);
  const [connectionState, setConnectionState] = useState('connecting');
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const retryCountRef = useRef(0);
  const unsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);
  // Store the attach function in a ref so it can safely recurse without
  // triggering react-hooks/exhaustive-deps or hoisting issues
  const attachRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    retryCountRef.current = 0;

    function attach() {
      if (!isMountedRef.current) return;

      setConnectionState('connecting');
      setError(null);

      const zonesQuery = query(
        COLLECTIONS.zones,
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        zonesQuery,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!isMountedRef.current) return;

          const fromCache = snapshot.metadata.fromCache;
          setIsFromCache(fromCache);
          setConnectionState(fromCache ? 'disconnected' : 'connected');
          setZones(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          retryCountRef.current = 0;
        },
        (err) => {
          if (!isMountedRef.current) return;

          // permission-denied — do NOT retry (would loop forever)
          if (err.code === 'permission-denied') {
            setConnectionState('error');
            setError('Access denied. Check Firestore security rules.');
            return;
          }

          if (retryCountRef.current >= MAX_RETRIES) {
            setConnectionState('error');
            setError(`Connection failed after ${MAX_RETRIES} attempts. Please refresh.`);
            return;
          }

          const delay = BASE_BACKOFF_MS * Math.pow(2, retryCountRef.current);
          retryCountRef.current += 1;
          setConnectionState('disconnected');

          setTimeout(() => {
            if (unsubscribeRef.current) unsubscribeRef.current();
            // Re-attach via the stable ref
            if (attachRef.current) attachRef.current();
          }, delay);
        }
      );

      unsubscribeRef.current = unsubscribe;
    }

    // Store the function so the retry timeout can access it
    attachRef.current = attach;
    attach();

    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []); // Empty deps — intentional: runs once on mount

  return { zones, connectionState, error, isFromCache };
}
