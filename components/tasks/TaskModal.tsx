'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatDate, isOverdue, getInitials, TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import type { Task, Profile, TaskStatus, TaskPriority, UserRole, ChecklistItem } from '@/lib/types'
import { Calendar, Link2, FileText, Trash2, Save, X, Plus } from 'lucide-react'

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
  const isAssignee = currentUser.id === task.assignee_id
  const canEdit = isAdminOrLeader || isAssignee
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

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    task.checklist && Array.isArray(task.checklist) ? task.checklist : []
  )
  const [newStepTitle, setNewStepTitle] = useState('')

  const calculateProgress = (items: ChecklistItem[]) => {
    if (items.length === 0) return 0
    const completed = items.filter((item) => item.is_completed).length
    return Math.round((completed / items.length) * 100)
  }

  const updateChecklist = (newChecklist: ChecklistItem[]) => {
    setChecklist(newChecklist)
    const newProgress = calculateProgress(newChecklist)
    setForm((p) => ({ ...p, progress: newProgress }))
  }

  const handleToggleStep = (id: string) => {
    if (!canEdit) return
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, is_completed: !item.is_completed } : item
    )
    updateChecklist(updated)
  }

  const handleAddStep = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canEdit || !newStepTitle.trim()) return
    const newItem: ChecklistItem = {
      id: typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      title: newStepTitle.trim(),
      is_completed: false,
    }
    const updated = [...checklist, newItem]
    updateChecklist(updated)
    setNewStepTitle('')
  }

  const handleDeleteStep = (id: string) => {
    if (!canEdit) return
    const updated = checklist.filter((item) => item.id !== id)
    updateChecklist(updated)
  }

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
          checklist: checklist,
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
    <Modal isOpen onClose={onClose} title={canEdit ? 'Chi tiết Task' : 'Chi tiết Task (Chỉ xem)'} size="lg">
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
            disabled={!canEdit}
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
              disabled={!canEdit}
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
              disabled={!canEdit}
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
              disabled={!canEdit}
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
              disabled={!canEdit}
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
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Checklist Steps (Từng bước thực hiện công việc) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Các bước thực hiện công việc ({checklist.filter(c => c.is_completed).length}/{checklist.length})
            </label>
            <span className="text-sm font-bold text-cyan-400">{form.progress}% hoàn thành</span>
          </div>

          {/* Checklist steps progress bar */}
          <ProgressBar value={form.progress} size="sm" className="w-full" />

          {/* List of Steps */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {checklist.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">
                Chưa có bước thực hiện nào được thêm.
              </p>
            ) : (
              checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:border-cyan-500/20 hover:bg-white/10 transition-all group"
                >
                  <label className="flex items-center gap-3 flex-1 cursor-pointer select-none py-0.5">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => handleToggleStep(item.id)}
                      disabled={!canEdit}
                      className="w-4.5 h-4.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span
                      className={`text-sm text-slate-200 transition-all ${
                        item.is_completed ? 'line-through text-slate-500' : ''
                      }`}
                    >
                      {item.title}
                    </span>
                  </label>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteStep(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Xóa bước này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Step Form */}
          {canEdit && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddStep()
                  }
                }}
                placeholder="Thêm bước công việc tiếp theo..."
                className="input-dark flex-1 text-sm py-1.5"
              />
              <button
                type="button"
                onClick={handleAddStep}
                className="btn-primary py-1.5 px-3 flex items-center gap-1 text-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm
              </button>
            </div>
          )}
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
            disabled={!canEdit}
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
            disabled={!canEdit}
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
            Đóng
          </button>
          {canEdit && (
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
          )}
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
