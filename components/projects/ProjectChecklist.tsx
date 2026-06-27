'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Profile, Project } from '@/lib/types'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectChecklistProps {
  tasks: Task[]
  project: Project
  currentUser: Profile
  projectMembers: Profile[]
  allProfiles: Profile[]
  onSaveSuccess?: (tasks: Task[], project: Project) => void
}

const DIVIDER = '<!--admin-notes-divider-->'
const NOTE_DIVIDER = '|notes-divider|'

export function ProjectChecklist({
  tasks: initialTasks,
  project,
  currentUser,
  projectMembers,
  allProfiles,
  onSaveSuccess,
}: ProjectChecklistProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  // Parse notes from project description
  const parseNotes = (description: string | null) => {
    const desc = description || ''
    const parts = desc.split(DIVIDER)
    return {
      executor: parts[0] || '',
      admin: parts[1] || '',
    }
  }

  const initialNotes = parseNotes(project.description)

  const [savedTasks, setSavedTasks] = useState<Task[]>(initialTasks)
  const [localTasks, setLocalTasks] = useState<Task[]>(initialTasks)
  const [executorNotes, setExecutorNotes] = useState<string>(initialNotes.executor)
  const [adminNotes, setAdminNotes] = useState<string>(initialNotes.admin)
  const [saving, setSaving] = useState(false)

  // Ref for isDirty to access it in useEffect callbacks without resetting the effect
  const isDirtyRef = useRef(false)

  // Quyền chỉnh sửa chung cho các mục task công việc
  const isProjectMember = projectMembers.some((m) => m.id === currentUser.id)
  const isCreator = project.created_by === currentUser.id
  const isAdmin = currentUser.role === 'admin'
  const hasEditPermission = isAdmin || isProjectMember || isCreator

  // Quyền ghi chú riêng biệt
  const canEditExecutorNotes = !isAdmin && (isProjectMember || isCreator)
  const canEditAdminNotes = isAdmin

  // Quyền lưu thay đổi
  const canSave = hasEditPermission || canEditExecutorNotes || canEditAdminNotes

  // Kiểm tra xem localTasks có thay đổi so với savedTasks hay không
  const hasTasksChanged = () => {
    if (localTasks.length !== savedTasks.length) return true

    for (const local of localTasks) {
      const saved = savedTasks.find((s) => s.id === local.id)
      if (!saved) return true // Task mới

      if (local.title !== saved.title) return true
      if ((local.notes || '') !== (saved.notes || '')) return true
      if (local.start_date !== saved.start_date) return true
      if (local.deadline !== saved.deadline) return true
      if (local.status !== saved.status) return true
      if (local.assignee_id !== saved.assignee_id) return true
    }

    for (const saved of savedTasks) {
      if (!localTasks.some((l) => l.id === saved.id)) return true
    }

    return false
  }

  const hasExecutorNotesChanged = executorNotes.trim() !== initialNotes.executor.trim()
  const hasAdminNotesChanged = adminNotes.trim() !== initialNotes.admin.trim()
  
  const isDirty =
    hasTasksChanged() ||
    (canEditExecutorNotes && hasExecutorNotesChanged) ||
    (canEditAdminNotes && hasAdminNotesChanged)

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  // Sync with prop updates from parent (Realtime parent updates)
  useEffect(() => {
    setSavedTasks(initialTasks)
    if (!isDirtyRef.current) {
      setLocalTasks(initialTasks)
    } else {
      toast('🔄 Danh sách công việc đã được người khác cập nhật!', {
        icon: 'ℹ️',
        duration: 3000,
      })
    }
  }, [initialTasks])

  useEffect(() => {
    const updatedNotes = parseNotes(project.description)
    if (!isDirtyRef.current) {
      setExecutorNotes(updatedNotes.executor)
      setAdminNotes(updatedNotes.admin)
    } else {
      toast('🔄 Ghi chú dự án đã được người khác cập nhật!', {
        icon: 'ℹ️',
        duration: 3000,
      })
    }
  }, [project.description])

  // Phân chia localTasks thành 3 mục: Cần làm, Đã hủy và Đã hoàn thành
  const pendingTasks = localTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const cancelledTasks = localTasks.filter((t) => t.status === 'cancelled')
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
      start_date: null,
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
  const handleUpdateField = (
    id: string,
    field: 'title' | 'notes' | 'start_date' | 'deadline' | 'assignee_id',
    value: string | null
  ) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }

  // Toggle status của task trong local state (giữa done và todo)
  const handleToggleStatus = (id: string) => {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === 'done' ? 'todo' : 'done' }
          : t
      )
    )
  }

  // Toggle status hủy của task
  const handleToggleCancel = (id: string) => {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === 'cancelled' ? 'todo' : 'cancelled' }
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
    if (!canSave) return

    // Validation: Không cho phép để trống tên công việc
    const hasEmptyTitle = localTasks.some((t) => !t.title.trim())
    if (hasEmptyTitle) {
      toast.error('Vui lòng điền đầy đủ tên cho các công việc')
      return
    }

    setSaving(true)
    let combinedNotes = project.description || ''
    
    try {
      // 1. Lưu ghi chú dự án nếu có thay đổi
      if (hasExecutorNotesChanged || hasAdminNotesChanged) {
        const finalExecutor = canEditExecutorNotes ? executorNotes.trim() : initialNotes.executor.trim()
        const finalAdmin = canEditAdminNotes ? adminNotes.trim() : initialNotes.admin.trim()
        combinedNotes = `${finalExecutor}${DIVIDER}${finalAdmin}`

        const { error: projectError } = await supabase
          .from('projects')
          .update({
            description: combinedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id)

        if (projectError) throw projectError
      }

      // 2. Xác định các task cần xóa (chỉ thực hiện nếu có quyền hasEditPermission)
      let insertedData: Task[] = []
      if (hasEditPermission) {
        const tasksToDelete = savedTasks.filter(
          (st) => !localTasks.some((lt) => lt.id === st.id)
        )

        // 3. Xác định các task cần thêm mới
        const tasksToInsert = localTasks.filter((lt) => lt.id.startsWith('temp-'))

        // 4. Xác định các task cần cập nhật
        const tasksToUpdate = localTasks.filter((lt) => {
          if (lt.id.startsWith('temp-')) return false
          const saved = savedTasks.find((st) => st.id === lt.id)
          if (!saved) return false
          return (
            lt.title !== saved.title ||
            lt.status !== saved.status ||
            (lt.notes || '') !== (saved.notes || '') ||
            lt.start_date !== saved.start_date ||
            lt.deadline !== saved.deadline ||
            lt.assignee_id !== saved.assignee_id
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
        if (tasksToInsert.length > 0) {
          const insertPayload = tasksToInsert.map((t, idx) => ({
            project_id: project.id,
            title: t.title.trim(),
            status: t.status,
            assignee_id: t.assignee_id,
            notes: t.notes ? t.notes.trim() : null,
            start_date: t.start_date,
            deadline: t.deadline,
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
                status: t.status,
                assignee_id: t.assignee_id,
                notes: t.notes ? t.notes.trim() : null,
                start_date: t.start_date,
                deadline: t.deadline,
                progress: t.status === 'done' ? 100 : 0,
                updated_at: new Date().toISOString(),
              })
              .eq('id', t.id)

            if (error) throw error

            const saved = savedTasks.find((st) => st.id === t.id)
            if (saved && saved.status !== t.status) {
              await supabase.from('activity_logs').insert({
                actor_id: currentUser.id,
                action: t.status === 'done' ? 'completed_task' : t.status === 'cancelled' ? 'cancelled_task' : 'moved_task',
                entity_type: 'task',
                entity_id: t.id,
                entity_name: t.title,
                project_id: project.id,
                metadata: { new_status: t.status },
              })
            }
          }
        }
      }

      toast.success('Đã lưu thay đổi thành công!')

      // Cập nhật lại state lưu trữ cục bộ
      const nextSavedTasks = hasEditPermission
        ? [
            ...localTasks.filter((lt) => !lt.id.startsWith('temp-')),
            ...insertedData,
          ]
        : savedTasks

      setSavedTasks(nextSavedTasks)
      setLocalTasks(nextSavedTasks)

      // Cập nhật state ở component cha ngay lập tức (không cần chờ router.refresh)
      if (onSaveSuccess) {
        const updatedProject = {
          ...project,
          description: combinedNotes,
        }
        onSaveSuccess(nextSavedTasks, updatedProject)
      }

      // Cập nhật router để đồng bộ với server component
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
      {!hasEditPermission && !canEditExecutorNotes && !canEditAdminNotes && (
        <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5 flex items-center gap-3 text-amber-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs">
            Bạn chỉ có quyền xem chi tiết dự án. Chỉ có admin và người có trách nhiệm thực hiện dự án mới được quyền thay đổi.
          </p>
        </div>
      )}

      {/* Thông báo có thay đổi chưa lưu */}
      {isDirty && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-medium">
          ⚠️ Bạn đang có thay đổi chưa lưu (công việc hoặc ghi chú). Vui lòng lưu ở dưới để cập nhật tiến độ của dự án.
        </div>
      )}

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
              allProfiles={allProfiles}
              onToggle={handleToggleStatus}
              onToggleCancel={handleToggleCancel}
              onUpdateField={handleUpdateField}
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

      {/* Danh sách đã hủy */}
      <div className="glass-card overflow-hidden opacity-90">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
            <span className="text-sm font-semibold text-slate-300">
              Đã hủy / Tạm dừng ({cancelledTasks.length})
            </span>
          </div>
        </div>

        <ul className="divide-y divide-white/5 bg-slate-950/20">
          {cancelledTasks.map((task) => (
            <TaskChecklistRow
              key={task.id}
              task={task}
              projectName={project.name}
              hasEditPermission={hasEditPermission}
              allProfiles={allProfiles}
              onToggle={handleToggleStatus}
              onToggleCancel={handleToggleCancel}
              onUpdateField={handleUpdateField}
              onDelete={handleDeleteLocal}
            />
          ))}
          {cancelledTasks.length === 0 && (
            <li className="px-5 py-6 text-center text-xs text-slate-500">
              Không có công việc nào bị hủy / tạm dừng.
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
              allProfiles={allProfiles}
              onToggle={handleToggleStatus}
              onToggleCancel={handleToggleCancel}
              onUpdateField={handleUpdateField}
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

      {/* Nút thêm công việc mới */}
      {hasEditPermission && (
        <button
          id="checklist-add-task-btn"
          onClick={handleAddTask}
          className="w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/[0.02] active:scale-[0.99] transition-all text-xs font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Thêm công việc mới
        </button>
      )}

      {/* Ghi chú dự án */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
        <div className="glass-card p-5 relative overflow-hidden flex flex-col min-h-[180px]">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="executor-notes-textarea"
              className="text-xs font-semibold text-slate-300 uppercase tracking-wider block"
            >
              Ghi chú của người thực hiện
            </label>
            {!canEditExecutorNotes && (
              <span className="text-[9px] bg-white/5 border border-white/10 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                Chỉ xem
              </span>
            )}
          </div>
          {canEditExecutorNotes ? (
            <textarea
              id="executor-notes-textarea"
              value={executorNotes}
              onChange={(e) => setExecutorNotes(e.target.value)}
              placeholder="Nhập ghi chú của người thực hiện dự án tại đây..."
              rows={4}
              className="w-full flex-grow bg-slate-900/60 border border-slate-800 focus:border-cyan-500/30 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all resize-y leading-relaxed"
            />
          ) : (
            <div className="w-full flex-grow bg-slate-900/20 border border-slate-900/50 rounded-xl p-3 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
              {executorNotes || '(Trống)'}
            </div>
          )}
        </div>

        <div className="glass-card p-5 relative overflow-hidden flex flex-col min-h-[180px]">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="admin-notes-textarea"
              className="text-xs font-semibold text-slate-300 uppercase tracking-wider block"
            >
              Ý kiến / Ghi chú của Admin
            </label>
            {!canEditAdminNotes && (
              <span className="text-[9px] bg-white/5 border border-white/10 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                Chỉ xem
              </span>
            )}
          </div>
          {canEditAdminNotes ? (
            <textarea
              id="admin-notes-textarea"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Nhập ý kiến chỉ đạo hoặc ghi chú của Admin tại đây..."
              rows={4}
              className="w-full flex-grow bg-slate-900/60 border border-slate-800 focus:border-amber-500/30 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all resize-y leading-relaxed"
            />
          ) : (
            <div className="w-full flex-grow bg-slate-900/20 border border-slate-900/50 rounded-xl p-3 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
              {adminNotes || '(Trống)'}
            </div>
          )}
        </div>
      </div>

      {/* Nút lưu */}
      {canSave && (
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
  allProfiles: Profile[]
  onToggle: (id: string) => void
  onToggleCancel: (id: string) => void
  onUpdateField: (
    id: string,
    field: 'title' | 'notes' | 'start_date' | 'deadline' | 'assignee_id',
    value: string | null
  ) => void
  onDelete: (id: string) => void
}

function TaskChecklistRow({
  task,
  projectName,
  hasEditPermission,
  allProfiles,
  onToggle,
  onToggleCancel,
  onUpdateField,
  onDelete,
}: TaskChecklistRowProps) {
  const isDone = task.status === 'done'
  const isCancelled = task.status === 'cancelled'

  // Parse notes to array of string split by '|notes-divider|'
  const noteLines = task.notes ? task.notes.split(NOTE_DIVIDER) : ['']

  return (
    <li
      id={`checklist-task-${task.id}`}
      className={`flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-white/[0.02] ${
        isDone ? 'opacity-70 bg-white/[0.005]' : ''
      } ${isCancelled ? 'opacity-80 bg-red-950/[0.02]' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox (Complete/Incomplete) */}
        <button
          type="button"
          id={`checklist-toggle-${task.id}`}
          onClick={() => hasEditPermission && !isCancelled && onToggle(task.id)}
          disabled={!hasEditPermission || isCancelled}
          className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
            isDone
              ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'border-slate-600 hover:border-cyan-400/80 bg-slate-900/50'
          } ${(!hasEditPermission || isCancelled) ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          title={isCancelled ? 'Công việc đã hủy không thể hoàn thành' : isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
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
        <span className="text-[9px] uppercase tracking-wider font-bold bg-cyan-950/60 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-md select-none flex-shrink-0">
          {projectName}
        </span>

        {/* Task Title Input */}
        <div className="flex-1 min-w-0">
          {hasEditPermission ? (
            <input
              id={`checklist-title-input-${task.id}`}
              type="text"
              value={task.title}
              onChange={(e) => onUpdateField(task.id, 'title', e.target.value)}
              placeholder="Nhập tên công việc..."
              disabled={isCancelled || isDone}
              className={`w-full bg-transparent border-b border-transparent focus:border-cyan-500/30 outline-none text-sm text-white py-0.5 transition-all ${
                isDone ? 'line-through text-slate-500' : ''
              } ${isCancelled ? 'line-through text-red-400/70' : ''} ${(isCancelled || isDone) ? 'opacity-85' : ''}`}
            />
          ) : (
            <p
              className={`text-sm font-medium truncate ${
                isDone ? 'line-through text-slate-500' : ''
              } ${isCancelled ? 'line-through text-red-400/70' : 'text-slate-200'}`}
            >
              {task.title || '(Trống)'}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Nút Hủy */}
          {hasEditPermission && (
            <button
              type="button"
              id={`checklist-cancel-${task.id}`}
              onClick={() => onToggleCancel(task.id)}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 active:scale-[0.97] cursor-pointer',
                isCancelled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/20'
              )}
              title={isCancelled ? 'Khôi phục công việc' : 'Hủy công việc'}
            >
              {isCancelled ? 'Khôi phục' : 'Hủy bỏ'}
            </button>
          )}

          {/* Nút xóa */}
          {hasEditPermission && (
            <button
              type="button"
              id={`checklist-delete-${task.id}`}
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn xóa công việc này không?')) {
                  onDelete(task.id)
                }
              }}
              className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-all cursor-pointer"
              title="Xóa công việc"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Details: Notes List, Start Date, End Date, Assignee Dropdown */}
      <div className="pl-8 flex flex-col gap-3 mt-2 border-l border-white/5 pb-1">
        {/* Notes (Multi-row with + icon to add new note row) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-medium">Ghi chú công việc:</span>
            {hasEditPermission && !isCancelled && !isDone && (
              <button
                type="button"
                onClick={() => {
                  const newNotes = [...noteLines, '']
                  onUpdateField(task.id, 'notes', newNotes.join(NOTE_DIVIDER))
                }}
                className="text-cyan-400 hover:text-cyan-300 text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer hover:underline"
              >
                <Plus size={11} /> Thêm dòng ghi chú
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {noteLines.map((note, index) => (
              <div key={index} className="flex items-center gap-2">
                {hasEditPermission ? (
                  <input
                    type="text"
                    value={note}
                    disabled={isCancelled || isDone}
                    onChange={(e) => {
                      const newLines = [...noteLines]
                      newLines[index] = e.target.value
                      onUpdateField(task.id, 'notes', newLines.join(NOTE_DIVIDER))
                    }}
                    placeholder="Ghi chú thêm cho công việc..."
                    className="flex-grow bg-transparent border-b border-white/5 focus:border-cyan-500/20 outline-none text-xs text-slate-400 py-0.5 transition-all placeholder-slate-600 disabled:opacity-60"
                  />
                ) : (
                  <p className="text-xs text-slate-400 italic flex-grow">
                    • {note || '(Ghi chú trống)'}
                  </p>
                )}

                {hasEditPermission && !isCancelled && !isDone && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const newLines = [...noteLines]
                        newLines.splice(index + 1, 0, '')
                        onUpdateField(task.id, 'notes', newLines.join(NOTE_DIVIDER))
                      }}
                      className="text-cyan-500 hover:text-cyan-400 p-0.5 rounded cursor-pointer hover:bg-cyan-500/10 transition-colors"
                      title="Chèn dòng ghi chú ngay dưới dòng này"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    {noteLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newLines = noteLines.filter((_, idx) => idx !== index)
                          onUpdateField(task.id, 'notes', newLines.join(NOTE_DIVIDER))
                        }}
                        className="text-slate-600 hover:text-rose-400 p-0.5 rounded cursor-pointer hover:bg-rose-500/10 transition-colors"
                        title="Xóa dòng ghi chú này"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Date pickers & Assignee Selector */}
        <div className="flex flex-wrap gap-4 items-center pt-1">
          {/* Assignee selector dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Chỉ định:</span>
            {hasEditPermission ? (
              <select
                value={task.assignee_id || ''}
                disabled={isCancelled || isDone}
                onChange={(e) => onUpdateField(task.id, 'assignee_id', e.target.value || null)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 outline-none focus:border-cyan-500/30 disabled:opacity-60 cursor-pointer"
              >
                <option value="">-- Chưa chỉ định --</option>
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role === 'admin' ? 'Admin' : p.role === 'leader' ? 'Leader' : 'Member'})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] text-slate-300">
                {allProfiles.find(p => p.id === task.assignee_id)?.full_name || 'Chưa chỉ định'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Bắt đầu:</span>
            {hasEditPermission ? (
              <input
                type="date"
                value={task.start_date ? task.start_date.substring(0, 10) : ''}
                disabled={isCancelled || isDone}
                onChange={(e) => onUpdateField(task.id, 'start_date', e.target.value || null)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 outline-none focus:border-cyan-500/30 disabled:opacity-60 cursor-pointer"
              />
            ) : (
              <span className="text-[11px] text-slate-300">
                {task.start_date ? task.start_date.substring(0, 10) : 'Chưa đặt'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Kết thúc:</span>
            {hasEditPermission ? (
              <input
                type="date"
                value={task.deadline ? task.deadline.substring(0, 10) : ''}
                disabled={isCancelled || isDone}
                onChange={(e) => onUpdateField(task.id, 'deadline', e.target.value || null)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 outline-none focus:border-cyan-500/30 disabled:opacity-60 cursor-pointer"
              />
            ) : (
              <span className="text-[11px] text-slate-300">
                {task.deadline ? task.deadline.substring(0, 10) : 'Chưa đặt'}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
