'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { Project, Profile, ProjectStatus, ProjectPriority } from '@/lib/types'
import { PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import { X } from 'lucide-react'

interface ProjectFormProps {
  project?: Project
  members: Profile[]
  onSuccess: () => void
  onCancel: () => void
}

export function ProjectForm({ project, members, onSuccess, onCancel }: ProjectFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!project

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    deadline: project?.deadline ? project.deadline.slice(0, 10) : '',
    status: (project?.status ?? 'planning') as ProjectStatus,
    priority: (project?.priority ?? 'medium') as ProjectPriority,
    memberIds: (project?.members ?? []).map((m) => m.member_id),
  })

  const toggleMember = (id: string) => {
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((m) => m !== id)
        : [...prev.memberIds, id],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Tên dự án không được để trống')
      return
    }

    setLoading(true)
    try {
      let projectId = project?.id

      if (isEdit) {
        const { error } = await supabase
          .from('projects')
          .update({
            name: form.name.trim(),
            description: form.description.trim() || null,
            deadline: form.deadline || null,
            status: form.status,
            priority: form.priority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project!.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: form.name.trim(),
            description: form.description.trim() || null,
            deadline: form.deadline || null,
            status: form.status,
            priority: form.priority,
            created_by: user?.id ?? null,
          })
          .select()
          .single()
        if (error) throw error
        projectId = data.id

        // Log activity
        await supabase.from('activity_logs').insert({
          actor_id: user?.id,
          action: 'created_project',
          entity_type: 'project',
          entity_id: projectId,
          entity_name: form.name.trim(),
          project_id: projectId,
          metadata: {},
        })
      }

      // Sync members
      if (projectId && form.memberIds.length > 0) {
        // Remove existing members first if editing
        if (isEdit) {
          await supabase.from('project_members').delete().eq('project_id', projectId)
        }
        // Insert selected members
        const memberRows = form.memberIds.map((mid) => ({
          project_id: projectId!,
          member_id: mid,
          role: 'member' as const,
        }))
        await supabase.from('project_members').insert(memberRows)
      }

      toast.success(isEdit ? 'Cập nhật dự án thành công!' : 'Tạo dự án thành công!')
      router.refresh()
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const projectStatuses: ProjectStatus[] = ['planning', 'in_progress', 'review', 'completed', 'paused']
  const priorities: ProjectPriority[] = ['low', 'medium', 'high', 'critical']

  return (
    <form id="project-form" onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="project-name" className="block text-sm font-medium text-slate-300 mb-1.5">
          Tên dự án <span className="text-rose-400">*</span>
        </label>
        <input
          id="project-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Nhập tên dự án..."
          className="input-dark w-full"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="project-description" className="block text-sm font-medium text-slate-300 mb-1.5">
          Mô tả
        </label>
        <textarea
          id="project-description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Mô tả dự án..."
          rows={3}
          className="input-dark w-full resize-none"
        />
      </div>

      {/* Status + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="project-status" className="block text-sm font-medium text-slate-300 mb-1.5">
            Trạng thái
          </label>
          <select
            id="project-status"
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ProjectStatus }))}
            className="input-dark w-full"
          >
            {projectStatuses.map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="project-priority" className="block text-sm font-medium text-slate-300 mb-1.5">
            Độ ưu tiên
          </label>
          <select
            id="project-priority"
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as ProjectPriority }))}
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
        <label htmlFor="project-deadline" className="block text-sm font-medium text-slate-300 mb-1.5">
          Hạn chót
        </label>
        <input
          id="project-deadline"
          type="date"
          value={form.deadline}
          onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
          className="input-dark w-full"
        />
      </div>

      {/* Members */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">
          Thành viên ({form.memberIds.length} đã chọn)
        </p>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {members.map((m) => {
            const selected = form.memberIds.includes(m.id)
            return (
              <label
                key={m.id}
                htmlFor={`member-check-${m.id}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                  selected ? 'bg-cyan-500/15 border border-cyan-500/30' : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <input
                  id={`member-check-${m.id}`}
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleMember(m.id)}
                  className="rounded"
                />
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                  {m.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{m.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">{m.department ?? m.role}</p>
                </div>
                {selected && <X className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
              </label>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 border-t border-white/10">
        <button
          id="project-form-cancel"
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={loading}
        >
          Hủy
        </button>
        <button
          id="project-form-submit"
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo dự án'}
        </button>
      </div>
    </form>
  )
}
