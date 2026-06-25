import { cn, getProgressColor } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, showLabel = false, size = 'md', className }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const barColor = getProgressColor(clampedValue)
  const heightClass = size === 'sm' ? 'h-1' : 'h-2'

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-400">Tiến độ</span>
          <span className="text-xs font-medium text-white">{clampedValue}%</span>
        </div>
      )}
      <div className={cn('w-full bg-white/10 rounded-full overflow-hidden', heightClass)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
