'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityLog } from '@/lib/types'

export function useRealtimeActivity(projectId?: string) {
  const supabase = createClient()
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = useCallback(async () => {
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        actor:profiles(id, full_name, avatar_url, role),
        project:projects(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data } = await query
    if (data) setActivities(data as ActivityLog[])
    setLoading(false)
  }, [supabase, projectId])

  useEffect(() => {
    fetchActivities()

    // Realtime subscription
    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          ...(projectId ? { filter: `project_id=eq.${projectId}` } : {}),
        },
        async (payload) => {
          // Fetch full record với relations
          const { data } = await supabase
            .from('activity_logs')
            .select(`
              *,
              actor:profiles(id, full_name, avatar_url, role),
              project:projects(id, name)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setActivities(prev => [data as ActivityLog, ...prev.slice(0, 49)])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, projectId, fetchActivities])

  return { activities, loading, refresh: fetchActivities }
}

// Hook để log hoạt động
export function useLogActivity() {
  const supabase = createClient()

  const log = useCallback(async (params: {
    action: string
    entityType: 'task' | 'project' | 'comment' | 'member'
    entityId?: string
    entityName?: string
    projectId?: string
    metadata?: Record<string, unknown>
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      entity_name: params.entityName,
      project_id: params.projectId,
      metadata: params.metadata ?? {},
    })
  }, [supabase])

  return { log }
}
