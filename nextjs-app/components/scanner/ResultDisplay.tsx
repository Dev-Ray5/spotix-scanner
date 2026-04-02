'use client';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ScanStatus, ScanResultData } from '../../types/scanner';

interface ResultDisplayProps {
  status: ScanStatus;
  data: ScanResultData | null;
}

export default function ResultDisplay({ status, data }: ResultDisplayProps) {
  if (status === 'idle' || status === 'scanning') return null;

  const configs = {
    success: {
      icon: <CheckCircle size={40} className="text-emerald-400" />,
      bg:    'bg-emerald-400/5 border-emerald-400/20',
      title: data?.guest?.fullName ?? 'Check-in successful',
      sub:   data?.guest?.ticketType,
    },
    already_scanned: {
      icon:  <AlertCircle size={40} className="text-amber-400" />,
      bg:    'bg-amber-400/5 border-amber-400/20',
      title: 'Already Checked In',
      sub:   data?.message,
    },
    invalid: {
      icon:  <XCircle size={40} className="text-red-400" />,
      bg:    'bg-red-400/5 border-red-400/20',
      title: 'Invalid Ticket',
      sub:   'Ticket not found in guest list',
    },
    blocked: {
      icon:  <XCircle size={40} className="text-red-400" />,
      bg:    'bg-red-400/5 border-red-400/20',
      title: 'Scanner Blocked',
      sub:   'Contact the event admin',
    },
    error: {
      icon:  <XCircle size={40} className="text-red-400" />,
      bg:    'bg-red-400/5 border-red-400/20',
      title: 'Error',
      sub:   data?.message ?? 'Something went wrong',
    },
  };

  const config = configs[status as keyof typeof configs];
  if (!config) return null;

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl border ${config.bg} animate-fade-in`}>
      {config.icon}
      <p className="text-lg font-semibold text-white mt-3 text-center">{config.title}</p>
      {config.sub && <p className="text-sm text-white/50 mt-1 text-center">{config.sub}</p>}
      {data?.guest && status === 'success' && (
        <div className="mt-4 bg-white/[0.04] rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-white/30">Ticket Type</p>
          <p className="text-sm font-medium text-brand-400 mt-0.5">{data.guest.ticketType}</p>
        </div>
      )}
    </div>
  );
}