'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Task, Profile, Project, TaskStatus } from '@/lib/types'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react'

interface ProjectChecklistProps {
  tasks: Task[]
  project: Project
  currentUser: Profile
  projectMembers: Profile[]
}

export function ProjectChecklist({
  tasks: initialTasks,
  project,
  currentUser,
  projectMembers,
}: ProjectChecklistProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [savedTasks, setSavedTasks] = useState<Task[]>(initialTasks)
  const [localTasks, setLocalTasks] = useState<Task[]>(initialTasks)
  const [saving, setSaving] = useState(false)

  // Sync with prop updates from server (e.g. after router.refresh finishes)
  useEffect(() => {
    setSavedTasks(initialTasks)
    setLocalTasks(initialTasks)
  }, [initialTasks])

  // Quyền chỉnh sửa: Chỉ Admin, người tạo dự án, hoặc thành viên của dự án
  const isProjectMember = projectMembers.some((m) => m.id === currentUser.id)
  const isCreator = project.created_by === currentUser.id
  const isAdmin = currentUser.role === 'admin'
  const hasEditPermission = isAdmin || isProjectMember || isCreator

  // Tiến độ tổng - chỉ cập nhật dựa trên savedTasks (DB/lần lưu gần nhất)
  const doneCount = savedTasks.filter((t) => t.status === 'done').length
  const totalCount = savedTasks.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // Kiểm tra xem localTasks có thay đổi so với savedTasks hay không
  const hasChanges = () => {
    if (localTasks.length !== savedTasks.length) return true

    for (const local of localTasks) {
      const saved = savedTasks.find((s) => s.id === local.id)
      if (!saved) return true // Task mới

      if (local.title !== saved.title) return true
      if ((local.notes || '') !== (saved.notes || '')) return true

      const localCompleted = local.status === 'done'
      const savedCompleted = saved.status === 'done'
      if (localCompleted !== savedCompleted) return true
    }

    for (const saved of savedTasks) {
      if (!localTasks.some((l) => l.id === saved.id)) return true
    }

    return false
  }

  const isDirty = hasChanges()

  // Chia localTasks thành nhóm chưa hoàn thành và đã hoàn thành để hiển thị
  const pendingTasks = localTasks.filter((t) => t.status !== 'done')
  const completedTasks = localTasks.filter((t) => t.status === 'done')

  // Thêm task mới vào local state
  const handleAddTask = () => {
    if (!hasEditPermission) return

    const tempId = `temp-${Date.now()}`
    const newTask: Task = {
      id: tempId,
      project_id: project.id,
      title: '',
      description: null,
      assignee_id: null,
      deadline: null,
      status: 'todo',
      priority: 'medium',
      progress: 0,
      checklist: null,
      notes: '',
      attachment_url: null,
      column_order: localTasks.length,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setLocalTasks((prev) => [...prev, newTask])
  }

  // Cập nhật trường thông tin của task trong local state
  const handleUpdateField = (id: string, field: 'title' | 'notes', value: string) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }

  // Toggle status của task trong local state
  const handleToggleStatus = (id: string) => {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === 'done' ? 'todo' : 'done' }
          : t
      )
    )
  }

  // Xóa task khỏi local state
  const handleDeleteLocal = (id: string) => {
    setLocalTasks((prev) => prev.filter((t) => t.id !== id))
  }

  // Lưu mọi thay đổi xuống Supabase
  const handleSave = async () => {
    if (!hasEditPermission) return

    // Validation: Không cho phép để trống tên công việc
    const hasEmptyTitle = localTasks.some((t) => !t.title.trim())
    if (hasEmptyTitle) {
      toast.error('Vui lòng điền đầy đủ tên cho các công việc')
      return
    }

    setSaving(true)
    try {
      // 1. Xác định các task cần xóa
      const tasksToDelete = savedTasks.filter(
        (st) => !localTasks.some((lt) => lt.id === st.id)
      )

      // 2. Xác định các task cần thêm mới (có id bắt đầu bằng 'temp-')
      const tasksToInsert = localTasks.filter((lt) => lt.id.startsWith('temp-'))

      // 3. Xác định các task cần cập nhật
      const tasksToUpdate = localTasks.filter((lt) => {
        if (lt.id.startsWith('temp-')) return false
        const saved = savedTasks.find((st) => st.id === lt.id)
        if (!saved) return false
        return (
          lt.title !== saved.title ||
          lt.notes !== saved.notes ||
          lt.status !== saved.status
        )
      })

      // Thực hiện các API calls xóa
      if (tasksToDelete.length > 0) {
        const deleteIds = tasksToDelete.map((t) => t.id)
        const { error } = await supabase.from('tasks').delete().in('id', deleteIds)
        if (error) throw error

        for (const t of tasksToDelete) {
          await supabase.from('activity_logs').insert({
            actor_id: currentUser.id,
            action: 'deleted_task',
            entity_type: 'task',
            entity_id: t.id,
            entity_name: t.title,
            project_id: project.id,
            metadata: {},
          })
        }
      }

      // Thực hiện các API calls thêm mới
      let insertedData: Task[] = []
      if (tasksToInsert.length > 0) {
        const insertPayload = tasksToInsert.map((t, idx) => ({
          project_id: project.id,
          title: t.title.trim(),
          status: t.status,
          notes: t.notes?.trim() || null,
          priority: 'medium',
          progress: t.status === 'done' ? 100 : 0,
          column_order: savedTasks.length + idx,
          created_by: currentUser.id,
        }))

        const { data, error } = await supabase
          .from('tasks')
          .insert(insertPayload)
          .select()

        if (error) throw error
        insertedData = data as Task[]

        for (const t of insertedData) {
          await supabase.from('activity_logs').insert({
            actor_id: currentUser.id,
            action: 'created_task',
            entity_type: 'task',
            entity_id: t.id,
            entity_name: t.title,
            project_id: project.id,
            metadata: {},
          })
        }
      }

      // Thực hiện các API calls cập nhật
      if (tasksToUpdate.length > 0) {
        for (const t of tasksToUpdate) {
          const { error } = await supabase
            .from('tasks')
            .update({
              title: t.title.trim(),
              notes: t.notes?.trim() || null,
              status: t.status,
              progress: t.status === 'done' ? 100 : 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', t.id)

          if (error) throw error

          const saved = savedTasks.find((st) => st.id === t.id)
          if (saved && saved.status !== t.status) {
            await supabase.from('activity_logs').insert({
              actor_id: currentUser.id,
              action: t.status === 'done' ? 'completed_task' : 'moved_task',
              entity_type: 'task',
              entity_id: t.id,
              entity_name: t.title,
              project_id: project.id,
              metadata: { new_status: t.status },
            })
          }
        }
      }

      toast.success('Đã lưu thay đổi thành công!')

      // Cập nhật lại state lưu trữ cục bộ
      const nextSavedTasks = [
        ...localTasks.filter((lt) => !lt.id.startsWith('temp-')),
        ...insertedData,
      ]
      setSavedTasks(nextSavedTasks)
      setLocalTasks(nextSavedTasks)

      // Cập nhật router để render lại các component cha (thanh tiến độ dự án)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cảnh báo quyền chỉnh sửa */}
      {!hasEditPermission && (
        <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5 flex items-center gap-3 text-amber-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs">
            Bạn chỉ có quyền xem checklist này. Chỉ có admin và người có trách nhiệm thực hiện dự án mới được quyền thay đổi.
          </p>
        </div>
      )}

      {/* Tiến độ tổng (chỉ cập nhật sau khi lưu xong) */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">
            Tiến độ checklist:{' '}
            <span className="text-white font-bold">
              {doneCount}/{totalCount}
            </span>{' '}
            công việc
          </span>
          <span className="text-lg font-bold text-cyan-400">{pct}%</span>
        </div>
        <ProgressBar value={pct} showLabel={false} />
        {isDirty && (
          <p className="text-[11px] text-amber-400/80 mt-2 flex items-center gap-1 font-medium">
            ⚠️ Có thay đổi chưa lưu. Hãy lưu ở phía dưới để cập nhật tiến độ.
          </p>
        )}
      </div>

      {/* Danh sách chưa hoàn thành */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <span className="text-sm font-semibold text-slate-200">
              Cần làm ({pendingTasks.length})
            </span>
          </div>
        </div>

        <ul className="divide-y divide-white/5 bg-slate-950/20">
          {pendingTasks.map((task) => (
            <TaskChecklistRow
              key={task.id}
              task={task}
              projectName={project.name}
              hasEditPermission={hasEditPermission}
              onToggle={handleToggleStatus}
              onUpdateTitle={handleUpdateField}
              onUpdateNotes={handleUpdateField}
              onDelete={handleDeleteLocal}
            />
          ))}
          {pendingTasks.length === 0 && (
            <li className="px-5 py-6 text-center text-xs text-slate-500">
              Không có công việc nào cần làm.
            </li>
          )}
        </ul>
      </div>

      {/* Danh sách đã hoàn thành */}
      <div className="glass-card overflow-hidden opacity-85">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
            <span className="text-sm font-semibold text-slate-400">
              Đã hoàn thành ({completedTasks.length})
            </span>
          </div>
        </div>

        <ul className="divide-y divide-white/5 bg-slate-950/20">
          {completedTasks.map((task) => (
            <TaskChecklistRow
              key={task.id}
              task={task}
              projectName={project.name}
              hasEditPermission={hasEditPermission}
              onToggle={handleToggleStatus}
              onUpdateTitle={handleUpdateField}
              onUpdateNotes={handleUpdateField}
              onDelete={handleDeleteLocal}
            />
          ))}
          {completedTasks.length === 0 && (
            <li className="px-5 py-6 text-center text-xs text-slate-500">
              Chưa có công việc nào được hoàn thành.
            </li>
          )}
        </ul>
      </div>

      {/* Nút thêm công việc & Nút lưu thay đổi */}
      {hasEditPermission && (
        <div className="space-y-4 pt-2">
          <button
            id="checklist-add-task-btn"
            onClick={handleAddTask}
            className="w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/[0.02] active:scale-[0.99] transition-all text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Thêm công việc mới
          </button>

          <div className="flex justify-end border-t border-white/10 pt-4">
            <button
              id="checklist-save-btn"
              onClick={handleSave}
              disabled={!isDirty || saving || isPending}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                isDirty && !saving && !isPending
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 hover:scale-[1.02] cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------
// Sub-component: Dòng hiển thị checklist công việc
// ---------------------------------------------------------
interface TaskChecklistRowProps {
  task: Task
  projectName: string
  hasEditPermission: boolean
  onToggle: (id: string) => void
  onUpdateTitle: (id: string, field: 'title' | 'notes', value: string) => void
  onUpdateNotes: (id: string, field: 'title' | 'notes', value: string) => void
  onDelete: (id: string) => void
}

function TaskChecklistRow({
  task,
  projectName,
  hasEditPermission,
  onToggle,
  onUpdateTitle,
  onUpdateNotes,
  onDelete,
}: TaskChecklistRowProps) {
  const isDone = task.status === 'done'

  return (
    <li
      id={`checklist-task-${task.id}`}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02] ${
        isDone ? 'opacity-70 bg-white/[0.005]' : ''
      }`}
    >
      {/* Checkbox & Project Name Badge */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          id={`checklist-toggle-${task.id}`}
          onClick={() => hasEditPermission && onToggle(task.id)}
          disabled={!hasEditPermission}
          className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
            isDone
              ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'border-slate-600 hover:border-cyan-400/80 bg-slate-900/50'
          } ${!hasEditPermission ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          title={isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
        >
          {isDone && (
            <svg
              className="w-3.5 h-3.5 stroke-[3px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Project Name Badge */}
        <span className="text-[9px] uppercase tracking-wider font-bold bg-cyan-950/60 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-md select-none">
          {projectName}
        </span>
      </div>

      {/* Task Title Input or Static View */}
      <div className="flex-1 min-w-0">
        {hasEditPermission ? (
          <input
            id={`checklist-title-input-${task.id}`}
            type="text"
            value={task.title}
            onChange={(e) => onUpdateTitle(task.id, 'title', e.target.value)}
            placeholder="Nhập tên công việc..."
            className={`w-full bg-transparent border-b border-transparent focus:border-cyan-500/30 outline-none text-sm text-white py-1 transition-all ${
              isDone ? 'line-through text-slate-500' : ''
            }`}
          />
        ) : (
          <p
            className={`text-sm font-medium truncate ${
              isDone ? 'line-through text-slate-500' : 'text-slate-200'
            }`}
          >
            {task.title || '(Trống)'}
          </p>
        )}
      </div>

      {/* Note input or badge */}
      <div className="flex items-center gap-3 justify-between sm:justify-end flex-shrink-0">
        <div className="flex-1 sm:flex-initial">
          {hasEditPermission ? (
            <textarea
              id={`checklist-notes-input-${task.id}`}
              value={task.notes || ''}
              onChange={(e) => onUpdateNotes(task.id, 'notes', e.target.value)}
              placeholder="Thêm ghi chú..."
              rows={1}
              className="w-full sm:w-64 bg-slate-900/60 border border-slate-800 focus:border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none transition-all resize-y min-h-[32px] max-h-[120px] leading-normal"
            />
          ) : (
            task.notes && (
              <span className="max-w-[250px] whitespace-pre-wrap break-words bg-slate-900/40 border border-slate-800/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 block">
                {task.notes}
              </span>
            )
          )}
        </div>

        {/* Nút xóa */}
        {hasEditPermission && (
          <button
            type="button"
            id={`checklist-delete-${task.id}`}
            onClick={() => onDelete(task.id)}
            className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-all"
            title="Xóa công việc này"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  )
}
