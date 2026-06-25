'use client'

import { useRealtimeActivity } from '@/lib/hooks/useRealtimeActivity'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { formatActivityMessage, formatDate, getInitials } from '@/lib/utils'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Radio } from 'lucide-react'

export default function ActivityPage() {
  const { activities, loading } = useRealtimeActivity()

  return (
    <DashboardShell
      title="Hoạt động"
      subtitle="Theo dõi tất cả hoạt động theo thời gian thực"
    >
      <div className="space-y-4 animate-fade-in">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400">Live</span>
          </div>
          <p className="text-xs text-slate-500">Cập nhật tự động khi có hoạt động mới</p>
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full skeleton flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 skeleton rounded w-3/4" />
                    <div className="h-3 skeleton rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-16">
              <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Chưa có hoạt động nào</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-white/5" />

              <div className="space-y-0">
                {activities.map((act) => {
                  const actorName = act.actor?.full_name ?? 'Ai đó'
                  const message = formatActivityMessage(act.action, act.entity_name ?? '', actorName)
                  let timeAgo = ''
                  try {
                    timeAgo = formatDistanceToNow(parseISO(act.created_at), {
                      addSuffix: true,
                      locale: vi,
                    })
                  } catch {
                    timeAgo = formatDate(act.created_at)
                  }

                  return (
                    <div
                      key={act.id}
                      id={`activity-${act.id}`}
                      className="flex gap-4 pl-0 pb-5 relative group"
                    >
                      {/* Avatar (sits on timeline) */}
                      <div className="relative z-10 flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-sm font-bold text-cyan-400">
                          {getInitials(actorName)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 glass-card p-3 group-hover:border-cyan-500/20 transition-colors">
                        <p className="text-sm text-slate-200 leading-snug">{message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {act.project && (
                            <a
                              href={`/projects/${act.project.id}`}
                              className="text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                            >
                              📁 {act.project.name}
                            </a>
                          )}
                          <span className="text-xs text-slate-500">{timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
