import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
  trend?: {
    value: number
    label: string
  }
  description?: string
  id?: string
}

export function StatCard({ title, value, icon: Icon, color, trend, description, id }: StatCardProps) {
  return (
    <div
      id={id}
      className="glass-card p-5 relative overflow-hidden hover:scale-[1.02] transition-transform duration-200"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {/* Background glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 -mr-8 -mt-8 blur-2xl"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-400 font-medium mb-1 truncate">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>

          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}

          {description && !trend && (
            <p className="text-xs text-slate-500 mt-2">{description}</p>
          )}
        </div>

        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-4"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </div>
  )
}
