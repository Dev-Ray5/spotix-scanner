'use client';
import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Log, ScanResult } from '../../types/log';

interface LiveFeedProps {
  logs: Log[];
}

type FilterType = 'all' | 'success' | 'already_scanned' | 'invalid';

const ResultIcon = ({ result }: { result: ScanResult }) => {
  switch (result) {
    case 'success':      return <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />;
    case 'already_scanned': return <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />;
    case 'invalid':     return <XCircle size={14} className="text-red-400 flex-shrink-0" />;
  }
};

const ResultBadge = ({ result }: { result: ScanResult }) => {
  const styles = {
    success:          'text-emerald-400 bg-emerald-400/10',
    already_scanned:  'text-amber-400 bg-amber-400/10',
    invalid:          'text-red-400 bg-red-400/10',
  };
  const labels = {
    success:          'Success',
    already_scanned:  'Duplicate',
    invalid:          'Invalid',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${styles[result]}`}>
      {labels[result]}
    </span>
  );
};

const FILTERS: { id: FilterType; label: string; color: string; activeColor: string }[] = [
  { id: 'all',             label: 'All',       color: 'text-white/40',    activeColor: 'text-white bg-white/[0.08]' },
  { id: 'success',         label: 'Valid',     color: 'text-white/40',    activeColor: 'text-emerald-400 bg-emerald-400/10' },
  { id: 'already_scanned', label: 'Duplicate', color: 'text-white/40',    activeColor: 'text-amber-400 bg-amber-400/10' },
  { id: 'invalid',         label: 'Invalid',   color: 'text-white/40',    activeColor: 'text-red-400 bg-red-400/10' },
];

export default function LiveFeed({ logs }: LiveFeedProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  // Deduplicate by a stable key (ticketId + result + checkedInTime)
  // This prevents double-rendering when both SSE and WS fire for the same scan
  const deduplicated = logs.filter((log, index, arr) => {
    const key = `${log.ticketId}-${log.result}-${log.checkedInTime}-${log.scannerId}`;
    return arr.findIndex((l) =>
      `${l.ticketId}-${l.result}-${l.checkedInTime}-${l.scannerId}` === key
    ) === index;
  });

  const filtered = filter === 'all'
    ? deduplicated
    : deduplicated.filter((l) => l.result === filter);

  const recent = filtered.slice(0, 30);

  // Count badges for filter tabs
  const counts = {
    all:             deduplicated.length,
    success:         deduplicated.filter((l) => l.result === 'success').length,
    already_scanned: deduplicated.filter((l) => l.result === 'already_scanned').length,
    invalid:         deduplicated.filter((l) => l.result === 'invalid').length,
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141414] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-medium text-white">Live Feed</h3>
          <p className="text-xs text-white/30 mt-0.5">Most recent scans</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
          <span className="text-xs text-white/30">Live</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2.5 border-b border-white/[0.04]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
              filter === f.id ? f.activeColor : `${f.color} hover:text-white/60 hover:bg-white/[0.04]`
            }`}
          >
            {f.label}
            <span className={`text-[10px] px-1 py-0.5 rounded min-w-[18px] text-center ${
              filter === f.id ? 'bg-black/20' : 'bg-white/[0.06] text-white/30'
            }`}>
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto max-h-72">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 gap-1">
            <p className="text-xs text-white/20">
              {filter === 'all' ? 'Waiting for scans...' : `No ${filter === 'already_scanned' ? 'duplicate' : filter} scans yet`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recent.map((log, index) => (
              <div
                key={`${log.id}-${log.ticketId}-${log.checkedInTime}`}
                className={`flex items-center gap-3 px-5 py-3 ${index === 0 ? 'animate-slide-up' : ''}`}
              >
                <ResultIcon result={log.result} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{log.guestName}</span>
                    <ResultBadge result={log.result} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/30 font-mono">{log.ticketId}</span>
                    <span className="text-white/20 text-xs">·</span>
                    <span className="text-xs text-white/30 truncate max-w-[120px]">{log.scannerId}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-white/40 font-mono">{log.checkedInTime}</p>
                  <p className="text-xs text-white/20">{log.checkedInDate}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}