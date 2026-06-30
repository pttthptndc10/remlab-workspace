import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { formatDate, formatActivityMessage, isOverdue } from '@/lib/utils'
import type { Project, Task, ActivityLog, Profile, ProjectWithStats } from '@/lib/types'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

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
      .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, role)')
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

  const activitiesContent = (
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
  )

  return (
    <DashboardShell title="Dashboard" subtitle="Tổng quan hoạt động RemLab">
      <div className="animate-fade-in">
        <DashboardClient
          projects={projects}
          tasks={tasks}
          profiles={profiles}
          activities={activities}
          totalProjects={totalProjects}
          activeProjects={activeProjects}
          totalTasks={totalTasks}
          completedTasksCount={completedTasks}
          overdueTasksCount={overdueTasks}
          blockedTasksCount={blockedTasks}
          memberCount={memberCount}
          activeProjectsWithStats={activeProjectsWithStats}
          activitiesContent={activitiesContent}
        />
      </div>
    </DashboardShell>
  )
}
