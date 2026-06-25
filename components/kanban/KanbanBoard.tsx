'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { TaskCard } from '@/components/kanban/TaskCard'
import { Modal } from '@/components/ui/Modal'
import { TaskForm } from '@/components/tasks/TaskForm'
import { TASK_STATUS_LABELS } from '@/lib/utils'
import type { Task, KanbanColumn as KanbanColumnType, Profile, TaskStatus } from '@/lib/types'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const COLUMN_COLORS: Record<TaskStatus, string> = {
  todo: '#94a3b8',
  doing: '#06b6d4',
  review: '#f59e0b',
  done: '#10b981',
  blocked: '#ef4444',
}

interface KanbanBoardProps {
  tasks: Task[]
  projectId: string
  currentUser: Profile
  onTaskUpdate?: (task: Task) => void
}

function buildColumns(tasks: Task[]): KanbanColumnType[] {
  const statuses: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']
  return statuses.map((status) => ({
    id: status,
    label: TASK_STATUS_LABELS[status],
    color: COLUMN_COLORS[status],
    tasks: tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.column_order - b.column_order),
  }))
}

export function KanbanBoard({ tasks: initialTasks, projectId, currentUser, onTaskUpdate }: KanbanBoardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)

  const columns = buildColumns(tasks)
  const projectMembers: Profile[] = tasks
    .map((t) => t.assignee)
    .filter((a): a is Profile => !!a)
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const findTaskColumn = (taskId: string): TaskStatus | null => {
    const task = tasks.find((t) => t.id === taskId)
    return task?.status ?? null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeStatus = findTaskColumn(activeId)
    const overStatus = (over.data.current as { sortable?: { containerId: string } })?.sortable?.containerId as TaskStatus | undefined
      ?? overId as TaskStatus

    if (!activeStatus || activeStatus === overStatus) return

    const statuses: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']
    if (!statuses.includes(overStatus as TaskStatus)) return

    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, status: overStatus as TaskStatus } : t
      )
    )
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = tasks.find((t) => t.id === activeId)
    if (!activeTask) return

    const newStatus = activeTask.status

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeId)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        actor_id: currentUser.id,
        action: newStatus === 'done' ? 'completed_task' : 'moved_task',
        entity_type: 'task',
        entity_id: activeId,
        entity_name: activeTask.title,
        project_id: projectId,
        metadata: { new_status: newStatus },
      })

      router.refresh()
    } catch (err: unknown) {
      toast.error('Không thể cập nhật trạng thái task')
      // Revert
      setTasks(initialTasks)
    }
  }

  const isAdminOrLeader = currentUser.role === 'admin' || currentUser.role === 'leader'

  return (
    <div className="space-y-4">
      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              currentUser={currentUser}
              projectMembers={projectMembers}
              onAddTask={col.id === 'todo' && isAdminOrLeader ? () => setShowAddTask(true) : undefined}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rotate-2 opacity-90">
              <TaskCard
                task={activeTask}
                currentUser={currentUser}
                projectMembers={projectMembers}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add Task Modal */}
      <Modal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        title="Thêm task mới"
        size="md"
      >
        <TaskForm
          projectId={projectId}
          projectMembers={projectMembers}
          onSuccess={() => {
            setShowAddTask(false)
            router.refresh()
          }}
          onCancel={() => setShowAddTask(false)}
        />
      </Modal>
    </div>
  )
}
