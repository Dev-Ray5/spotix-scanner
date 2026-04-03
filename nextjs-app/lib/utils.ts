/**
 * Spotix Scanner — Professional Event Check-in System
 * Copyright © 2026 Spotix Technologies. All rights reserved.
 *
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without the express written
 * permission of Spotix Technologies.
 *
 * For licensing inquiries, contact: legal@spotix.com.ng
 */


import type { Log, LogExportSummary } from '../types/log';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export const FACE_SIMILARITY_THRESHOLD = 0.6;

export function bucketByInterval(
  logs: Log[],
  intervalMinutes: number = 10
): { time: string; count: number }[] {
  const buckets: Record<string, number> = {};

  logs
    .filter((l) => l.result === 'success')
    .forEach((log) => {
      const date = new Date(log.timestamp);
      const hours = date.getHours();
      const minutes =
        Math.floor(date.getMinutes() / intervalMinutes) * intervalMinutes;
      const bucket = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }));
}

export function getRushHourPeak(logs: Log[]): string {
  const bucketed = bucketByInterval(logs, 10);
  if (bucketed.length === 0) return 'N/A';
  const peak = bucketed.reduce((max, cur) => (cur.count > max.count ? cur : max));
  return peak.time;
}

export function buildExportSummary(
  logs: Log[],
  totalGuests: number
): LogExportSummary {
  const checkedIn = logs.filter((l) => l.result === 'success').length;
  const invalidScans = logs.filter((l) => l.result === 'invalid').length;
  const alreadyScanned = logs.filter(
    (l) => l.result === 'already_scanned'
  ).length;

  return {
    exportedAt: new Date().toISOString(),
    totalGuests,
    checkedIn,
    noShows: totalGuests - checkedIn,
    invalidScans,
    alreadyScanned,
    rushHourPeak: getRushHourPeak(logs),
    logs,
  };
}

export function logsToCSV(logs: Log[]): string {
  const headers = [
    'ticketId',
    'guestName',
    'scannerId',
    'result',
    'checkedInDate',
    'checkedInTime',
    'timestamp',
    'note',
  ];

  const rows = logs.map((l) =>
    [
      l.ticketId,
      `"${l.guestName}"`,
      l.scannerId,
      l.result,
      l.checkedInDate,
      l.checkedInTime,
      l.timestamp,
      `"${l.note ?? ''}"`,
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getCheckedInDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCheckedInTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
