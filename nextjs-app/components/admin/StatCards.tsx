'use client';
import { Users, UserCheck, Clock, AlertTriangle } from 'lucide-react';

interface StatCardsProps {
  totalGuests: number;
  checkedIn: number;
  pending: number;
  invalidScans: number;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  percentage?: number;
}

function StatCard({ label, value, icon, color, bgColor, percentage }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/40 uppercase tracking-widest">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}`}>
          <div className={color}>{icon}</div>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-semibold tabular-nums text-white">
          {value.toLocaleString()}
        </span>
        {percentage !== undefined && (
          <span className="text-xs text-white/30 mb-1">{percentage.toFixed(1)}%</span>
        )}
      </div>
      {percentage !== undefined && (
        <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function StatCards({ totalGuests, checkedIn, pending, invalidScans }: StatCardsProps) {
  const checkedInPct = totalGuests > 0 ? (checkedIn / totalGuests) * 100 : 0;
  const pendingPct = totalGuests > 0 ? (pending / totalGuests) * 100 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Guests"
        value={totalGuests}
        icon={<Users size={16} />}
        color="text-white/60"
        bgColor="bg-white/[0.06]"
      />
      <StatCard
        label="Checked In"
        value={checkedIn}
        icon={<UserCheck size={16} />}
        color="text-emerald-400"
        bgColor="bg-emerald-400/10"
        percentage={checkedInPct}
      />
      <StatCard
        label="Pending"
        value={pending}
        icon={<Clock size={16} />}
        color="text-amber-400"
        bgColor="bg-amber-400/10"
        percentage={pendingPct}
      />
      <StatCard
        label="Invalid Scans"
        value={invalidScans}
        icon={<AlertTriangle size={16} />}
        color="text-red-400"
        bgColor="bg-red-400/10"
      />
    </div>
  );
}
