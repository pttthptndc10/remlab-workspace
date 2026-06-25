import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from '@/components/projects/ProjectsClient'
import type { ProjectWithStats, Task, Profile, UserRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [projectsResult, tasksResult, membersResult, profileResult] = await Promise.all([
    supabase
      .from('projects')
      .select('*, creator:profiles(id, full_name, avatar_url, role), members:project_members(*, member:profiles(*))')
      .order('created_at', { ascending: false }),
    supabase.from('tasks').select('id, project_id, status'),
    supabase.from('profiles').select('*').order('full_name'),
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const rawProjects = projectsResult.data ?? []
  const tasks: Pick<Task, 'id' | 'project_id' | 'status'>[] = tasksResult.data ?? []
  const allMembers: Profile[] = membersResult.data ?? []
  const currentUserRole = profileResult.data?.role as UserRole | undefined

  const projects: ProjectWithStats[] = rawProjects.map((p) => {
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

  return (
    <ProjectsClient
      projects={projects}
      allMembers={allMembers}
      currentUserRole={currentUserRole}
    />
  )
}
