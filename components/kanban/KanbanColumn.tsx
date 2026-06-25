'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from '@/components/kanban/TaskCard'
import type { KanbanColumn as KanbanColumnType, Profile } from '@/lib/types'

interface KanbanColumnProps {
  column: KanbanColumnType
  currentUser: Profile
  projectMembers: Profile[]
  onAddTask?: () => void
}

export function KanbanColumn({ column, currentUser, projectMembers, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl mb-0"
        style={{
          background: `${column.color}15`,
          borderTop: `2px solid ${column.color}`,
          borderLeft: `1px solid ${column.color}30`,
          borderRight: `1px solid ${column.color}30`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: column.color }}
          />
          <span className="text-sm font-semibold text-white">{column.label}</span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${column.color}25`, color: column.color }}
        >
          {column.tasks.length}
        </span>
      </div>

      {/* Tasks droppable area */}
      <div
        ref={setNodeRef}
        id={`kanban-col-${column.id}`}
        className="flex-1 rounded-b-xl p-2 space-y-2 min-h-[200px] transition-colors"
        style={{
          background: isOver ? `${column.color}08` : 'rgba(255,255,255,0.02)',
          border: `1px solid ${isOver ? column.color + '40' : 'rgba(255,255,255,0.05)'}`,
          borderTop: 'none',
        }}
      >
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUser={currentUser}
              projectMembers={projectMembers}
            />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-slate-600">
            Kéo task vào đây
          </div>
        )}

        {/* Add task button for Todo column */}
        {column.id === 'todo' && onAddTask && (
          <button
            id="kanban-add-task-btn"
            onClick={onAddTask}
            className="w-full py-2 text-xs text-slate-500 hover:text-cyan-400 border border-dashed border-white/10 hover:border-cyan-500/30 rounded-lg transition-all flex items-center justify-center gap-1.5"
          >
            + Thêm task
          </button>
        )}
      </div>
    </div>
  )
}
