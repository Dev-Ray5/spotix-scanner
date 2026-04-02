'use client';
import { useRef, useEffect } from 'react';
import { Hash, Loader2 } from 'lucide-react';
import type { ScanStatus, ScanResultData } from '../../types/scanner';
import ResultDisplay from './ResultDisplay';
import ScanAgainButton from './ScanAgainButton';

interface TicketIdPanelProps {
  status: ScanStatus;
  resultData: ScanResultData | null;
  textInput: string;
  onTextChange: (v: string) => void;
  onScan: (payload: { ticketId: string }) => Promise<void>;
  onReset: () => void;
}

export default function TicketIdPanel({
  status, resultData, textInput, onTextChange, onScan, onReset,
}: TicketIdPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'idle') inputRef.current?.focus();
  }, [status]);

  const showResult = status !== 'idle' && status !== 'scanning';

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
      {!showResult ? (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-white/40 uppercase tracking-wider">Ticket ID</label>
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && textInput.trim() && onScan({ ticketId: textInput.trim() })}
              placeholder="e.g. TKT-001"
              disabled={status === 'scanning'}
              className="bg-[#141414] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/40 transition-colors disabled:opacity-50 font-mono"
              autoFocus
            />
          </div>
          <button
            onClick={() => textInput.trim() && onScan({ ticketId: textInput.trim() })}
            disabled={!textInput.trim() || status === 'scanning'}
            className="w-full py-3.5 rounded-xl bg-brand-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
          >
            {status === 'scanning'
              ? <><Loader2 size={16} className="animate-spin" /> Checking...</>
              : <><Hash size={16} /> Check In</>}
          </button>
        </>
      ) : (
        <>
          <div className="relative h-52">
            <ResultDisplay status={status} data={resultData} />
          </div>
          <ScanAgainButton onClick={onReset} />
        </>
      )}
    </div>
  );
}