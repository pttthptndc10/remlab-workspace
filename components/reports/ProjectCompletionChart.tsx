'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface ProjectCompletionData {
  name: string
  completion: number
}

interface ProjectCompletionChartProps {
  data: ProjectCompletionData[]
}

export function ProjectCompletionChart({ data }: ProjectCompletionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
        Không có dữ liệu
      </div>
    )
  }

  const getBarColor = (pct: number) => {
    if (pct >= 100) return '#10b981'
    if (pct >= 70) return '#06b6d4'
    if (pct >= 40) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '12px',
          }}
          formatter={(value) => [`${value ?? 0}%`, 'Hoàn thành']}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.completion)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
