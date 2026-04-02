'use client';
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { Log } from '../../types/log';

interface ScannerChartProps {
  logs: Log[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-white/40 mb-1">{label}</p>
        <p className="text-sm font-semibold text-white">
          {payload[0].value} scan{payload[0].value !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
};

const SCANNER_COLORS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#06b6d4',
  '#10b981', '#f59e0b', '#ef4444', '#ec4899',
];

export default function ScannerChart({ logs }: ScannerChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((log) => {
      counts[log.scannerId] = (counts[log.scannerId] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([scannerId, count]) => ({ scannerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [logs]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-white">Per Scanner</h3>
        <p className="text-xs text-white/30 mt-0.5">Total scans by device</p>
      </div>

      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-xs text-white/20">No scanners active yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barCategoryGap="35%" layout="vertical">
            <XAxis
              type="number"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="scannerId"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={80}
              tickFormatter={(v: string) =>
                v.length > 10 ? v.slice(0, 10) + '…' : v
              }
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={SCANNER_COLORS[index % SCANNER_COLORS.length]}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
