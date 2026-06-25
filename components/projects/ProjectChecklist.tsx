'use client'

import { useState, useRef, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Task, Profile, TaskStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Trash2, Calendar, User } from 'lucide-react'

interface ProjectChecklistProps {
  tasks: Task[]
  projectId: string
  currentUser: Profile
  projectMembers: Profile[]
}

export function ProjectChecklist({
  tasks: initialTasks,
  projectId,
  currentUser,
  projectMembers,
}: ProjectChecklistProps) {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [newTitle, setNewTitle] = useState('')
  const [_isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const isAdminOrLeader = currentUser.role === 'admin' || currentUser.role === 'leader'

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const totalCount = tasks.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // Nhóm task theo trạng thái: chưa xong trước, xong sau
  const pending = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  /** Tick / bỏ tick một task */
  const handleToggle = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'

    // Cập nhật UI ngay lập tức (optimistic)
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    )

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id)

      if (error) throw error

      // Ghi log
      await supabase.from('activity_logs').insert({
        actor_id: currentUser.id,
        action: newStatus === 'done' ? 'completed_task' : 'moved_task',
        entity_type: 'task',
        entity_id: task.id,
        entity_name: task.title,
        project_id: projectId,
        metadata: { new_status: newStatus },
      })

      startTransition(() => router.refresh())
    } catch {
      toast.error('Không thể cập nhật trạng thái')
      // Hoàn tác
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      )
    }
  }

  /** Thêm task mới nhanh (chỉ cần nhập tên) */
  const handleAddTask = async () => {
    const title = newTitle.trim()
    if (!title) return

    setNewTitle('')

    const tempId = `temp-${Date.now()}`
    const tempTask: Task = {
      id: tempId,
      project_id: projectId,
      title,
      description: null,
      assignee_id: null,
      deadline: null,
      status: 'todo',
      priority: 'medium',
      progress: 0,
      checklist: null,
      notes: null,
      attachment_url: null,
      column_order: tasks.length,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setTasks((prev) => [...prev, tempTask])

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title,
          status: 'todo',
          priority: 'medium',
          progress: 0,
          column_order: tasks.length,
          created_by: currentUser.id,
        })
        .select()
        .single()

      if (error) throw error

      // Thay thế task tạm bằng task thật từ DB
      setTasks((prev) => prev.map((t) => (t.id === tempId ? (data as Task) : t)))

      await supabase.from('activity_logs').insert({
        actor_id: currentUser.id,
        action: 'created_task',
        entity_type: 'task',
        entity_id: data.id,
        entity_name: title,
        project_id: projectId,
        metadata: {},
      })

      startTransition(() => router.refresh())
    } catch {
      toast.error('Không thể thêm công việc')
      setTasks((prev) => prev.filter((t) => t.id !== tempId))
    }

    inputRef.current?.focus()
  }

  /** Xóa task */
  const handleDelete = async (task: Task) => {
    if (!confirm(`Xóa công việc "${task.title}"?`)) return

    setTasks((prev) => prev.filter((t) => t.id !== task.id))

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
      toast.success('Đã xóa công việc')
      startTransition(() => router.refresh())
    } catch {
      toast.error('Không thể xóa công việc')
      setTasks(initialTasks)
    }
  }

  return (
    <div className="space-y-5">
      {/* Tiến độ tổng */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">
            Đã hoàn thành: <span className="text-white font-bold">{doneCount}/{totalCount}</span> công việc
          </span>
          <span className="text-lg font-bold text-cyan-400">{pct}%</span>
        </div>
        <ProgressBar value={pct} showLabel={false} />
      </div>

      {/* Ô thêm công việc mới */}
      {isAdminOrLeader && (
        <div className="glass-card p-4 flex gap-3 items-center">
          <input
            ref={inputRef}
            id="checklist-new-task-input"
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            placeholder="Nhập tên công việc rồi nhấn Enter..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500"
          />
          <button
            id="checklist-add-task-btn"
            onClick={handleAddTask}
            disabled={!newTitle.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              bg-cyan-500/20 text-cyan-400 border border-cyan-500/30
              hover:bg-cyan-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>
      )}

      {/* Danh sách công việc chưa hoàn thành */}
      {pending.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            <span className="text-sm font-semibold text-slate-300">Cần làm ({pending.length})</span>
          </div>
          <ul className="divide-y divide-white/5">
            {pending.map((task) => (
              <TaskChecklistRow
                key={task.id}
                task={task}
                isAdminOrLeader={isAdminOrLeader}
                projectMembers={projectMembers}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Danh sách công việc đã hoàn thành */}
      {done.length > 0 && (
        <div className="glass-card overflow-hidden opacity-70">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span className="text-sm font-semibold text-slate-400">Đã hoàn thành ({done.length})</span>
          </div>
          <ul className="divide-y divide-white/5">
            {done.map((task) => (
              <TaskChecklistRow
                key={task.id}
                task={task}
                isAdminOrLeader={isAdminOrLeader}
                projectMembers={projectMembers}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </div>
      )}

      {totalCount === 0 && (
        <div className="glass-card p-10 flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">📋</span>
          <p className="text-slate-400 text-sm">Chưa có công việc nào. Thêm công việc đầu tiên bên trên!</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------
// Row component cho từng công việc trong checklist
// ---------------------------------------------------------
function TaskChecklistRow({
  task,
  isAdminOrLeader,
  projectMembers,
  onToggle,
  onDelete,
}: {
  task: Task
  isAdminOrLeader: boolean
  projectMembers: Profile[]
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  const isDone = task.status === 'done'
  const assignee = projectMembers.find((p) => p.id === task.assignee_id)

  return (
    <li
      id={`checklist-task-${task.id}`}
      className={`flex items-center gap-4 px-5 py-4 group hover:bg-white/5 transition-colors ${
        isDone ? 'opacity-60' : ''
      }`}
    >
      {/* Checkbox */}
      <button
        id={`checklist-toggle-${task.id}`}
        onClick={() => onToggle(task)}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          isDone
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-500 hover:border-cyan-400'
        }`}
        title={isDone ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
      >
        {isDone && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Tên công việc */}
      <span
        className={`flex-1 text-sm font-medium transition-all ${
          isDone ? 'line-through text-slate-500' : 'text-white'
        }`}
      >
        {task.title}
      </span>

      {/* Thông tin phụ */}
      <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
        {assignee && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {assignee.full_name}
          </span>
        )}
        {task.deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(task.deadline)}
          </span>
        )}
      </div>

      {/* Nút xóa (chỉ admin/leader thấy khi hover) */}
      {isAdminOrLeader && (
        <button
          id={`checklist-delete-${task.id}`}
          onClick={() => onDelete(task)}
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 rounded"
          title="Xóa công việc"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </li>
  )
}
