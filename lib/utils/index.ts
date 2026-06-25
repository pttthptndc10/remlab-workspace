import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isAfter, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { ProjectStatus, TaskStatus, ProjectPriority, TaskPriority, UserRole } from '@/lib/types'

// =====================================================
// CSS class utility
// =====================================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// =====================================================
// Date utilities
// =====================================================
export function formatDate(date: string | null): string {
  if (!date) return 'Không có hạn'
  try {
    return format(parseISO(date), 'dd/MM/yyyy', { locale: vi })
  } catch {
    return date
  }
}

export function formatDateTime(date: string | null): string {
  if (!date) return ''
  try {
    return format(parseISO(date), 'HH:mm dd/MM/yyyy', { locale: vi })
  } catch {
    return date
  }
}

export function isOverdue(deadline: string | null, status?: TaskStatus | ProjectStatus): boolean {
  if (!deadline) return false
  if (status === 'done' || status === 'completed') return false
  return isAfter(new Date(), parseISO(deadline))
}

export function getDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null
  const diff = parseISO(deadline).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// =====================================================
// Status/Priority labels & colors (tiếng Việt)
// =====================================================
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Lên kế hoạch',
  in_progress: 'Đang thực hiện',
  review: 'Đang review',
  completed: 'Hoàn thành',
  paused: 'Tạm dừng',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  doing: 'Đang làm',
  review: 'Đang review',
  done: 'Hoàn thành',
  blocked: 'Bị chặn',
}

export const PRIORITY_LABELS: Record<ProjectPriority | TaskPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Khẩn cấp',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  leader: 'Trưởng nhóm',
  member: 'Thành viên',
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  in_progress: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  review: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  paused: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  doing: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  review: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  blocked: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
}

export const PRIORITY_COLORS: Record<ProjectPriority | TaskPriority, string> = {
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  critical: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  leader: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  member: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

// =====================================================
// Progress color
// =====================================================
export function getProgressColor(progress: number): string {
  if (progress >= 100) return 'bg-emerald-500'
  if (progress >= 70) return 'bg-cyan-500'
  if (progress >= 40) return 'bg-amber-500'
  return 'bg-rose-500'
}

// =====================================================
// Avatar initials
// =====================================================
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// =====================================================
// Activity log message
// =====================================================
export function formatActivityMessage(action: string, entityName: string, actorName: string): string {
  const messages: Record<string, string> = {
    updated_task: `đã cập nhật task "${entityName}"`,
    completed_task: `đã hoàn thành task "${entityName}"`,
    created_task: `đã tạo task mới "${entityName}"`,
    deleted_task: `đã xóa task "${entityName}"`,
    added_note: `đã thêm ghi chú vào "${entityName}"`,
    created_project: `đã tạo dự án "${entityName}"`,
    updated_project: `đã cập nhật dự án "${entityName}"`,
    completed_project: `đã hoàn thành dự án "${entityName}"`,
    added_member: `đã thêm thành viên vào "${entityName}"`,
    added_comment: `đã bình luận trong "${entityName}"`,
    moved_task: `đã di chuyển task "${entityName}"`,
  }
  return `${actorName} ${messages[action] ?? `đã thực hiện hành động "${action}" trên "${entityName}"`}`
}

// =====================================================
// CSV Export
// =====================================================
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${format(new Date(), 'dd-MM-yyyy')}.csv`
  link.click()
}
