'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import type { ProjectWithStats, Profile, UserRole, ProjectStatus, ProjectPriority } from '@/lib/types'
import { PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import { Search, Filter } from 'lucide-react'

interface ProjectsClientProps {
  projects: ProjectWithStats[]
  allMembers: Profile[]
  currentUserRole?: UserRole
}

export function ProjectsClient({ projects, allMembers, currentUserRole }: ProjectsClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editProject, setEditProject] = useState<ProjectWithStats | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | ''>('')

  const isAdminOrLeader = currentUserRole === 'admin' || currentUserRole === 'leader'
  const isAdmin = currentUserRole === 'admin'

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) {
      toast.error('Xóa thất bại: ' + error.message)
    } else {
      toast.success('Đã xóa dự án')
      router.refresh()
    }
  }

  const filtered = projects.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter ? p.status === statusFilter : true
    const matchPriority = priorityFilter ? p.priority === priorityFilter : true
    return matchSearch && matchStatus && matchPriority
  })

  const statuses: ProjectStatus[] = ['planning', 'in_progress', 'review', 'completed', 'paused']
  const priorities: ProjectPriority[] = ['low', 'medium', 'high', 'critical']

  return (
    <DashboardShell
      title="Dự án"
      subtitle={`${projects.length} dự án`}
      actions={
        isAdminOrLeader ? (
          <button
            id="btn-create-project"
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Tạo dự án
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5 animate-fade-in">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="projects-search"
              type="text"
              placeholder="Tìm dự án..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark w-full pl-9"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select
                id="projects-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | '')}
                className="input-dark pl-8 pr-3"
              >
                <option value="">Tất cả trạng thái</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <select
              id="projects-priority-filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as ProjectPriority | '')}
              className="input-dark"
            >
              <option value="">Tất cả độ ưu tiên</option>
              {priorities.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <div className="text-4xl mb-3">📁</div>
            <h3 className="text-lg font-semibold text-white mb-2">Không có dự án nào</h3>
            <p className="text-slate-400 text-sm">
              {search || statusFilter || priorityFilter
                ? 'Không tìm thấy dự án phù hợp với bộ lọc.'
                : 'Chưa có dự án nào. Hãy tạo dự án đầu tiên!'}
            </p>
            {isAdminOrLeader && !search && (
              <button
                id="btn-create-project-empty"
                onClick={() => setShowCreate(true)}
                className="btn-primary mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tạo dự án mới
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                currentUserRole={currentUserRole}
                onEdit={isAdminOrLeader ? () => setEditProject(p) : undefined}
                onDelete={isAdmin ? () => handleDelete(p.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tạo dự án mới"
        size="md"
      >
        <ProjectForm
          members={allMembers}
          onSuccess={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editProject}
        onClose={() => setEditProject(null)}
        title="Chỉnh sửa dự án"
        size="md"
      >
        {editProject && (
          <ProjectForm
            project={editProject}
            members={allMembers}
            onSuccess={() => setEditProject(null)}
            onCancel={() => setEditProject(null)}
          />
        )}
      </Modal>
    </DashboardShell>
  )
}
