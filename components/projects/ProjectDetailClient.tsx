'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProjectChecklist } from '@/components/projects/ProjectChecklist'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatDate, getInitials } from '@/lib/utils'
import type { Project, Task, Profile, ProjectMember } from '@/lib/types'
import { Calendar, Info, Users, Pencil, CheckSquare, Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { DashboardShell } from '@/components/layout/DashboardShell'

interface ProjectDetailClientProps {
  project: Project
  tasks: Task[]
  members: ProjectMember[]
  allProfiles: Profile[]
  currentUser: Profile
}

type Tab = 'checklist' | 'members' | 'info'

export function ProjectDetailClient({
  project,
  tasks: initialTasks,
  members,
  allProfiles,
  currentUser,
}: ProjectDetailClientProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('checklist')
  const [showEdit, setShowEdit] = useState(false)

  const checklistSaveRef = useRef<(() => Promise<void>) | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleDirtyChange = useCallback((dirty: boolean, isSaving: boolean) => {
    setIsDirty(dirty)
    setSaving(isSaving)
  }, [])

  // Quản lý state của tasks và project ở component cha để Realtime đồng bộ tiến độ lớn
  const [tasksState, setTasksState] = useState<Task[]>(initialTasks)
  const [projectState, setProjectState] = useState<Project>(project)

  // Đồng bộ state khi props từ server thay đổi (sau khi reload/navigation)
  useEffect(() => {
    setTasksState(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    setProjectState(project)
  }, [project])

  // Hàm tải lại dữ liệu mới nhất từ database
  const refetchData = useCallback(async () => {
    const [tasksRes, projectRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, role), creator:profiles!tasks_created_by_fkey(id, full_name)')
        .eq('project_id', project.id)
        .order('column_order', { ascending: true }),
      supabase
        .from('projects')
        .select('*')
        .eq('id', project.id)
        .single()
    ])

    return {
      tasks: (tasksRes.data ?? []) as Task[],
      project: projectRes.data as Project | null
    }
  }, [supabase, project.id])

  // Lắng nghe thay đổi qua Supabase Realtime ở component cha
  useEffect(() => {
    const channelName = `project-parent-realtime-${project.id}`
    const channel = supabase
      .channel(channelName)
      // Lắng nghe thay đổi của bảng tasks thuộc dự án này
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${project.id}`,
        },
        async () => {
          const { tasks: freshTasks } = await refetchData()
          setTasksState(freshTasks)
        }
      )
      // Lắng nghe thay đổi ghi chú dự án
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${project.id}`,
        },
        async () => {
          const { project: freshProject } = await refetchData()
          if (freshProject) {
            setProjectState(freshProject)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, project.id, refetchData])

  const isAdminOrLeader = currentUser.role === 'admin' || currentUser.role === 'leader'

  // Tính toán tiến độ dựa trên tasksState (luôn cập nhật Realtime)
  const completedTasks = tasksState.filter((t) => t.status === 'done').length
  const completionPct = tasksState.length > 0 ? Math.round((completedTasks / tasksState.length) * 100) : 0
  const projectMembers = members.map((m) => m.member).filter((m): m is Profile => !!m)

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'checklist', label: 'Checklist', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'members', label: 'Thành viên', icon: <Users className="w-4 h-4" /> },
    { id: 'info', label: 'Thông tin', icon: <Info className="w-4 h-4" /> },
  ]

  return (
    <DashboardShell
      title={projectState.name}
      subtitle={`${tasksState.length} tasks · ${completionPct}% hoàn thành`}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && activeTab === 'checklist' && (
            <button
              id="checklist-save-btn-top"
              onClick={() => {
                if (checklistSaveRef.current) {
                  checklistSaveRef.current()
                }
              }}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                !saving
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 hover:scale-[1.02] cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          )}
          {isAdminOrLeader && (
            <button
              id="project-detail-edit-btn"
              onClick={() => setShowEdit(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Chỉnh sửa
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5 animate-fade-in">
        {/* Project header info */}
        <div className="glass-card p-5">
          <div className="flex flex-wrap gap-3 items-center">
            <Badge status={projectState.status} />
            <Badge priority={projectState.priority} />
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>Hạn: {formatDate(projectState.deadline)}</span>
            </div>
            <div className="ml-auto text-sm text-slate-400">
              {members.length} thành viên
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={completionPct} showLabel />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`project-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'checklist' && (
          <ProjectChecklist
            tasks={tasksState}
            project={projectState}
            currentUser={currentUser}
            projectMembers={projectMembers}
            allProfiles={allProfiles}
            saveRef={checklistSaveRef}
            onDirtyChange={handleDirtyChange}
            onSaveSuccess={(updatedTasks, updatedProject) => {
              setTasksState(updatedTasks)
              setProjectState(updatedProject)
            }}
          />
        )}

        {activeTab === 'members' && (() => {
          const uniqueMembersMap = new Map<string, Profile>()
          
          members.forEach((pm) => {
            if (pm.member) {
              uniqueMembersMap.set(pm.member.id, pm.member)
            }
          })
          
          tasksState.forEach((t) => {
            if (t.assignee_id && t.assignee && !uniqueMembersMap.has(t.assignee_id)) {
              uniqueMembersMap.set(t.assignee_id, t.assignee as Profile)
            }
          })

          const allProjectParticipantProfiles = Array.from(uniqueMembersMap.values())

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allProjectParticipantProfiles.map((profile) => {
                const memberTasks = tasksState.filter((t) => t.assignee_id === profile.id)
                const memberDone = memberTasks.filter((t) => t.status === 'done').length
                const totalProjectTasks = tasksState.length
                const memberProgress = totalProjectTasks > 0
                  ? Math.round((memberDone / totalProjectTasks) * 100)
                  : 0
                return (
                  <a
                    key={profile.id}
                    href={`/members/${profile.id}`}
                    id={`project-member-${profile.id}`}
                    className="glass-card p-4 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-sm font-bold text-cyan-400">
                        {getInitials(profile.full_name ?? 'M')}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{profile.full_name}</p>
                        <Badge role={profile.role ?? 'member'} size="sm" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      {memberDone}/{totalProjectTasks} tasks hoàn thành
                    </div>
                    <ProgressBar value={memberProgress} size="sm" />
                  </a>
                )
              })}
              {allProjectParticipantProfiles.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 text-sm">
                  Chưa có thành viên nào trong dự án này.
                </div>
              )}
            </div>
          )
        })()}

        {activeTab === 'info' && (
          <div className="glass-card p-6 space-y-4">
            <div className="space-y-4">
              {(() => {
                const DIVIDER = '<!--admin-notes-divider-->'
                const parts = (projectState.description || '').split(DIVIDER)
                const execNotes = parts[0] || ''
                const adminNotes = parts[1] || ''
                return (
                  <>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Ghi chú của người thực hiện</p>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {execNotes || 'Không có mô tả / ghi chú.'}
                      </p>
                    </div>
                    {adminNotes && (
                      <div className="pt-3 border-t border-white/5">
                        <p className="text-xs text-amber-400 mb-1">Ý kiến / Ghi chú của Admin</p>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {adminNotes}
                        </p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-xs text-slate-500 mb-1">Người tạo</p>
                <p className="text-sm text-white">
                  {projectState.creator?.full_name ?? 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Ngày tạo</p>
                <p className="text-sm text-white">{formatDate(projectState.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Cập nhật lần cuối</p>
                <p className="text-sm text-white">{formatDate(projectState.updated_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Hạn chót</p>
                <p className="text-sm text-white">{formatDate(projectState.deadline)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Chỉnh sửa dự án"
        size="md"
      >
        <ProjectForm
          project={projectState}
          members={allProfiles}
          onSuccess={() => setShowEdit(false)}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>
    </DashboardShell>
  )
}
