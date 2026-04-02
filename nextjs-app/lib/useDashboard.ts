'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import PocketBase from 'pocketbase';
import type { Log } from '../types/log';
import type { Guest } from '../types/guest';
import type { Scanner } from '../types/scanner';

const POCKETBASE_URL = 'http://127.0.0.1:8090';
const FASTIFY_URL = 'http://127.0.0.1:3001';

export interface DashboardState {
  logs: Log[];
  wsLogs: Log[];        // WS-only logs for live feed display (not counted in stats)
  guests: Guest[];
  scanners: Scanner[];
  totalGuests: number;
  checkedIn: number;
  pending: number;
  invalidScans: number;
  isLoading: boolean;
  lastUpdated: Date | null;
}

/**
 * Merge two log arrays, deduplicate by stable content key, sort newest-first.
 * Used only for the live feed display — not for stats.
 */
function mergeLogs(existing: Log[], incoming: Log[]): Log[] {
  const seen = new Set<string>();
  const merged: Log[] = [];
  for (const log of [...incoming, ...existing]) {
    const key = `${log.ticketId}-${log.result}-${log.checkedInTime}-${log.scannerId}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(log);
    }
  }
  merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return merged;
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>({
    logs: [],
    wsLogs: [],
    guests: [],
    scanners: [],
    totalGuests: 0,
    checkedIn: 0,
    pending: 0,
    invalidScans: 0,
    isLoading: true,
    lastUpdated: null,
  });

  const pbRef = useRef<PocketBase | null>(null);
  if (!pbRef.current) pbRef.current = new PocketBase(POCKETBASE_URL);
  const pb = pbRef.current;

  // ─── Stats + logs from PocketBase only (source of truth for numbers) ────────
  const refreshStats = useCallback(async () => {
    try {
      const [logsResult, guestsResult] = await Promise.all([
        pb.collection('logs').getFullList<Log>({ sort: '-timestamp' }),
        pb.collection('guests').getFullList<Guest>(),
      ]);

      const checkedIn    = guestsResult.filter((g) => g.checkedIn).length;
      const invalidScans = logsResult.filter((l) => l.result === 'invalid').length;

      setState((prev) => ({
        ...prev,
        // Merge PB logs with WS logs for display, but stats come from PB only
        logs: logsResult,
        guests: guestsResult,
        totalGuests: guestsResult.length,
        checkedIn,
        pending: guestsResult.length - checkedIn,
        invalidScans,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    } catch (err) {
      console.error('[Dashboard] Failed to load data from PocketBase:', err);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [pb]);

  const refreshScanners = useCallback(async () => {
    try {
      const res = await fetch(`${FASTIFY_URL}/api/scanners`);
      if (res.ok) {
        const scanners: Scanner[] = await res.json();
        setState((prev) => ({ ...prev, scanners }));
      }
    } catch (e) {
      console.error('[Dashboard] Failed to fetch scanners:', e);
    }
  }, []);

  const blockScanner = useCallback(async (scannerId: string) => {
    await fetch(`${FASTIFY_URL}/api/scanners/${scannerId}/block`, { method: 'POST' });
    await refreshScanners();
  }, [refreshScanners]);

  const unblockScanner = useCallback(async (scannerId: string) => {
    await fetch(`${FASTIFY_URL}/api/scanners/${scannerId}/unblock`, { method: 'POST' });
    await refreshScanners();
  }, [refreshScanners]);

  useEffect(() => {
    refreshStats();
    refreshScanners();

    // ── PocketBase SSE: guests + logs ──────────────────────────────────────────
    // Stats are always derived from PB records — WS never increments counters.
    let guestsUnsub: (() => void) | null = null;
    let logsUnsub: (() => void) | null = null;

    const setupSubscriptions = async () => {
      try {
        // Guest updates → recompute checkedIn/pending counts
        guestsUnsub = await pb.collection('guests').subscribe<Guest>('*', (e) => {
          if (e.action === 'update' && e.record.checkedIn) {
            setState((prev) => {
              const updated   = prev.guests.map((g) => g.id === e.record.id ? e.record : g);
              const checkedIn = updated.filter((g) => g.checkedIn).length;
              return {
                ...prev,
                guests: updated,
                checkedIn,
                pending: updated.length - checkedIn,
                lastUpdated: new Date(),
              };
            });
          }
          if (e.action === 'create') {
            setState((prev) => {
              const guests    = [...prev.guests, e.record];
              const checkedIn = guests.filter((g) => g.checkedIn).length;
              return {
                ...prev,
                guests,
                totalGuests: guests.length,
                checkedIn,
                pending: guests.length - checkedIn,
                lastUpdated: new Date(),
              };
            });
          }
        });

        // Log creates → update invalidScans counter and push to pb logs list
        logsUnsub = await pb.collection('logs').subscribe<Log>('*', (e) => {
          if (e.action === 'create') {
            setState((prev) => {
              const newLogs      = [e.record, ...prev.logs];
              const invalidScans = newLogs.filter((l) => l.result === 'invalid').length;
              return {
                ...prev,
                logs: newLogs,
                invalidScans,
                lastUpdated: new Date(),
              };
            });
          }
        });
      } catch (err) {
        console.error('[Dashboard] PocketBase SSE error:', err);
      }
    };

    setupSubscriptions();

    // ── Fastify WebSocket: live feed display only, zero stat impact ────────────
    let ws: WebSocket | null = null;

    const connectWS = () => {
      try {
        ws = new WebSocket('ws://127.0.0.1:3001/ws?scannerId=admin-dashboard&name=Admin');
        ws.onopen  = () => console.log('[Dashboard] WebSocket connected');

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case 'scan_result': {
                // Add to wsLogs for instant live feed display only.
                // Stats (checkedIn, invalidScans etc.) stay PB-driven via SSE above.
                const { log } = msg.payload as { log: Log; guest: Guest | null };
                const wsLog: Log = { ...log, id: `ws-${Date.now()}` };
                setState((prev) => ({
                  ...prev,
                  wsLogs: mergeLogs(prev.wsLogs, [wsLog]).slice(0, 100),
                }));
                break;
              }
              case 'scanner_joined':
                setTimeout(refreshScanners, 200);
                break;
              case 'scanner_left': {
                const { scannerId } = msg.payload as { scannerId: string };
                setState((prev) => ({
                  ...prev,
                  scanners: prev.scanners.filter((s) => s.id !== scannerId),
                }));
                break;
              }
              case 'scanner_blocked':
              case 'scanner_unblocked':
                refreshScanners();
                break;
              case 'guests_imported':
                refreshStats();
                break;
              case 'event_ended':
                setState((prev) => ({
                  ...prev,
                  logs: [], wsLogs: [], guests: [],
                  totalGuests: 0, checkedIn: 0, pending: 0, invalidScans: 0,
                  lastUpdated: new Date(),
                }));
                break;
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onclose = () => {
          console.log('[Dashboard] WebSocket closed — reconnecting in 3s');
          setTimeout(connectWS, 3000);
        };
        ws.onerror = () => ws?.close();
      } catch (e) {
        console.error('[Dashboard] Could not connect WebSocket:', e);
        setTimeout(connectWS, 3000);
      }
    };

    connectWS();

    const statsInterval   = setInterval(refreshStats,   10_000);
    const scannerInterval = setInterval(refreshScanners, 5_000);

    return () => {
      guestsUnsub?.();
      logsUnsub?.();
      try { pb.collection('guests').unsubscribe('*'); } catch { /* ignore */ }
      try { pb.collection('logs').unsubscribe('*'); } catch { /* ignore */ }
      ws?.close();
      clearInterval(statsInterval);
      clearInterval(scannerInterval);
    };
  }, []);

  // Merged feed: PB logs + WS preview logs, deduplicated
  const feedLogs = mergeLogs(state.logs, state.wsLogs);

  return {
    ...state,
    feedLogs,   // use this in LiveFeed — has WS entries for instant display
    blockScanner,
    unblockScanner,
    refresh: refreshStats,
  };
}