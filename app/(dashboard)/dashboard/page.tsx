import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { StatCard } from '@/components/dashboard/StatCard'
import { MissionBlock } from '@/components/dashboard/MissionBlock'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import {
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Ban,
  Users,
  ListTodo,
  Clock,
} from 'lucide-react'
import { formatDate, formatActivityMessage, isOverdue } from '@/lib/utils'
import type { Project, Task, ActivityLog, Profile, ProjectWithStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch all data in parallel
  const [projectsResult, tasksResult, profilesResult, activitiesResult] = await Promise.all([
    supabase
      .from('projects')
      .select('*, creator:profiles(id, full_name, avatar_url, role), members:project_members(*, member:profiles(*))')
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('*, assignee:profiles(id, full_name, avatar_url, role)')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('full_name'),
    supabase
      .from('activity_logs')
      .select('*, actor:profiles(id, full_name, avatar_url, role), project:projects(id, name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const projects: Project[] = projectsResult.data ?? []
  const tasks: Task[] = tasksResult.data ?? []
  const profiles: Profile[] = profilesResult.data ?? []
  const activities: ActivityLog[] = activitiesResult.data ?? []

  // Compute stats
  const totalProjects = projects.length
  const activeProjects = projects.filter((p) => p.status === 'in_progress').length
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const overdueTasks = tasks.filter((t) => isOverdue(t.deadline, t.status)).length
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length
  const memberCount = profiles.length

  // Active projects with stats (max 4)
  const activeProjectsWithStats: ProjectWithStats[] = projects
    .filter((p) => p.status === 'in_progress' || p.status === 'review')
    .slice(0, 4)
    .map((p) => {
      const projectTasks = tasks.filter((t) => t.project_id === p.id)
      const completedCount = projectTasks.filter((t) => t.status === 'done').length
      const completionPercentage = projectTasks.length > 0
        ? Math.round((completedCount / projectTasks.length) * 100)
        : 0
      return {
        ...p,
        memberCount: (p.members ?? []).length,
        taskCount: projectTasks.length,
        completedTaskCount: completedCount,
        completionPercentage,
      }
    })

  const stats = [
    { id: 'stat-total-projects', title: 'Tổng dự án', value: totalProjects, icon: FolderKanban, color: '#06b6d4' },
    { id: 'stat-active-projects', title: 'Đang thực hiện', value: activeProjects, icon: Clock, color: '#8b5cf6' },
    { id: 'stat-total-tasks', title: 'Tổng task', value: totalTasks, icon: ListTodo, color: '#3b82f6' },
    { id: 'stat-completed-tasks', title: 'Hoàn thành', value: completedTasks, icon: CheckCircle2, color: '#10b981' },
    { id: 'stat-overdue-tasks', title: 'Quá hạn', value: overdueTasks, icon: AlertCircle, color: '#f59e0b' },
    { id: 'stat-blocked-tasks', title: 'Bị chặn', value: blockedTasks, icon: Ban, color: '#ef4444' },
  ]

  return (
    <DashboardShell title="Dashboard" subtitle="Tổng quan hoạt động RemLab">
      <div className="space-y-6 animate-fade-in">
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
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h3 className="text-base font-semibold text-white">Hoạt động gần đây</h3>
            </div>

            {activities.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Chưa có hoạt động nào</p>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-cyan-400">
                      {(act.actor?.full_name ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 leading-snug">
                        {formatActivityMessage(act.action, act.entity_name ?? '', act.actor?.full_name ?? 'Ai đó')}
                      </p>
                      {act.project && (
                        <p className="text-xs text-cyan-400/70 mt-0.5">📁 {act.project.name}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(act.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
      </div>
    </DashboardShell>
  )
}
