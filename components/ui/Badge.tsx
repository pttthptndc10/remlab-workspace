import { cn } from '@/lib/utils'
import {
  TASK_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_LABELS,
  TASK_STATUS_COLORS,
  PROJECT_STATUS_COLORS,
  PRIORITY_COLORS,
  ROLE_COLORS,
} from '@/lib/utils'
import type { TaskStatus, ProjectStatus, TaskPriority, ProjectPriority, UserRole } from '@/lib/types'

interface BadgeProps {
  status?: TaskStatus | ProjectStatus
  priority?: TaskPriority | ProjectPriority
  role?: UserRole
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ status, priority, role, size = 'md', className }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1'
  const baseClasses = 'inline-flex items-center font-medium rounded-full border'

  if (status) {
    // Determine if it's a task or project status
    const taskStatuses: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']
    const isTaskStatus = taskStatuses.includes(status as TaskStatus)
    const label = isTaskStatus
      ? TASK_STATUS_LABELS[status as TaskStatus]
      : PROJECT_STATUS_LABELS[status as ProjectStatus]
    const colorClass = isTaskStatus
      ? TASK_STATUS_COLORS[status as TaskStatus]
      : PROJECT_STATUS_COLORS[status as ProjectStatus]

    return (
      <span className={cn(baseClasses, sizeClasses, colorClass, className)}>
        {label}
      </span>
    )
  }

  if (priority) {
    const label = PRIORITY_LABELS[priority]
    const colorClass = PRIORITY_COLORS[priority]
    return (
      <span className={cn(baseClasses, sizeClasses, colorClass, className)}>
        {label}
      </span>
    )
  }

  if (role) {
    const label = ROLE_LABELS[role]
    const colorClass = ROLE_COLORS[role]
    return (
      <span className={cn(baseClasses, sizeClasses, colorClass, className)}>
        {label}
      </span>
    )
  }

  return null
}
