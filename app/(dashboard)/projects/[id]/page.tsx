import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProjectDetailClient } from '@/components/projects/ProjectDetailClient'
import type { Profile, ProjectMember, Task } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [projectResult, tasksResult, membersResult, profileResult, allProfilesResult] = await Promise.all([
    supabase
      .from('projects')
      .select('*, creator:profiles(id, full_name, avatar_url, role), members:project_members(*, member:profiles(*))')
      .eq('id', id)
      .single(),
    supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, role), creator:profiles!tasks_created_by_fkey(id, full_name)')
      .eq('project_id', id)
      .order('column_order', { ascending: true }),
    supabase
      .from('project_members')
      .select('*, member:profiles(*)')
      .eq('project_id', id),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profiles').select('*').order('full_name'),
  ])

  if (!projectResult.data) notFound()

  return (
    <ProjectDetailClient
      project={projectResult.data}
      tasks={(tasksResult.data ?? []) as Task[]}
      members={(membersResult.data ?? []) as ProjectMember[]}
      allProfiles={(allProfilesResult.data ?? []) as Profile[]}
      currentUser={profileResult.data as Profile}
    />
  )
}
