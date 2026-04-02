'use client';
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { Log } from '../../types/log';
import { bucketByInterval, getRushHourPeak } from '../../lib/utils';

interface RushHourChartProps {
  logs: Log[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-white/40 mb-1">{label}</p>
        <p className="text-sm font-semibold text-white">
          {payload[0].value} check-in{payload[0].value !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
};

export default function RushHourChart({ logs }: RushHourChartProps) {
  const data = useMemo(() => bucketByInterval(logs, 10), [logs]);
  const peak = useMemo(() => getRushHourPeak(logs), [logs]);
  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Rush Hour</h3>
            <p className="text-xs text-white/30 mt-0.5">Check-ins over time</p>
          </div>
          <TrendingUp size={16} className="text-white/20" />
        </div>
        <div className="h-40 flex items-center justify-center">
          <p className="text-xs text-white/20">Waiting for first scan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Rush Hour</h3>
          <p className="text-xs text-white/30 mt-0.5">Check-ins per 10-minute interval</p>
        </div>
        <div className="flex items-center gap-2">
          {peak !== 'N/A' && (
            <div className="flex items-center gap-1.5 bg-brand-500/10 border border-brand-500/20 rounded-lg px-2.5 py-1">
              <TrendingUp size={12} className="text-brand-400" />
              <span className="text-xs text-brand-400 font-medium">Peak: {peak}</span>
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={30}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.count === maxCount ? '#f97316' : 'rgba(249,115,22,0.35)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
