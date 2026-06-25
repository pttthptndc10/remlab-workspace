'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatDate, isOverdue, getInitials, TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import type { Task, Profile, TaskStatus, TaskPriority, UserRole } from '@/lib/types'
import { Calendar, Link2, FileText, Trash2, Save, X } from 'lucide-react'

interface TaskModalProps {
  task: Task
  onClose: () => void
  onUpdate?: (updated: Task) => void
  currentUser: Profile
  projectMembers: Profile[]
}

export function TaskModal({ task, onClose, onUpdate, currentUser, projectMembers }: TaskModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isAdminOrLeader = currentUser.role === 'admin' || currentUser.role === 'leader'
  const overdue = isOverdue(task.deadline, task.status)

  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    progress: task.progress,
    notes: task.notes ?? '',
    deadline: task.deadline ? task.deadline.slice(0, 10) : '',
    assignee_id: task.assignee_id ?? '',
    attachment_url: task.attachment_url ?? '',
  })

  const taskStatuses: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']
  const priorities: TaskPriority[] = ['low', 'medium', 'high', 'critical']

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Tiêu đề không được để trống')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: form.status,
          priority: form.priority,
          progress: form.progress,
          notes: form.notes.trim() || null,
          deadline: form.deadline || null,
          assignee_id: form.assignee_id || null,
          attachment_url: form.attachment_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .select('*, assignee:profiles(id, full_name, avatar_url, role)')
        .single()

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        actor_id: currentUser.id,
        action: form.status === 'done' && task.status !== 'done' ? 'completed_task' : 'updated_task',
        entity_type: 'task',
        entity_id: task.id,
        entity_name: form.title.trim(),
        project_id: task.project_id,
        metadata: { old_status: task.status, new_status: form.status, progress: form.progress },
      })

      toast.success('Đã cập nhật task!')
      onUpdate?.(data as Task)
      router.refresh()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
      toast.success('Đã xóa task')
      router.refresh()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Chi tiết Task" size="lg">
      <div className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="task-modal-title" className="block text-xs font-medium text-slate-400 mb-1.5">
            Tiêu đề
          </label>
          <input
            id="task-modal-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="input-dark w-full text-base font-semibold"
          />
        </div>

        {/* Status + Priority + Assignee */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="task-modal-status" className="block text-xs font-medium text-slate-400 mb-1.5">
              Trạng thái
            </label>
            <select
              id="task-modal-status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TaskStatus }))}
              className="input-dark w-full"
            >
              {taskStatuses.map((s) => (
                <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-modal-priority" className="block text-xs font-medium text-slate-400 mb-1.5">
              Độ ưu tiên
            </label>
            <select
              id="task-modal-priority"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
              className="input-dark w-full"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-modal-assignee" className="block text-xs font-medium text-slate-400 mb-1.5">
              Giao cho
            </label>
            <select
              id="task-modal-assignee"
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
        </div>

        {/* Deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="task-modal-deadline" className="block text-xs font-medium text-slate-400 mb-1.5">
              Hạn chót
            </label>
            <input
              id="task-modal-deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              className={`input-dark w-full ${overdue ? 'border-rose-500/50 text-rose-400' : ''}`}
            />
          </div>
          <div>
            <label htmlFor="task-modal-attachment" className="block text-xs font-medium text-slate-400 mb-1.5">
              <Link2 className="inline w-3 h-3 mr-1" />
              Attachment URL
            </label>
            <input
              id="task-modal-attachment"
              type="url"
              value={form.attachment_url}
              onChange={(e) => setForm((p) => ({ ...p, attachment_url: e.target.value }))}
              placeholder="https://..."
              className="input-dark w-full"
            />
          </div>
        </div>

        {/* Progress Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="task-modal-progress" className="text-xs font-medium text-slate-400">
              Tiến độ
            </label>
            <span className="text-sm font-bold text-cyan-400">{form.progress}%</span>
          </div>
          <input
            id="task-modal-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.progress}
            onChange={(e) => setForm((p) => ({ ...p, progress: Number(e.target.value) }))}
            className="w-full accent-cyan-400"
            style={{ height: '6px' }}
          />
          <ProgressBar value={form.progress} size="sm" className="mt-2" />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="task-modal-description" className="block text-xs font-medium text-slate-400 mb-1.5">
            Mô tả
          </label>
          <textarea
            id="task-modal-description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="input-dark w-full resize-none"
            placeholder="Mô tả chi tiết..."
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="task-modal-notes" className="block text-xs font-medium text-slate-400 mb-1.5">
            <FileText className="inline w-3 h-3 mr-1" />
            Ghi chú
          </label>
          <textarea
            id="task-modal-notes"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            className="input-dark w-full resize-none"
            placeholder="Ghi chú thêm..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/10">
          {isAdminOrLeader && (
            <button
              id="task-modal-delete"
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn-danger flex items-center gap-2"
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4" />
              Xóa
            </button>
          )}
          <div className="flex-1" />
          <button
            id="task-modal-cancel"
            type="button"
            onClick={onClose}
            className="btn-secondary flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Hủy
          </button>
          <button
            id="task-modal-save"
            type="button"
            onClick={handleSave}
            className="btn-primary flex items-center gap-2"
            disabled={loading}
          >
            <Save className="w-4 h-4" />
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="mt-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <p className="text-sm text-rose-300 mb-3">
              Xác nhận xóa task <strong>&quot;{task.title}&quot;</strong>? Không thể hoàn tác.
            </p>
            <div className="flex gap-2">
              <button
                id="task-delete-cancel"
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                Hủy
              </button>
              <button
                id="task-delete-confirm"
                onClick={handleDelete}
                className="btn-danger text-sm py-1.5 px-3"
                disabled={deleting}
              >
                {deleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
