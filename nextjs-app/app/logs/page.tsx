'use client';
import { useState, useEffect } from 'react';
import { ArrowLeft, FileJson, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StatCards from '../../components/admin/StatCards';
import RushHourChart from '../../components/admin/RushHourChart';
import BreakdownChart from '../../components/admin/BreakdownChart';
import ScannerChart from '../../components/admin/ScannerChart';
import LiveFeed from '../../components/admin/LiveFeed';
import type { Log } from '../../types/log';

interface LogSummary {
  exportedAt?: string;
  totalGuests?: number;
  checkedIn?: number;
  noShows?: number;
  invalidScans?: number;
  alreadyScanned?: number;
  rushHourPeak?: string;
  filePath?: string;
  logs: Log[];
}

export default function LogsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for logs passed via sessionStorage (from import-logs menu action)
  useEffect(() => {
    const stored = sessionStorage.getItem('imported-logs');
    if (stored) {
      try {
        const data = JSON.parse(stored) as LogSummary;
        setSummary(data);
        sessionStorage.removeItem('imported-logs');
      } catch { /* ignore */ }
    }
  }, []);

  const handleImport = async () => {
    const spotix = (window as any).spotix;
    if (!spotix) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await spotix.importLogs();
      if (result.cancelled) { setIsLoading(false); return; }
      if (!result.success) throw new Error(result.error);

      const logs: Log[] = result.logs;

      // Derive counts from log entries only as fallbacks —
      // the exported summary fields are always preferred.
      const checkedIn    = logs.filter((l: Log) => l.result === 'success').length;
      const invalidScans = logs.filter((l: Log) => l.result === 'invalid').length;
      const alreadyScanned = logs.filter((l: Log) => l.result === 'already_scanned').length;

      setSummary({
        logs,
        checkedIn,
        invalidScans,
        alreadyScanned,
        filePath: result.filePath,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derive display values — always prefer the exported summary fields ───────
  const logs         = summary?.logs ?? [];
  const totalGuests  = summary?.totalGuests ?? 0;
  const checkedIn    = summary?.checkedIn    ?? logs.filter(l => l.result === 'success').length;
  const noShows      = summary?.noShows      ?? 0;
  const invalidScans = summary?.invalidScans ?? logs.filter(l => l.result === 'invalid').length;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#0f0f0f] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-7 h-7 rounded-lg overflow-hidden">
            <img src="/logo.png" alt="Spotix" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-semibold text-white">Log Viewer</span>
          {summary?.exportedAt && (
            <span className="text-xs text-white/20 hidden sm:block">
              Exported {new Date(summary.exportedAt).toLocaleString()}
            </span>
          )}
          {summary?.filePath && (
            <span className="text-xs text-white/20 hidden md:block font-mono truncate max-w-xs">
              {summary.filePath}
            </span>
          )}
        </div>
        <button
          onClick={handleImport}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors text-xs font-medium"
        >
          <FileJson size={12} />
          {isLoading ? 'Loading...' : 'Load Log File'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {!summary ? (
          // ── Empty state ──────────────────────────────────────────────────────
          <div className="flex flex-col items-center justify-center h-96 gap-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <FileJson size={32} className="text-brand-400" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-white">No Logs Loaded</h2>
              <p className="text-sm text-white/40 mt-2 max-w-sm">
                Import a Spotix log file (.json) exported from a previous event to review attendance data.
              </p>
            </div>
            {error && (
              <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm text-red-400 max-w-sm text-center">
                {error}
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              {isLoading ? 'Loading...' : 'Import Log File'}
            </button>
            <p className="text-xs text-white/20 text-center max-w-xs">
              Log files are exported at the end of each event as{' '}
              <code className="text-white/30">spotix-logs-*.json</code>
            </p>
          </div>
        ) : (
          // ── Dashboard ────────────────────────────────────────────────────────
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stat cards
                - totalGuests : from export summary (source of truth — not logs.length)
                - checkedIn   : from export summary
                - pending     : noShows from export summary (guests who never arrived)
                - invalidScans: from export summary
            */}
            <StatCards
              totalGuests={totalGuests}
              checkedIn={checkedIn}
              pending={noShows}
              invalidScans={invalidScans}
            />

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <RushHourChart logs={logs} />
              </div>
              <BreakdownChart logs={logs} />
            </div>

            {/* Scanner breakdown + live feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ScannerChart logs={logs} />
              <div className="lg:col-span-2">
                <LiveFeed logs={logs} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}