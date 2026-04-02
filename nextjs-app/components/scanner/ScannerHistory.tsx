'use client';
import { CheckCircle, XCircle, AlertCircle, History, X } from 'lucide-react';
import type { ScanHistoryEntry, ScanStatus } from '../../types/scanner';

interface ScannerHistoryProps {
  entries: ScanHistoryEntry[];
  scannerName: string;
  onClose: () => void;
}

const ResultIcon = ({ result }: { result: ScanStatus }) => {
  switch (result) {
    case 'success':         return <CheckCircle  size={14} className="text-emerald-400 flex-shrink-0" />;
    case 'already_scanned': return <AlertCircle  size={14} className="text-amber-400  flex-shrink-0" />;
    default:                return <XCircle      size={14} className="text-red-400    flex-shrink-0" />;
  }
};

const BADGE: Record<string, string> = {
  success:         'text-emerald-400 bg-emerald-400/10',
  already_scanned: 'text-amber-400  bg-amber-400/10',
  invalid:         'text-red-400    bg-red-400/10',
  error:           'text-red-400    bg-red-400/10',
};

const LABEL: Record<string, string> = {
  success:         'Success',
  already_scanned: 'Duplicate',
  invalid:         'Invalid',
  error:           'Error',
};

export default function ScannerHistory({ entries, scannerName, onClose }: ScannerHistoryProps) {
  const successCount = entries.filter(e => e.result === 'success').length;
  const dupCount     = entries.filter(e => e.result === 'already_scanned').length;
  const invalidCount = entries.filter(e => e.result === 'invalid').length;

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <History size={16} className="text-brand-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Scan History</h2>
            <p className="text-xs text-white/30">{scannerName} · this session</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
        {[
          { label: 'Success',   value: successCount, color: 'text-emerald-400' },
          { label: 'Duplicate', value: dupCount,     color: 'text-amber-400'  },
          { label: 'Invalid',   value: invalidCount, color: 'text-red-400'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="py-4 text-center">
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-white/30 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <History size={28} className="text-white/10" />
            <p className="text-sm text-white/20">No scans yet this session</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {[...entries].reverse().map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <ResultIcon result={entry.result} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{entry.guestName}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${BADGE[entry.result] ?? 'text-white/40 bg-white/10'}`}>
                      {LABEL[entry.result] ?? entry.result}
                    </span>
                  </div>
                  <span className="text-xs text-white/30 font-mono">{entry.ticketId}</span>
                </div>
                <span className="text-xs text-white/30 font-mono flex-shrink-0">{entry.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total */}
      <div className="px-4 py-3 border-t border-white/[0.06] text-center">
        <p className="text-xs text-white/20">{entries.length} total scan{entries.length !== 1 ? 's' : ''} this session</p>
      </div>
    </div>
  );
}