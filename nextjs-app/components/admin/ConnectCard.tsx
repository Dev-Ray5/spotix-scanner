'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wifi, Copy, Check, RefreshCw } from 'lucide-react';

export default function ConnectCard() {
  const [scannerUrl, setScannerUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

const loadUrl = async () => {
  setLoading(true);
  try {
    let url = typeof window !== 'undefined' && window.spotix
      ? await window.spotix.getScannerUrl()
      : 'https://localhost:3000/scanner/';

    // Normalize once at the source
    if (!url.endsWith('/')) url += '/';
    setScannerUrl(url);
  } catch {
    setScannerUrl('https://localhost:3000/scanner/');
  } finally {
    setLoading(false);
  }
};

const handleCopy = async () => {
  await navigator.clipboard.writeText(scannerUrl);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Connect Scanners</h3>
          <p className="text-xs text-white/30 mt-0.5">Scan QR from scanner device</p>
        </div>
        <button
          onClick={loadUrl}
          className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          title="Refresh URL"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG
              value={scannerUrl}
              size={120}
              fgColor="#6b2fa5"
              bgColor="white"
              level="M"
            />
          </div>

          <div className="w-full bg-[#0f0f0f] rounded-lg px-3 py-2 flex items-center gap-2">
            <Wifi size={12} className="text-brand-400 flex-shrink-0" />
            <span className="text-xs text-white/50 font-mono flex-1 truncate">{scannerUrl}</span>
            <button
              onClick={handleCopy}
              className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>

          <div className="w-full bg-amber-400/5 border border-amber-400/10 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-400/70 text-center leading-relaxed">
              Browser will show a security warning. Tap <strong className="text-amber-400">Advanced → Proceed</strong> to continue.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
