'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { TaskModal } from '@/components/tasks/TaskModal'
import { formatDate, getInitials, isOverdue } from '@/lib/utils'
import type { Task, Profile } from '@/lib/types'
import { Calendar, GripVertical } from 'lucide-react'

interface TaskCardProps {
  task: Task
  currentUser: Profile
  projectMembers: Profile[]
}

export function TaskCard({ task, currentUser, projectMembers }: TaskCardProps) {
  const [showModal, setShowModal] = useState(false)
  const overdue = isOverdue(task.deadline, task.status)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        id={`task-card-${task.id}`}
        className={`glass-card p-3 cursor-pointer group hover:-translate-y-0.5 hover:border-cyan-500/30 transition-all duration-150 ${
          isDragging ? 'shadow-2xl shadow-cyan-500/20 scale-105' : ''
        }`}
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            id={`drag-handle-${task.id}`}
            className="mt-0.5 p-0.5 rounded text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0"
            aria-label="Kéo thả task"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0" onClick={() => setShowModal(true)}>
            {/* Title */}
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2">
              {task.title}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge priority={task.priority} size="sm" />
            </div>

            {/* Progress */}
            {task.progress > 0 && (
              <ProgressBar value={task.progress} size="sm" className="mb-2" />
            )}

            {/* Footer: Assignee + Deadline */}
            <div className="flex items-center justify-between gap-2">
              {task.assignee ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400 flex-shrink-0">
                    {getInitials(task.assignee.full_name)}
                  </div>
                  <span className="text-xs text-slate-400 truncate max-w-[80px]">
                    {task.assignee.full_name.split(' ').pop()}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-600">Chưa giao</span>
              )}

              {task.deadline && (
                <div className={`flex items-center gap-1 text-xs flex-shrink-0 ${overdue ? 'text-rose-400' : 'text-slate-500'}`}>
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(task.deadline)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <TaskModal
          task={task}
          onClose={() => setShowModal(false)}
          currentUser={currentUser}
          projectMembers={projectMembers}
        />
      )}
    </>
  )
}
