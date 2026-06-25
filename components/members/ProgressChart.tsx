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
import type { Task, TaskStatus } from '@/lib/types'
import { TASK_STATUS_LABELS } from '@/lib/utils'

interface ProgressChartProps {
  tasks: Task[]
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#94a3b8',
  doing: '#06b6d4',
  review: '#f59e0b',
  done: '#10b981',
  blocked: '#ef4444',
}

export function ProgressChart({ tasks }: ProgressChartProps) {
  const statuses: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']

  const data = statuses.map((status) => ({
    name: TASK_STATUS_LABELS[status],
    count: tasks.filter((t) => t.status === status).length,
    status,
  }))

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
        Chưa có task nào
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '12px',
          }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
