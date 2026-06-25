'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority, Profile } from '@/lib/types'

interface TaskFormProps {
  projectId: string
  projectMembers: Profile[]
  onSuccess: () => void
  onCancel: () => void
}

export function TaskForm({ projectId, projectMembers, onSuccess, onCancel }: TaskFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignee_id: '',
    deadline: '',
    priority: 'medium' as TaskPriority,
    notes: '',
  })

  const taskStatuses: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']
  const priorities: TaskPriority[] = ['low', 'medium', 'high', 'critical']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Tiêu đề task không được để trống')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Get max column_order for todo column
      const { data: maxOrder } = await supabase
        .from('tasks')
        .select('column_order')
        .eq('project_id', projectId)
        .eq('status', 'todo')
        .order('column_order', { ascending: false })
        .limit(1)
        .single()

      const nextOrder = ((maxOrder?.column_order ?? 0) as number) + 1

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          assignee_id: form.assignee_id || null,
          deadline: form.deadline || null,
          status: 'todo' as TaskStatus,
          priority: form.priority,
          progress: 0,
          notes: form.notes.trim() || null,
          created_by: user?.id ?? null,
          column_order: nextOrder,
        })
        .select()
        .single()

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        actor_id: user?.id,
        action: 'created_task',
        entity_type: 'task',
        entity_id: task.id,
        entity_name: form.title.trim(),
        project_id: projectId,
        metadata: {},
      })

      toast.success('Tạo task thành công!')
      router.refresh()
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label htmlFor="task-title" className="block text-sm font-medium text-slate-300 mb-1.5">
          Tiêu đề <span className="text-rose-400">*</span>
        </label>
        <input
          id="task-title"
          type="text"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Nhập tiêu đề task..."
          className="input-dark w-full"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="task-description" className="block text-sm font-medium text-slate-300 mb-1.5">
          Mô tả
        </label>
        <textarea
          id="task-description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Mô tả chi tiết task..."
          rows={3}
          className="input-dark w-full resize-none"
        />
      </div>

      {/* Assignee + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-assignee" className="block text-sm font-medium text-slate-300 mb-1.5">
            Giao cho
          </label>
          <select
            id="task-assignee"
            value={form.assignee_id}
            onChange={(e) => setForm((p) => ({ ...p, assignee_id: e.target.value }))}
            className="input-dark w-full"
          >
            <option value="">-- Không giao --</option>
            {projectMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium text-slate-300 mb-1.5">
            Độ ưu tiên
          </label>
          <select
            id="task-priority"
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
            className="input-dark w-full"
          >
            {priorities.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label htmlFor="task-deadline" className="block text-sm font-medium text-slate-300 mb-1.5">
          Hạn chót
        </label>
        <input
          id="task-deadline"
          type="date"
          value={form.deadline}
          onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
          className="input-dark w-full"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="task-notes" className="block text-sm font-medium text-slate-300 mb-1.5">
          Ghi chú
        </label>
        <textarea
          id="task-notes"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Ghi chú thêm..."
          rows={2}
          className="input-dark w-full resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 border-t border-white/10">
        <button
          id="task-form-cancel"
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={loading}
        >
          Hủy
        </button>
        <button
          id="task-form-submit"
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Đang tạo...' : 'Tạo task'}
        </button>
      </div>
    </form>
  )
}
