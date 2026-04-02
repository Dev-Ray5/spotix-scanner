'use client';
import { useState } from 'react';
import { Shield, ShieldOff, ChevronRight, Wifi, WifiOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Scanner } from '../../types/scanner';
import type { Log, ScanResult } from '../../types/log';

interface ScannerPanelProps {
  scanners: Scanner[];
  logs: Log[];
  onBlock: (scannerId: string) => Promise<void>;
  onUnblock: (scannerId: string) => Promise<void>;
}

interface ScannerDetailProps {
  scanner: Scanner;
  logs: Log[];
  onClose: () => void;
  onBlock: () => Promise<void>;
  onUnblock: () => Promise<void>;
}

const ResultIcon = ({ result }: { result: ScanResult }) => {
  switch (result) {
    case 'success': return <CheckCircle size={12} className="text-emerald-400" />;
    case 'already_scanned': return <AlertCircle size={12} className="text-amber-400" />;
    case 'invalid': return <XCircle size={12} className="text-red-400" />;
  }
};

function ScannerDetail({ scanner, logs, onClose, onBlock, onUnblock }: ScannerDetailProps) {
  const [filter, setFilter] = useState<ScanResult | 'all'>('all');
  const [loading, setLoading] = useState(false);

  const scannerLogs = logs.filter((l) => l.scannerId === scanner.id);
  const filtered = filter === 'all' ? scannerLogs : scannerLogs.filter((l) => l.result === filter);

  const successCount = scannerLogs.filter((l) => l.result === 'success').length;
  const dupCount = scannerLogs.filter((l) => l.result === 'already_scanned').length;
  const invalidCount = scannerLogs.filter((l) => l.result === 'invalid').length;

  const handleToggleBlock = async () => {
    setLoading(true);
    try {
      if (scanner.status === 'blocked') await onUnblock();
      else await onBlock();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141414] border border-white/[0.08] rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${scanner.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <div>
              <h3 className="text-sm font-semibold text-white">{scanner.name}</h3>
              <p className="text-xs text-white/30 font-mono">{scanner.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleBlock}
              disabled={loading}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                scanner.status === 'blocked'
                  ? 'bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'
                  : 'bg-red-400/10 text-red-400 hover:bg-red-400/20'
              }`}
            >
              {scanner.status === 'blocked' ? (
                <><ShieldOff size={12} /> Unblock</>
              ) : (
                <><Shield size={12} /> Block</>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
          {[
            { label: 'Total Scans', value: scannerLogs.length, color: 'text-white' },
            { label: 'Success', value: successCount, color: 'text-emerald-400' },
            { label: 'Duplicate', value: dupCount, color: 'text-amber-400' },
            { label: 'Invalid', value: invalidCount, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
              <p className="text-xs text-white/30 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-white/[0.06]">
          {(['all', 'success', 'already_scanned', 'invalid'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'already_scanned' ? 'Duplicate' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Scan list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-white/20">No scans found</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-6 py-3">
                  <ResultIcon result={log.result} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{log.guestName}</span>
                    <span className="text-xs text-white/30 font-mono ml-2">{log.ticketId}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40 font-mono">{log.checkedInTime}</p>
                    <p className="text-xs text-white/20">{log.checkedInDate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScannerPanel({ scanners, logs, onBlock, onUnblock }: ScannerPanelProps) {
  const [selectedScanner, setSelectedScanner] = useState<Scanner | null>(null);

  return (
    <>
      <div className="rounded-xl border border-white/[0.06] bg-[#141414] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-medium text-white">Scanner Devices</h3>
            <p className="text-xs text-white/30 mt-0.5">{scanners.length} connected</p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {scanners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <WifiOff size={24} className="text-white/10" />
              <p className="text-xs text-white/20">No scanners connected</p>
            </div>
          ) : (
            scanners.map((scanner) => {
              const scannerLogCount = logs.filter((l) => l.scannerId === scanner.id).length;
              return (
                <div
                  key={scanner.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    scanner.status === 'blocked' ? 'bg-red-400' : 'bg-emerald-400 animate-pulse-soft'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{scanner.name}</span>
                      {scanner.status === 'blocked' && (
                        <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                          Blocked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/30 font-mono">{scanner.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-white tabular-nums">{scannerLogCount}</p>
                      <p className="text-xs text-white/30">scans</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (scanner.status === 'blocked') await onUnblock(scanner.id);
                        else await onBlock(scanner.id);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        scanner.status === 'blocked'
                          ? 'text-emerald-400 hover:bg-emerald-400/10'
                          : 'text-red-400 hover:bg-red-400/10'
                      }`}
                      title={scanner.status === 'blocked' ? 'Unblock scanner' : 'Block scanner'}
                    >
                      {scanner.status === 'blocked'
                        ? <ShieldOff size={14} />
                        : <Shield size={14} />
                      }
                    </button>
                    <button
                      onClick={() => setSelectedScanner(scanner)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                      title="View scans"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedScanner && (
        <ScannerDetail
          scanner={selectedScanner}
          logs={logs}
          onClose={() => setSelectedScanner(null)}
          onBlock={() => onBlock(selectedScanner.id)}
          onUnblock={() => onUnblock(selectedScanner.id)}
        />
      )}
    </>
  );
}
