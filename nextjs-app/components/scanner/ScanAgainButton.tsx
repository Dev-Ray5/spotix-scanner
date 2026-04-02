'use client';
import { ScanLine } from 'lucide-react';

export default function ScanAgainButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.10] transition-colors flex items-center justify-center gap-2"
    >
      <ScanLine size={16} />
      Scan Again
    </button>
  );
}