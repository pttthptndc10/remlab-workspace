'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { MissionBlock } from '@/components/dashboard/MissionBlock'
import { Modal } from '@/components/ui/Modal'
import {
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Ban,
  Users,
  ListTodo,
  Clock,
  ArrowUpRight,
} from 'lucide-react'
import { formatDate, isOverdue } from '@/lib/utils'
import type { Project, Task, ActivityLog, Profile, ProjectWithStats } from '@/lib/types'

interface DashboardClientProps {
  projects: Project[]
  tasks: Task[]
  profiles: Profile[]
  activities: ActivityLog[]
  totalProjects: number
  activeProjects: number
  totalTasks: number
  completedTasksCount: number
  overdueTasksCount: number
  blockedTasksCount: number
  memberCount: number
  activeProjectsWithStats: ProjectWithStats[]
  activitiesContent: React.ReactNode
}

type ActiveModalType = 'total-projects' | 'active-projects' | 'total-tasks' | 'completed' | 'overdue-tasks' | 'blocked-tasks' | null

export function DashboardClient({
  projects,
  tasks,
  profiles,
  activities,
  totalProjects,
  activeProjects,
  totalTasks,
  completedTasksCount,
  overdueTasksCount,
  blockedTasksCount,
  memberCount,
  activeProjectsWithStats,
  activitiesContent
}: DashboardClientProps) {
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null)
  const [completedTab, setCompletedTab] = useState<'projects' | 'tasks'>('projects')

  // Filter lists for modal content
  const completedProjects = projects.filter(p => p.status === 'completed')
  const completedTasks = tasks.filter(t => t.status === 'done')
  const inProgressProjects = projects.filter(p => p.status === 'in_progress')
  const overdueTasks = tasks.filter(t => isOverdue(t.deadline, t.status))
  const blockedTasks = tasks.filter(t => t.status === 'blocked')

  const stats = [
    { 
      id: 'stat-total-projects', 
      title: 'Tổng dự án', 
      value: totalProjects, 
      icon: FolderKanban, 
      color: '#06b6d4',
      onClick: () => setActiveModal('total-projects')
    },
    { 
      id: 'stat-active-projects', 
      title: 'Đang thực hiện', 
      value: activeProjects, 
      icon: Clock, 
      color: '#8b5cf6',
      onClick: () => setActiveModal('active-projects')
    },
    { 
      id: 'stat-total-tasks', 
      title: 'Tổng task', 
      value: totalTasks, 
      icon: ListTodo, 
      color: '#3b82f6',
      onClick: () => setActiveModal('total-tasks')
    },
    { 
      id: 'stat-completed-tasks', 
      title: 'Hoàn thành', 
      value: completedTasksCount, 
      icon: CheckCircle2, 
      color: '#10b981',
      onClick: () => setActiveModal('completed')
    },
    { 
      id: 'stat-overdue-tasks', 
      title: 'Quá hạn', 
      value: overdueTasksCount, 
      icon: AlertCircle, 
      color: '#f59e0b',
      onClick: () => setActiveModal('overdue-tasks')
    },
    { 
      id: 'stat-blocked-tasks', 
      title: 'Bị chặn', 
      value: blockedTasksCount, 
      icon: Ban, 
      color: '#ef4444',
      onClick: () => setActiveModal('blocked-tasks')
    },
  ]

  const renderProjectList = (projectList: Project[]) => {
    if (projectList.length === 0) {
      return <p className="text-slate-500 text-sm text-center py-8">Không có dự án nào</p>
    }
    return (
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {projectList.map((p) => {
          const projectTasks = tasks.filter((t) => t.project_id === p.id)
          const completedCount = projectTasks.filter((t) => t.status === 'done').length
          const completionPercentage = projectTasks.length > 0
            ? Math.round((completedCount / projectTasks.length) * 100)
            : 0

          return (
            <a
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition-all group"
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1.5 truncate">
                  <FolderKanban className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  {p.name}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                </h4>
                {p.description && (
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {p.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge status={p.status} size="sm" />
                  <Badge priority={p.priority} size="sm" />
                  <span className="text-[10px] text-slate-500">
                    • {projectTasks.length} tasks
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                <div className="w-28">
                  <ProgressBar value={completionPercentage} showLabel size="sm" />
                </div>
                <span className="text-xs text-slate-500">
                  Hạn chót: {formatDate(p.deadline)}
                </span>
              </div>
            </a>
          )
        })}
      </div>
    )
  }

  const renderTaskList = (taskList: Task[]) => {
    if (taskList.length === 0) {
      return <p className="text-slate-500 text-sm text-center py-8">Không có task nào</p>
    }
    return (
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {taskList.map((t) => {
          const pName = projects.find(p => p.id === t.project_id)?.name || 'Dự án khác'
          return (
            <a
              key={t.id}
              href={`/projects/${t.project_id}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition-all group"
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors truncate flex items-center gap-1">
                  {t.title}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Dự án: <span className="text-cyan-400/80">{pName}</span>
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge status={t.status} size="sm" />
                  <Badge priority={t.priority} size="sm" />
                  {t.assignee && (
                    <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                      👤 {t.assignee.full_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-1.5 flex-shrink-0">
                <span className="text-xs font-semibold text-cyan-400">{t.progress}%</span>
                <span className={`text-[10px] ${isOverdue(t.deadline, t.status) ? 'text-rose-400 font-medium' : 'text-slate-500'}`}>
                  Hạn chót: {formatDate(t.deadline)}
                </span>
              </div>
            </a>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mission Block */}
      <MissionBlock
        memberCount={memberCount}
        projectCount={totalProjects}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <StatCard
            key={s.id}
            id={s.id}
            title={s.title}
            value={s.value}
            icon={s.icon}
            color={s.color}
            onClick={s.onClick}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        {activitiesContent}

        {/* Active Projects */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Dự án đang hoạt động</h3>
            <a
              href="/projects"
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Xem tất cả →
            </a>
          </div>

          {activeProjectsWithStats.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Không có dự án đang hoạt động</p>
          ) : (
            <div className="space-y-4">
              {activeProjectsWithStats.map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  id={`dashboard-project-${project.id}`}
                  className="block p-3 rounded-xl border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-white truncate">{project.name}</span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Badge status={project.status} size="sm" />
                      <Badge priority={project.priority} size="sm" />
                    </div>
                  </div>
                  <ProgressBar value={project.completionPercentage} showLabel size="sm" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500">
                      {project.completedTaskCount}/{project.taskCount} tasks
                    </span>
                    <span className="text-xs text-slate-500">
                      📅 {formatDate(project.deadline)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Members overview */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">Thành viên ({memberCount})</h3>
          </div>
          <a href="/members" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
            Xem tất cả →
          </a>
        </div>
        <div className="flex flex-wrap gap-3">
          {profiles.slice(0, 8).map((p) => (
            <a
              key={p.id}
              href={`/members/${p.id}`}
              id={`dashboard-member-${p.id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                {p.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-white">{p.full_name}</p>
                <Badge role={p.role} size="sm" />
              </div>
            </a>
          ))}
          {profiles.length > 8 && (
            <div className="flex items-center px-3 py-2 text-xs text-slate-400">
              +{profiles.length - 8} người khác
            </div>
          )}
        </div>
      </div>

      {/* Modals for stats */}
      <Modal
        isOpen={activeModal === 'total-projects'}
        onClose={() => setActiveModal(null)}
        title="Danh sách tất cả dự án"
        size="md"
      >
        {renderProjectList(projects)}
      </Modal>

      <Modal
        isOpen={activeModal === 'active-projects'}
        onClose={() => setActiveModal(null)}
        title="Dự án đang thực hiện"
        size="md"
      >
        {renderProjectList(inProgressProjects)}
      </Modal>

      <Modal
        isOpen={activeModal === 'total-tasks'}
        onClose={() => setActiveModal(null)}
        title="Danh sách tất cả task"
        size="md"
      >
        {renderTaskList(tasks)}
      </Modal>

      <Modal
        isOpen={activeModal === 'completed'}
        onClose={() => setActiveModal(null)}
        title="Nội dung đã hoàn thành"
        size="md"
      >
        <div className="flex gap-2 mb-4 p-0.5 bg-slate-900 border border-slate-800 rounded-xl flex-shrink-0">
          <button
            onClick={() => setCompletedTab('projects')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              completedTab === 'projects'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Dự án đã hoàn thành ({completedProjects.length})
          </button>
          <button
            onClick={() => setCompletedTab('tasks')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              completedTab === 'tasks'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Tasks đã hoàn thành ({completedTasks.length})
          </button>
        </div>
        {completedTab === 'projects' ? renderProjectList(completedProjects) : renderTaskList(completedTasks)}
      </Modal>

      <Modal
        isOpen={activeModal === 'overdue-tasks'}
        onClose={() => setActiveModal(null)}
        title="Task quá hạn"
        size="md"
      >
        {renderTaskList(overdueTasks)}
      </Modal>

      <Modal
        isOpen={activeModal === 'blocked-tasks'}
        onClose={() => setActiveModal(null)}
        title="Task bị chặn"
        size="md"
      >
        {renderTaskList(blockedTasks)}
      </Modal>
    </div>
  )
}
