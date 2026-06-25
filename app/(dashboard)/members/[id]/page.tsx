import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { ProgressChart } from '@/components/members/ProgressChart'
import { formatDate, getInitials, isOverdue } from '@/lib/utils'
import type { Profile, Task } from '@/lib/types'
import { GitBranch, Phone, Building2, Calendar, CheckCircle2, AlertCircle, Clock, ListTodo } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface MemberPageProps {
  params: Promise<{ id: string }>
}

export default async function MemberDetailPage({ params }: MemberPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [profileResult, tasksResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase
      .from('tasks')
      .select('*, project:projects(id, name)')
      .eq('assignee_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!profileResult.data) notFound()

  const profile = profileResult.data as Profile
  const tasks = (tasksResult.data ?? []) as Task[]

  const assigned = tasks.length
  const completed = tasks.filter((t) => t.status === 'done').length
  const overdue = tasks.filter((t) => isOverdue(t.deadline, t.status)).length
  const inProgress = tasks.filter((t) => t.status === 'doing').length

  const recentTasks = tasks.slice(0, 5)

  return (
    <DashboardShell title={profile.full_name} subtitle={profile.department ?? profile.role}>
      <div className="space-y-6 animate-fade-in">
        {/* Profile Header */}
        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-3xl font-black text-cyan-400 flex-shrink-0">
              {getInitials(profile.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-white">{profile.full_name}</h2>
                <Badge role={profile.role} />
              </div>
              {profile.bio && (
                <p className="text-sm text-slate-400 mt-1 mb-3 leading-relaxed max-w-xl">{profile.bio}</p>
              )}
              <div className="flex flex-wrap gap-4">
                {profile.department && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Building2 className="w-3.5 h-3.5" />
                    {profile.department}
                  </span>
                )}
                {profile.github_url && (
                  <a
                    id={`member-github-${profile.id}`}
                    href={profile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    GitHub
                  </a>
                )}
                {profile.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                    {profile.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Tham gia {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Tổng task', value: assigned, icon: ListTodo, color: '#06b6d4' },
            { label: 'Hoàn thành', value: completed, icon: CheckCircle2, color: '#10b981' },
            { label: 'Quá hạn', value: overdue, icon: AlertCircle, color: '#f59e0b' },
            { label: 'Đang làm', value: inProgress, icon: Clock, color: '#8b5cf6' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="glass-card p-4 text-center"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Chart */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Phân bố tasks theo trạng thái</h3>
            <ProgressChart tasks={tasks} />
          </div>

          {/* Recent Tasks */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Tasks gần đây</h3>
            {recentTasks.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Chưa có task nào</p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => {
                  const od = isOverdue(task.deadline, task.status)
                  return (
                    <div
                      key={task.id}
                      id={`member-task-${task.id}`}
                      className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{task.title}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {(task as unknown as { project?: { name: string } }).project?.name ?? ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge status={task.status} size="sm" />
                        {task.deadline && (
                          <span className={`text-xs ${od ? 'text-rose-400' : 'text-slate-500'}`}>
                            {formatDate(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
