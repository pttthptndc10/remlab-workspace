import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { StatCard } from '@/components/dashboard/StatCard'
import { ProjectCompletionChart } from '@/components/reports/ProjectCompletionChart'
import { ExportButton } from '@/components/reports/ExportButton'
import { Badge } from '@/components/ui/Badge'
import { isOverdue } from '@/lib/utils'
import type { Task, Project, Profile } from '@/lib/types'
import { ListTodo, CheckCircle2, AlertCircle, Ban } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()

  const [tasksResult, projectsResult, profilesResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, assignee:profiles(id, full_name, avatar_url, role)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, status').order('name'),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
  ])

  const tasks: Task[] = (tasksResult.data ?? []) as Task[]
  const projects: Pick<Project, 'id' | 'name' | 'status'>[] = projectsResult.data ?? []
  const profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[] = profilesResult.data ?? []

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const overdueTasks = tasks.filter((t) => isOverdue(t.deadline, t.status)).length
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length

  // Project completion data for chart
  const projectCompletionData = projects.map((p) => {
    const projectTasks = tasks.filter((t) => t.project_id === p.id)
    const done = projectTasks.filter((t) => t.status === 'done').length
    const pct = projectTasks.length > 0 ? Math.round((done / projectTasks.length) * 100) : 0
    return { name: p.name, completion: pct }
  })

  // Member contribution
  const memberContribution = profiles.map((profile) => {
    const memberTasks = tasks.filter((t) => t.assignee_id === profile.id)
    return {
      id: profile.id,
      name: profile.full_name,
      role: profile.role,
      total: memberTasks.length,
      done: memberTasks.filter((t) => t.status === 'done').length,
      doing: memberTasks.filter((t) => t.status === 'doing').length,
      overdue: memberTasks.filter((t) => isOverdue(t.deadline, t.status)).length,
    }
  }).sort((a, b) => b.done - a.done)

  return (
    <DashboardShell
      title="Báo cáo"
      subtitle="Tổng quan hiệu suất dự án và thành viên"
      actions={<ExportButton tasks={tasks} />}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Overview stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard id="report-total-tasks" title="Tổng tasks" value={totalTasks} icon={ListTodo} color="#06b6d4" />
          <StatCard id="report-completed-tasks" title="Hoàn thành" value={completedTasks} icon={CheckCircle2} color="#10b981" />
          <StatCard id="report-overdue-tasks" title="Quá hạn" value={overdueTasks} icon={AlertCircle} color="#f59e0b" />
          <StatCard id="report-blocked-tasks" title="Bị chặn" value={blockedTasks} icon={Ban} color="#ef4444" />
        </div>

        {/* Project completion chart */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold text-white mb-4">Tỷ lệ hoàn thành theo dự án</h3>
          <ProjectCompletionChart data={projectCompletionData} />
        </div>

        {/* Member contribution table */}
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h3 className="text-base font-semibold text-white">Đóng góp của thành viên</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Thành viên</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Vai trò</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Tổng</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Hoàn thành</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Đang làm</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Quá hạn</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {memberContribution.map((m) => {
                  const rate = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0
                  return (
                    <tr key={m.id} id={`report-member-${m.id}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3">
                        <a
                          href={`/members/${m.id}`}
                          className="text-sm font-medium text-white hover:text-cyan-300 transition-colors"
                        >
                          {m.name}
                        </a>
                      </td>
                      <td className="px-5 py-3">
                        <Badge role={m.role} size="sm" />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-sm text-white">{m.total}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-sm font-semibold text-emerald-400">{m.done}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-sm text-cyan-400">{m.doing}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-sm ${m.overdue > 0 ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
                          {m.overdue}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${rate}%`,
                                background: rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8 text-right">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
