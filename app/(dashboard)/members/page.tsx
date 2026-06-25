import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { getInitials } from '@/lib/utils'
import type { Profile, Task } from '@/lib/types'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const supabase = await createClient()

  const [profilesResult, tasksResult] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('tasks').select('id, assignee_id, status').not('assignee_id', 'is', null),
  ])

  const profiles: Profile[] = profilesResult.data ?? []
  const tasks = tasksResult.data ?? []

  const getMemberStats = (memberId: string) => {
    const memberTasks = tasks.filter((t) => t.assignee_id === memberId)
    return {
      assigned: memberTasks.length,
      doing: memberTasks.filter((t) => t.status === 'doing').length,
      completed: memberTasks.filter((t) => t.status === 'done').length,
    }
  }

  return (
    <DashboardShell title="Thành viên" subtitle={`${profiles.length} người`}>
      <div className="space-y-4 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profiles.map((profile) => {
            const stats = getMemberStats(profile.id)
            return (
              <a
                key={profile.id}
                href={`/members/${profile.id}`}
                id={`member-card-${profile.id}`}
                className="glass-card p-5 hover:border-cyan-500/30 hover:-translate-y-0.5 transition-all duration-200 group"
              >
                {/* Avatar */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-lg font-bold text-cyan-400">
                    {getInitials(profile.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {profile.full_name}
                    </p>
                    <Badge role={profile.role} size="sm" className="mt-0.5" />
                  </div>
                </div>

                {/* Department */}
                {profile.department && (
                  <p className="text-xs text-slate-400 mb-3 truncate">🏢 {profile.department}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                  <div className="text-center">
                    <p className="text-base font-bold text-white">{stats.assigned}</p>
                    <p className="text-xs text-slate-500">Tổng</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-cyan-400">{stats.doing}</p>
                    <p className="text-xs text-slate-500">Đang làm</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-emerald-400">{stats.completed}</p>
                    <p className="text-xs text-slate-500">Xong</p>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </DashboardShell>
  )
}
