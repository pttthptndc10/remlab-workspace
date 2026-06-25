'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskStatus } from '@/lib/types'

export function useTasks(projectId?: string) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, role),
        project:projects(id, name)
      `)
      .order('column_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setTasks((data as Task[]) ?? [])
    setLoading(false)
  }, [supabase, projectId])

  useEffect(() => {
    fetchTasks()

    // Realtime tasks update
    const channel = supabase
      .channel(`tasks-${projectId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          ...(projectId ? { filter: `project_id=eq.${projectId}` } : {}),
        },
        () => { fetchTasks() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, projectId, fetchTasks])

  const updateTaskStatus = useCallback(async (taskId: string, newStatus: TaskStatus, logFn?: (params: object) => void) => {
    const task = tasks.find(t => t.id === taskId)
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, progress: newStatus === 'done' ? 100 : undefined })
      .eq('id', taskId)

    if (!error && logFn && task) {
      logFn({
        action: newStatus === 'done' ? 'completed_task' : 'moved_task',
        entityType: 'task',
        entityId: taskId,
        entityName: task.title,
        projectId: task.project_id,
        metadata: { old_status: task.status, new_status: newStatus },
      })
    }

    return { error }
  }, [supabase, tasks])

  const updateTaskProgress = useCallback(async (taskId: string, progress: number) => {
    const { error } = await supabase
      .from('tasks')
      .update({ progress })
      .eq('id', taskId)
    return { error }
  }, [supabase])

  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    return { error }
  }, [supabase])

  return { tasks, loading, error, fetchTasks, updateTaskStatus, updateTaskProgress, deleteTask }
}
