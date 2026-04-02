'use client';
import { useState } from 'react';
import { AlertTriangle, FileText, FileJson, Files, X, Loader2, CheckCircle } from 'lucide-react';

interface EndEventModalProps {
  totalGuests: number;
  checkedIn: number;
  onConfirm: (format: 'csv' | 'json' | 'both') => Promise<{ success: boolean; paths?: string[]; error?: string }>;
  onCancel: () => void;
}

type ExportFormat = 'csv' | 'json' | 'both';
type ModalStep = 'confirm' | 'export' | 'processing' | 'done';

export default function EndEventModal({
  totalGuests, checkedIn, onConfirm, onCancel,
}: EndEventModalProps) {
  const [step, setStep] = useState<ModalStep>('confirm');
  const [format, setFormat] = useState<ExportFormat>('both');
  const [exportPaths, setExportPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setStep('processing');
    try {
      const result = await onConfirm(format);
      if (result.success) {
        setExportPaths(result.paths ?? []);
        setStep('done');
      } else {
        setError(result.error ?? 'Unknown error');
        setStep('export');
      }
    } catch (err) {
      setError(String(err));
      setStep('export');
    }
  };

  const formatOptions: { id: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'csv', label: 'CSV', desc: 'Spreadsheet compatible', icon: <FileText size={16} /> },
    { id: 'json', label: 'JSON', desc: 'Developer friendly', icon: <FileJson size={16} /> },
    { id: 'both', label: 'Both', desc: 'CSV + JSON', icon: <Files size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141414] border border-white/[0.08] rounded-2xl w-full max-w-md mx-4 shadow-2xl">

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">End Event</h3>
                  <p className="text-sm text-white/40 mt-1 leading-relaxed">
                    This will disconnect all scanners and clear the database.
                    Your logs will be exported first.
                  </p>
                </div>
                <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Summary */}
              <div className="mt-4 bg-[#0f0f0f] rounded-xl p-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-white/30">Total Guests</p>
                  <p className="text-lg font-semibold text-white tabular-nums">{totalGuests}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30">Checked In</p>
                  <p className="text-lg font-semibold text-emerald-400 tabular-nums">{checkedIn}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30">No Shows</p>
                  <p className="text-lg font-semibold text-white/50 tabular-nums">{totalGuests - checkedIn}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30">Attendance</p>
                  <p className="text-lg font-semibold text-brand-400 tabular-nums">
                    {totalGuests > 0 ? ((checkedIn / totalGuests) * 100).toFixed(1) : '0'}%
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('export')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step: Export format */}
        {step === 'export' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Export Format</h3>
                <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-white/40 mb-4">Choose how to save your event logs before the database is cleared.</p>

              {error && (
                <div className="mb-4 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFormat(opt.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      format === opt.id
                        ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-white/[0.12] hover:text-white/60'
                    }`}
                  >
                    {opt.icon}
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs opacity-70 text-center">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleExport}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors"
              >
                Export & End Event
              </button>
            </div>
          </>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="px-6 py-12 flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-brand-400 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-white">Ending event...</p>
              <p className="text-xs text-white/40 mt-1">Exporting logs and clearing database</p>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <>
            <div className="px-6 pt-6 pb-4 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Event Ended</h3>
                <p className="text-sm text-white/40 mt-1">Database cleared. Logs saved to Downloads.</p>
              </div>

              {exportPaths.length > 0 && (
                <div className="w-full bg-[#0f0f0f] rounded-xl p-3 text-left">
                  {exportPaths.map((p) => (
                    <div key={p} className="flex items-center gap-2 py-1">
                      <FileText size={12} className="text-white/30 flex-shrink-0" />
                      <span
                        className="text-xs text-white/50 font-mono truncate cursor-pointer hover:text-white/80 transition-colors"
                        onClick={() => window.spotix?.openPath(p)}
                      >
                        {p}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={onCancel}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
