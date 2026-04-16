'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, FileJson, X, SkipForward } from 'lucide-react';

// HTTP port 3001 — admin window uses HTTP, no SSL issues
const FASTIFY_URL = 'http://127.0.0.1:3001';

interface GuestImportProps {
  onImported: () => void;
}

type ImportState = 'idle' | 'loading' | 'success' | 'partial' | 'error';

export default function GuestImport({ onImported }: GuestImportProps) {
  const [state, setState] = useState<ImportState>('idle');
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isElectron = typeof window !== 'undefined' && !!(window as any).spotix;

  const resolveState = (imported: number, skipped: number): ImportState => {
    if (imported === 0 && skipped > 0) return 'error';
    if (skipped > 0) return 'partial';
    return 'success';
  };

  const importGuests = useCallback(async (guests: unknown[]) => {
    setState('loading');
    setError(null);

    try {
      console.log(`[GuestImport] Sending ${guests.length} guests to ${FASTIFY_URL}/api/guests/import`);
      const res = await fetch(`${FASTIFY_URL}/api/guests/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests }),
      });

      console.log(`[GuestImport] Response status: ${res.status}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }

      const data = await res.json() as { imported: number; skipped: number };
      console.log(`[GuestImport] Imported: ${data.imported}, Skipped: ${data.skipped}`);
      setResult(data);
      setState(resolveState(data.imported, data.skipped));
      onImported();
    } catch (err) {
      console.error('[GuestImport] Error:', err);
      setError(String(err));
      setState('error');
    }
  }, [onImported]);

  const handleElectronImport = useCallback(async () => {
    const spotix = (window as any).spotix;
    if (!spotix) return;
    const filePath = await spotix.openGuestFileDialog();
    if (!filePath) return;

    setState('loading');
    setError(null);

    try {
      const res = await spotix.importGuests(filePath);
      if ('error' in res) {
        setError(res.error);
        setState('error');
      } else {
        setResult(res);
        setState(resolveState(res.imported, res.skipped));
        onImported();
      }
    } catch (err) {
      setError(String(err));
      setState('error');
    }
  }, [onImported]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const guests = JSON.parse(text);
        if (!Array.isArray(guests)) {
          setError('Invalid format — file must be a JSON array');
          setState('error');
          return;
        }
        await importGuests(guests);
      } catch {
        setError('Failed to parse JSON — make sure the file is valid');
        setState('error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importGuests]);

  const handleClick = () => {
    if (isElectron) {
      handleElectronImport();
    } else {
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    const handler = () => handleClick();
    window.addEventListener('spotix:import-guests', handler);
    return () => window.removeEventListener('spotix:import-guests', handler);
  }, [handleClick]);

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.json')) {
      setError('Please drop a .json file');
      setState('error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const guests = JSON.parse(text);
        if (!Array.isArray(guests)) throw new Error('Must be a JSON array');
        await importGuests(guests);
      } catch (err) {
        setError(String(err));
        setState('error');
      }
    };
    reader.readAsText(file);
  }, [importGuests]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Guest List</h3>
          <p className="text-xs text-white/30 mt-0.5">Import guests.json to begin</p>
        </div>
        {(state === 'success' || state === 'partial') && (
          <button onClick={handleReset} className="p-1 text-white/30 hover:text-white/60 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {state === 'idle' && (
        <button
          onClick={handleClick}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-3 py-8 px-4 rounded-xl border-2 border-dashed transition-all ${
            isDragging
              ? 'border-brand-500/60 bg-brand-500/5'
              : 'border-white/[0.08] hover:border-brand-500/30 hover:bg-white/[0.02]'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <Upload size={18} className="text-brand-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-white/70">
              {isElectron ? 'Select guests.json' : 'Click or drag guests.json here'}
            </p>
            <p className="text-xs text-white/30 mt-0.5">JSON file with guest list</p>
          </div>
        </button>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm text-white/50">Importing guests...</p>
        </div>
      )}

      {state === 'success' && result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4">
            <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Import successful</p>
              <p className="text-xs text-white/40 mt-0.5">
                {result.imported} guest{result.imported !== 1 ? 's' : ''} imported
              </p>
            </div>
          </div>
          <button onClick={handleClick} className="text-xs text-white/30 hover:text-white/60 transition-colors text-center py-1">
            Import another file
          </button>
        </div>
      )}

      {state === 'partial' && result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4">
            <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Import successful</p>
              <p className="text-xs text-white/40 mt-0.5">
                {result.imported} guest{result.imported !== 1 ? 's' : ''} imported
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
            <SkipForward size={18} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">
                {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                {result.skipped === 1 ? 'This ticket ID was' : 'These ticket IDs were'} already in the registry
              </p>
            </div>
          </div>
          <button onClick={handleClick} className="text-xs text-white/30 hover:text-white/60 transition-colors text-center py-1">
            Import another file
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col gap-3">
          {result && result.skipped > 0 && result.imported === 0 ? (
            <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
              <SkipForward size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">All entries already exist</p>
                <p className="text-xs text-white/40 mt-0.5">
                  All {result.skipped} ticket{result.skipped !== 1 ? 's' : ''} in this file are already in the registry
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-red-400/5 border border-red-400/20 rounded-xl p-4">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Import failed</p>
                <p className="text-xs text-white/40 mt-0.5 break-all">{error}</p>
              </div>
            </div>
          )}
          <button onClick={handleReset} className="text-xs text-brand-400 hover:text-brand-300 transition-colors text-center py-1">
            Try again
          </button>
        </div>
      )}

      <div className="bg-[#0f0f0f] rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <FileJson size={12} className="text-white/30" />
          <span className="text-xs text-white/30">Expected format</span>
        </div>
        <pre className="text-[11px] text-white/30 font-mono leading-relaxed overflow-x-auto">
{`[{
  "fullName": "Ada Obi",
  "email": "ada@example.com",
  "ticketId": "TKT-001",
  "ticketType": "VIP"
}]`}
        </pre>
      </div>
    </div>
  );
}