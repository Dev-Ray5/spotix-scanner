'use client';
import { useState, useEffect, useRef } from 'react';
import { Power, HelpCircle, RefreshCw, FileJson } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StatCards from '../../components/admin/StatCards';
import RushHourChart from '../../components/admin/RushHourChart';
import BreakdownChart from '../../components/admin/BreakdownChart';
import ScannerChart from '../../components/admin/ScannerChart';
import LiveFeed from '../../components/admin/LiveFeed';
import ScannerPanel from '../../components/admin/ScannerPanel';
import ConnectCard from '../../components/admin/ConnectCard';
import GuestImport from '../../components/admin/GuestImport';
import EndEventModal from '../../components/admin/EndEventModal';
import { useDashboard } from '../../lib/useDashboard';

export default function DashboardPage() {
  const router = useRouter();
  const {
    logs, guests, scanners,
    totalGuests, checkedIn, pending, invalidScans,
    isLoading, lastUpdated,
    blockScanner, unblockScanner, refresh,
  } = useDashboard();

  const [showEndEvent, setShowEndEvent] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const menuCleanupRef = useRef<(() => void) | null>(null);

  // ─── Menu action listener ────────────────────────────────────────────────────
  useEffect(() => {
    const spotix = (window as any).spotix;
    if (!spotix?.onMenuAction) return;

    const cleanup = spotix.onMenuAction(async (action: string) => {
      switch (action) {
        case 'import-guests':
          // Trigger GuestImport component — dispatch a custom event
          window.dispatchEvent(new CustomEvent('spotix:open-guest-import'));
          break;

        case 'export-logs':
          handleExportLogsOnly();
          break;

        case 'import-logs':
          handleImportLogs();
          break;

        case 'end-event':
          setShowEndEvent(true);
          break;
      }
    });

    menuCleanupRef.current = cleanup;
    return () => cleanup?.();
  }, []);

  // ─── Export logs only (no DB purge) ─────────────────────────────────────────
  const handleExportLogsOnly = async () => {
    const spotix = (window as any).spotix;
    if (!spotix) return;

    setExportingLogs(true);
    try {
      const result = await spotix.exportLogs('json');
      if (result.success && result.paths?.length) {
        // Show success notification
        const path = result.paths[0];
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 z-50 bg-emerald-500 text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-slide-up';
        notification.textContent = `Logs exported to Downloads`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExportingLogs(false);
    }
  };

  // ─── Import logs → navigate to logs viewer ───────────────────────────────────
  const handleImportLogs = async () => {
    const spotix = (window as any).spotix;
    if (!spotix) return;

    const result = await spotix.importLogs();
    if (result.cancelled || !result.success) return;

    // Store in sessionStorage so logs page can read it
    sessionStorage.setItem('imported-logs', JSON.stringify({
      logs: result.logs,
      filePath: result.filePath,
    }));
    router.push('/logs');
  };

  // ─── End event ───────────────────────────────────────────────────────────────
  const handleEndEvent = async (format: 'csv' | 'json' | 'both') => {
    const spotix = (window as any).spotix;
    if (!spotix) {
      // Browser fallback — just call Fastify
      try {
        await fetch('http://127.0.0.1:3001/api/event/end', { method: 'POST' });
        return { success: true, paths: [] };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
    return spotix.endEvent(format);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Top bar */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#0f0f0f] sticky top-0 z-30">
        <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg overflow-hidden">
          <img src="/logo.png" alt="Spotix" className="w-full h-full object-cover" />
        </div>
          <span className="text-sm font-semibold text-white">Spotix Scanner</span>
          <span className="text-xs text-white/20 hidden sm:block">Admin Dashboard</span>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-white/20 hidden md:block">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportLogsOnly}
            disabled={exportingLogs}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            title="Export Logs (JSON)"
          >
            <FileJson size={14} className={exportingLogs ? 'animate-pulse' : ''} />
          </button>
          <button
            onClick={() => (window as any).spotix?.openResource('guide')}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            title="Operation Guide"
          >
            <HelpCircle size={14} />
          </button>
          <button
            onClick={() => setShowEndEvent(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium"
          >
            <Power size={12} />
            End Event
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-sm text-white/30">Connecting to database...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            <StatCards
              totalGuests={totalGuests}
              checkedIn={checkedIn}
              pending={pending}
              invalidScans={invalidScans}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <RushHourChart logs={logs} />
              </div>
              <BreakdownChart logs={logs} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ScannerChart logs={logs} />
              <div className="lg:col-span-2">
                <LiveFeed logs={logs} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ConnectCard />
              <GuestImport onImported={refresh} />
              <ScannerPanel
                scanners={scanners}
                logs={logs}
                onBlock={blockScanner}
                onUnblock={unblockScanner}
              />
            </div>
          </div>
        )}
      </main>

      {showEndEvent && (
        <EndEventModal
          totalGuests={totalGuests}
          checkedIn={checkedIn}
          onConfirm={handleEndEvent}
          onCancel={() => setShowEndEvent(false)}
        />
      )}
    </div>
  );
}