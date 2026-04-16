'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, Mail, ScanFace, Hash, WifiOff, History, XCircle, LogOut, ArrowLeft, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

import QRPanel        from '../../components/scanner/QRPanel';
import TicketIdPanel  from '../../components/scanner/TicketIdPanel';
import EmailPanel     from '../../components/scanner/EmailPanel';
import FacePanel      from '../../components/scanner/FacePanel';

import type { ScanMode, ScanStatus, ScanResultData, ScannerConfig, ScanHistoryEntry } from '../../types/scanner';

// HTTPS for scanner devices (camera requires HTTPS on LAN), HTTP for local admin
const FASTIFY_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.protocol === 'https:' ? '3000' : '3001'}`
  : 'http://127.0.0.1:3001';

// ─── Stable scanner ID ────────────────────────────────────────────────────────

const STORAGE_KEY = 'spotix-scanner-config';

function getSavedConfig(): ScannerConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScannerConfig;
  } catch { return null; }
}

function saveConfig(config: ScannerConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

function clearConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resultLabel(result: ScanStatus): string {
  switch (result) {
    case 'success':        return 'Checked in';
    case 'already_scanned': return 'Already scanned';
    case 'invalid':        return 'Invalid ticket';
    case 'error':          return 'Error';
    default:               return result;
  }
}

function resultColor(result: ScanStatus): string {
  switch (result) {
    case 'success':         return 'text-emerald-400';
    case 'already_scanned': return 'text-amber-400';
    case 'invalid':
    case 'error':           return 'text-red-400';
    default:                return 'text-white/40';
  }
}

function resultBg(result: ScanStatus): string {
  switch (result) {
    case 'success':         return 'bg-emerald-400/10 border-emerald-400/20';
    case 'already_scanned': return 'bg-amber-400/10 border-amber-400/20';
    case 'invalid':
    case 'error':           return 'bg-red-400/10 border-red-400/20';
    default:                return 'bg-white/5 border-white/10';
  }
}

function ResultIcon({ result, size = 14 }: { result: ScanStatus; size?: number }) {
  switch (result) {
    case 'success':         return <CheckCircle size={size} className="text-emerald-400 flex-shrink-0" />;
    case 'already_scanned': return <Clock size={size} className="text-amber-400 flex-shrink-0" />;
    case 'invalid':
    case 'error':           return <AlertCircle size={size} className="text-red-400 flex-shrink-0" />;
    default:                return null;
  }
}

// ─── Registration Modal ───────────────────────────────────────────────────────

function RegistrationModal({ onRegister }: { onRegister: (c: ScannerConfig) => void }) {
  const [name, setName] = useState('');
  const submit = () => {
    if (!name.trim()) return;
    const existing = getSavedConfig();
    const id = existing?.scannerName === name.trim()
      ? existing.scannerId
      : `scanner-${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 9)}`;
    const config: ScannerConfig = { scannerId: id, scannerName: name.trim() };
    saveConfig(config);
    onRegister(config);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#141414] border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-5">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden">
            <img src="/logo.png" alt="Spotix" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-lg font-semibold text-white">Spotix Scanner</h1>
          <p className="text-sm text-white/40">Enter a name for this scanner device</p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-white/40 font-medium uppercase tracking-wider">Scanner Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Gate 1, Main Entrance"
            className="bg-[#0f0f0f] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50 transition-colors"
            autoFocus
          />
        </div>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full py-3 rounded-xl bg-brand-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-brand-600 transition-colors"
        >
          Start Scanning
        </button>
      </div>
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center border-t border-white/[0.06]">
        <p className="text-[11px] text-white/30">
          Developed and Managed by{' '}
          <span className="text-white/50 font-medium">Spotix Technologies</span>
        </p>
      </footer>
    </div>
  );
}

// ─── Blocked Screen ───────────────────────────────────────────────────────────

function BlockedScreen() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-4">
          <XCircle size={32} className="text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Scanner Blocked</h2>
        <p className="text-sm text-white/40 mt-2">This scanner has been disabled by the admin.</p>
        <p className="text-xs text-white/20 mt-1">Contact your event organiser to re-enable.</p>
      </div>
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center border-t border-white/[0.06]">
        <p className="text-[11px] text-white/30">
          Developed and Managed by{' '}
          <span className="text-white/50 font-medium">Spotix Technologies</span>
        </p>
      </footer>
    </div>
  );
}

// ─── Exit Confirm Modal ───────────────────────────────────────────────────────

function ExitConfirmModal({
  scannerName,
  onConfirm,
  onCancel,
}: {
  scannerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#141414] border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center">
            <LogOut size={22} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Exit Scanner?</h2>
            <p className="text-sm text-white/40 mt-1">
              This will sign out <span className="text-white/70 font-medium">{scannerName}</span> and
              clear its saved identity. You'll need to register again to resume scanning.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium transition-colors"
          >
            Yes, exit event
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────

function ScannerHistoryScreen({
  entries,
  scannerName,
  isLoading,
  onClose,
}: {
  entries: ScanHistoryEntry[];
  scannerName: string;
  isLoading: boolean;
  onClose: () => void;
}) {
  const successCount       = entries.filter(e => e.result === 'success').length;
  const alreadyScannedCount = entries.filter(e => e.result === 'already_scanned').length;
  const invalidCount       = entries.filter(e => e.result === 'invalid' || e.result === 'error').length;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.06] flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 -ml-1 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">Scan History</p>
          <p className="text-xs text-white/30 truncate">{scannerName}</p>
        </div>
        {isLoading && <Loader2 size={14} className="text-white/30 animate-spin flex-shrink-0" />}
        {!isLoading && (
          <span className="text-xs text-white/30 flex-shrink-0">{entries.length} scans</span>
        )}
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-px bg-white/[0.04] border-b border-white/[0.06] flex-shrink-0">
        {[
          { label: 'Checked In',  count: successCount,        color: 'text-emerald-400' },
          { label: 'Duplicate',   count: alreadyScannedCount, color: 'text-amber-400'   },
          { label: 'Invalid',     count: invalidCount,        color: 'text-red-400'     },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-[#0f0f0f] py-3 px-4 flex flex-col items-center gap-0.5">
            <span className={`text-lg font-semibold tabular-nums ${color}`}>{count}</span>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="text-white/20 animate-spin" />
            <p className="text-sm text-white/30">Loading history...</p>
          </div>
        )}

        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <History size={32} className="text-white/10" />
            <p className="text-sm text-white/30">No scans yet</p>
          </div>
        )}

        {entries.length > 0 && (
          <ul className="divide-y divide-white/[0.04]">
            {[...entries].reverse().map((entry, i) => (
              <li key={i} className={`flex items-center gap-3 px-4 py-3 border-l-2 ${
                entry.result === 'success'         ? 'border-emerald-500/40' :
                entry.result === 'already_scanned' ? 'border-amber-500/40'  :
                                                     'border-red-500/40'
              }`}>
                <ResultIcon result={entry.result as ScanStatus} size={15} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate font-medium">{entry.guestName}</p>
                  <p className="text-xs text-white/30 truncate">{entry.ticketId}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className={`text-xs font-medium ${resultColor(entry.result as ScanStatus)}`}>
                    {resultLabel(entry.result as ScanStatus)}
                  </span>
                  <span className="text-[10px] text-white/20">{entry.time}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex-shrink-0 py-3 text-center border-t border-white/[0.06]">
        <p className="text-[11px] text-white/30">
          Developed and Managed by{' '}
          <span className="text-white/50 font-medium">Spotix Technologies</span>
        </p>
      </footer>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const [config, setConfig]             = useState<ScannerConfig | null>(null);
  const [mode, setMode]                 = useState<ScanMode>('qr');
  const [status, setStatus]             = useState<ScanStatus>('idle');
  const [resultData, setResultData]     = useState<ScanResultData | null>(null);
  const [textInput, setTextInput]       = useState('');
  const [isConnected, setIsConnected]   = useState(true);
  const [isBlocked, setIsBlocked]       = useState(false);
  const [showHistory, setShowHistory]   = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [history, setHistory]           = useState<ScanHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const wsRef      = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── On mount: restore saved config ──────────────────────────────────────────
  useEffect(() => {
    const saved = getSavedConfig();
    if (saved) setConfig(saved);
  }, []);

  // ── Hydrate history from PocketBase when config is ready ─────────────────────
  useEffect(() => {
    if (!config) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(
          `${FASTIFY_URL}/api/logs?scannerId=${encodeURIComponent(config.scannerId)}&limit=200`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const logs = await res.json() as Array<{
          ticketId: string;
          guestName: string;
          result: string;
          checkedInTime: string;
          scannerId: string;
        }>;

        const hydrated: ScanHistoryEntry[] = logs.map(log => ({
          ticketId:  log.ticketId,
          guestName: log.guestName,
          result:    log.result as ScanStatus,
          time:      log.checkedInTime ?? '',
          mode:      'ticketId' as ScanMode, // mode not stored in logs, default gracefully
        }));

        // Logs come back newest-first from server; reverse for chronological internal order
        setHistory(hydrated.reverse());
      } catch (err) {
        console.error('[Scanner] Failed to hydrate history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [config]);

  // ── WebSocket connection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!config) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost     = `${window.location.hostname}:${window.location.protocol === 'https:' ? '3000' : '3001'}`;
    const wsUrl      = `${wsProtocol}://${wsHost}/ws?scannerId=${encodeURIComponent(config.scannerId)}&name=${encodeURIComponent(config.scannerName)}`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen  = () => setIsConnected(true);
      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'scanner_blocked') {
            setIsBlocked(true);
            setStatus('blocked');
          } else if (msg.type === 'scanner_unblocked') {
            setIsBlocked(false);
            setStatus('idle');
          } else if (msg.type === 'event_ended') {
            alert(msg.payload?.message ?? 'The event has ended.');
          }
        } catch { /* ignore */ }
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [config]);

  // ── Auto-reset after 1 minute ────────────────────────────────────────────────
  const startTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStatus('idle');
      setResultData(null);
      setTextInput('');
    }, 60_000);
  }, []);

  const resetScan = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('idle');
    setResultData(null);
    setTextInput('');
  }, []);

  // ── Submit scan ──────────────────────────────────────────────────────────────
  const submitScan = useCallback(async (
    payload: { ticketId: string } | { email: string } | { faceEmbedding: number[] }
  ) => {
    if (!config || status === 'scanning') return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('scanning');

    try {
      const res = await fetch(`${FASTIFY_URL}/api/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...payload, scannerId: config.scannerId }),
      });

      if (res.status === 403) {
        setIsBlocked(true);
        setStatus('blocked');
        return;
      }

      const data: ScanResultData = await res.json();
      setResultData(data);
      setStatus(data.result as ScanStatus);

      const now     = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const scanMode: ScanMode = 'ticketId' in payload ? 'ticketId' : 'email' in payload ? 'email' : 'face';

      setHistory(prev => [...prev, {
        ticketId:  'ticketId' in payload ? payload.ticketId : data.guest?.email ?? 'Unknown',
        guestName: data.guest?.fullName ?? ('email' in payload ? payload.email : 'Unknown'),
        result:    data.result as ScanStatus,
        time:      timeStr,
        mode:      scanMode,
      }]);

      startTimeout();
    } catch (err) {
      console.error('[Scanner] Network error:', err);
      setResultData({ result: 'error', message: 'Network error — check connection' });
      setStatus('error');
      startTimeout();
    }
  }, [config, status, startTimeout]);

  // ── Mode switch ──────────────────────────────────────────────────────────────
  const handleModeChange = (newMode: ScanMode) => {
    resetScan();
    setMode(newMode);
  };

  // ── Exit event ───────────────────────────────────────────────────────────────
  const handleExitConfirm = () => {
    wsRef.current?.close();
    clearConfig();
    setConfig(null);
    setHistory([]);
    setShowExitModal(false);
    setStatus('idle');
    setResultData(null);
  };

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (!config) return <RegistrationModal onRegister={setConfig} />;
  if (isBlocked) return <BlockedScreen />;

  if (showHistory) return (
    <ScannerHistoryScreen
      entries={history}
      scannerName={config.scannerName}
      isLoading={historyLoading}
      onClose={() => setShowHistory(false)}
    />
  );

  const tabs: { id: ScanMode; label: string; icon: React.ReactNode }[] = [
    { id: 'qr',       label: 'QR Code',   icon: <QrCode   size={14} /> },
    { id: 'ticketId', label: 'Ticket ID', icon: <Hash     size={14} /> },
    { id: 'email',    label: 'Email',     icon: <Mail     size={14} /> },
    { id: 'face',     label: 'Face',      icon: <ScanFace size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Exit confirm modal */}
      {showExitModal && (
        <ExitConfirmModal
          scannerName={config.scannerName}
          onConfirm={handleExitConfirm}
          onCancel={() => setShowExitModal(false)}
        />
      )}

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden">
            <img src="/logo.png" alt="Spotix" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-medium text-white">{config.scannerName}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* History button */}
          <button
            onClick={() => setShowHistory(true)}
            className="relative p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            title="Scan history"
          >
            <History size={16} />
            {history.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {history.length > 99 ? '99' : history.length}
              </span>
            )}
          </button>

          {/* Exit button */}
          <button
            onClick={() => setShowExitModal(true)}
            className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/[0.08] transition-colors"
            title="Exit event"
          >
            <LogOut size={16} />
          </button>

          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 ml-1">
            {isConnected
              ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" /><span className="text-xs text-white/30">Live</span></>
              : <><WifiOff size={12} className="text-red-400" /><span className="text-xs text-red-400">Offline</span></>
            }
          </div>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="flex border-b border-white/[0.06] overflow-x-auto flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleModeChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs whitespace-nowrap px-2 transition-colors ${
              mode === tab.id
                ? 'text-brand-400 border-b-2 border-brand-500'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Panel area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
        {mode === 'qr' && (
          <QRPanel
            config={config}
            status={status}
            resultData={resultData}
            onScan={submitScan}
            onReset={resetScan}
          />
        )}
        {mode === 'ticketId' && (
          <TicketIdPanel
            status={status}
            resultData={resultData}
            textInput={textInput}
            onTextChange={setTextInput}
            onScan={submitScan}
            onReset={resetScan}
          />
        )}
        {mode === 'email' && (
          <EmailPanel
            status={status}
            resultData={resultData}
            textInput={textInput}
            onTextChange={setTextInput}
            onScan={submitScan}
            onReset={resetScan}
          />
        )}
        {mode === 'face' && (
          <FacePanel
            config={config}
            status={status}
            resultData={resultData}
            onScan={submitScan}
            onReset={resetScan}
          />
        )}
      </main>

      <footer className="flex-shrink-0 py-3 text-center border-t border-white/[0.06]">
        <p className="text-[11px] text-white/30">
          Developed and Managed by{' '}
          <span className="text-white/50 font-medium">Spotix Technologies</span>
        </p>
      </footer>
    </div>
  );
}