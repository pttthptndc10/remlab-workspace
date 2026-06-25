'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { TaskModal } from '@/components/tasks/TaskModal'
import { formatDate, isOverdue, TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import type { Task, Profile, TaskStatus, TaskPriority, Project } from '@/lib/types'
import { Calendar, Search, Filter } from 'lucide-react'

interface TasksClientProps {
  tasks: Task[]
  projects: Project[]
  profiles: Profile[]
  currentUser: Profile
}

export function TasksClient({ tasks, projects, profiles, currentUser }: TasksClientProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('')
  const [projectFilter, setProjectFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  const taskStatuses: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']
  const priorities: TaskPriority[] = ['low', 'medium', 'high', 'critical']

  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter ? t.status === statusFilter : true
    const matchPriority = priorityFilter ? t.priority === priorityFilter : true
    const matchProject = projectFilter ? t.project_id === projectFilter : true
    const matchAssignee = assigneeFilter ? t.assignee_id === assigneeFilter : true
    return matchSearch && matchStatus && matchPriority && matchProject && matchAssignee
  })

  const projectMembersForTask = (task: Task) => {
    const project = projects.find((p) => p.id === task.project_id)
    return profiles.filter((p) =>
      (project?.members ?? []).some((pm) => pm.member_id === p.id)
    )
  }

  return (
    <DashboardShell title="Tasks" subtitle={`${tasks.length} tasks tổng cộng`}>
      <div className="space-y-4 animate-fade-in">
        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="tasks-search"
                type="text"
                placeholder="Tìm task..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-dark w-full pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                id="tasks-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
                className="input-dark"
              >
                <option value="">Tất cả trạng thái</option>
                {taskStatuses.map((s) => (
                  <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select
                id="tasks-priority-filter"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
                className="input-dark"
              >
                <option value="">Tất cả độ ưu tiên</option>
                {priorities.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
              <select
                id="tasks-project-filter"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="input-dark"
              >
                <option value="">Tất cả dự án</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                id="tasks-assignee-filter"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="input-dark"
              >
                <option value="">Tất cả người thực hiện</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Task</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Dự án</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Người thực hiện</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Trạng thái</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Ưu tiên</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Hạn chót</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden xl:table-cell">Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-500">
                      <div className="text-3xl mb-2">📋</div>
                      Không có task nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filtered.map((task) => {
                    const overdue = isOverdue(task.deadline, task.status)
                    const project = projects.find((p) => p.id === task.project_id)
                    return (
                      <tr
                        key={task.id}
                        id={`task-row-${task.id}`}
                        onClick={() => setSelectedTask(task)}
                        className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-slate-400 truncate">{project?.name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-slate-400">
                            {task.assignee?.full_name ?? <span className="text-slate-600">Chưa giao</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={task.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge priority={task.priority} size="sm" />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-rose-400' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.deadline)}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="w-24">
                            <ProgressBar value={task.progress} size="sm" />
                            <span className="text-xs text-slate-500 mt-0.5 block">{task.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-slate-500 text-center">
          Hiển thị {filtered.length}/{tasks.length} tasks
        </p>
      </div>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          currentUser={currentUser}
          projectMembers={projectMembersForTask(selectedTask)}
        />
      )}
    </DashboardShell>
  )
}
