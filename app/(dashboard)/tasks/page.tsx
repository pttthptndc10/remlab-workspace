import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TasksClient } from '@/components/tasks/TasksClient'
import type { Task, Project, Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [profileResult, tasksResult, projectsResult, profilesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('tasks')
      .select('*, assignee:profiles(id, full_name, avatar_url, role), project:projects(id, name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('*, members:project_members(member_id)')
      .order('name'),
    supabase.from('profiles').select('*').order('full_name'),
  ])

  const currentUser = profileResult.data as Profile
  if (!currentUser) notFound()

  let tasks: Task[] = (tasksResult.data ?? []) as Task[]

  // If not admin/leader, only show assigned tasks
  if (currentUser.role === 'member') {
    tasks = tasks.filter((t) => t.assignee_id === user.id)
  }

  return (
    <TasksClient
      tasks={tasks}
      projects={(projectsResult.data ?? []) as Project[]}
      profiles={(profilesResult.data ?? []) as Profile[]}
      currentUser={currentUser}
    />
  )
}
