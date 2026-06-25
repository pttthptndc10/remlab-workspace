'use client'

import { useState } from 'react'
import { Calendar, Eye, Pencil, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Modal } from '@/components/ui/Modal'
import { formatDate, getInitials, isOverdue } from '@/lib/utils'
import type { ProjectWithStats, UserRole } from '@/lib/types'

interface ProjectCardProps {
  project: ProjectWithStats
  onEdit?: () => void
  onDelete?: () => void
  currentUserRole?: UserRole
}

export function ProjectCard({ project, onEdit, onDelete, currentUserRole }: ProjectCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isAdmin = currentUserRole === 'admin'
  const isAdminOrLeader = isAdmin || currentUserRole === 'leader'
  const overdue = isOverdue(project.deadline, project.status)
  const members = project.members ?? []

  return (
    <>
      <div
        id={`project-card-${project.id}`}
        className="glass-card p-5 flex flex-col gap-3 hover:border-cyan-500/30 transition-all duration-200 hover:-translate-y-0.5"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-white leading-tight line-clamp-2">{project.name}</h3>
          <div className="flex gap-1.5 flex-shrink-0">
            <Badge status={project.status} size="sm" />
          </div>
        </div>

        {/* Priority */}
        <div>
          <Badge priority={project.priority} size="sm" />
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{project.description}</p>
        )}

        {/* Deadline */}
        <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-rose-400' : 'text-slate-400'}`}>
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{overdue ? '⚠ Quá hạn: ' : ''}{formatDate(project.deadline)}</span>
        </div>

        {/* Progress */}
        <div>
          <ProgressBar value={project.completionPercentage} showLabel size="sm" />
          <p className="text-xs text-slate-500 mt-1">
            {project.completedTaskCount}/{project.taskCount} tasks hoàn thành
          </p>
        </div>

        {/* Member Avatars */}
        {members.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex -space-x-2">
              {members.slice(0, 3).map((pm) => (
                <div
                  key={pm.id}
                  title={pm.member?.full_name ?? 'Member'}
                  className="w-6 h-6 rounded-full bg-cyan-500/30 border border-[#050b1f] flex items-center justify-center text-xs font-bold text-cyan-300"
                >
                  {getInitials(pm.member?.full_name ?? 'M')}
                </div>
              ))}
              {members.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-slate-600/50 border border-[#050b1f] flex items-center justify-center text-xs text-slate-400">
                  +{members.length - 3}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500 ml-1">{project.memberCount} người</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-white/5">
          <a
            href={`/projects/${project.id}`}
            id={`view-project-${project.id}`}
            className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            Xem
          </a>
          {isAdminOrLeader && onEdit && (
            <button
              id={`edit-project-${project.id}`}
              onClick={onEdit}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Pencil className="w-3.5 h-3.5" />
              Sửa
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              id={`delete-project-${project.id}`}
              onClick={() => setConfirmDelete(true)}
              className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Xác nhận xóa dự án"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Bạn có chắc muốn xóa dự án <strong className="text-white">&quot;{project.name}&quot;</strong>? Hành động này không thể hoàn tác.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              id={`cancel-delete-project-${project.id}`}
              onClick={() => setConfirmDelete(false)}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              id={`confirm-delete-project-${project.id}`}
              onClick={() => {
                onDelete?.()
                setConfirmDelete(false)
              }}
              className="btn-danger"
            >
              Xóa dự án
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
