'use client';
import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { Log } from '../../types/log';

interface BreakdownChartProps {
  logs: Log[];
}

const COLORS = {
  success: '#34d399',
  already_scanned: '#fbbf24',
  invalid: '#f87171',
};

const LABELS = {
  success: 'Success',
  already_scanned: 'Already Scanned',
  invalid: 'Invalid',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-white/40 mb-1">{payload[0].name}</p>
        <p className="text-sm font-semibold text-white">{payload[0].value} scans</p>
      </div>
    );
  }
  return null;
};

export default function BreakdownChart({ logs }: BreakdownChartProps) {
  const data = useMemo(() => {
    const counts = {
      success: logs.filter((l) => l.result === 'success').length,
      already_scanned: logs.filter((l) => l.result === 'already_scanned').length,
      invalid: logs.filter((l) => l.result === 'invalid').length,
    };

    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        name: LABELS[key as keyof typeof LABELS],
        value,
        color: COLORS[key as keyof typeof COLORS],
      }));
  }, [logs]);

  const total = logs.length;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-white">Scan Breakdown</h3>
        <p className="text-xs text-white/30 mt-0.5">Result distribution</p>
      </div>

      {total === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-xs text-white/20">No scans yet</p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                dataKey="value"
                strokeWidth={0}
                isAnimationActive={false}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-2 flex-1">
            {data.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-white/50">{entry.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white tabular-nums">
                    {entry.value}
                  </span>
                  <span className="text-xs text-white/30 tabular-nums w-10 text-right">
                    {((entry.value / total) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t border-white/[0.06] pt-2 mt-1 flex items-center justify-between">
              <span className="text-xs text-white/30">Total scans</span>
              <span className="text-xs font-semibold text-white tabular-nums">{total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
