'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Profile, Project } from '@/lib/types'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { 
  Plus, Trash2, Save, AlertCircle, Bold, Italic, List, Code,
  Edit2, MoreVertical, Paperclip, Download, FileText, ArrowLeft,
  History, Eye, Send, RotateCcw, X, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectChecklistProps {
  tasks: Task[]
  project: Project
  currentUser: Profile
  projectMembers: Profile[]
  allProfiles: Profile[]
  onSaveSuccess?: (tasks: Task[], project: Project) => void
  saveRef?: React.RefObject<(() => Promise<void>) | null>
  onDirtyChange?: (isDirty: boolean, saving: boolean) => void
}

interface DiscussionMessage {
  id: string
  project_id: string
  task_id: string | null
  author_id: string
  content: string | null
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: string | null
  is_recalled: boolean
  recalled_at: string | null
  recalled_by: string | null
  restored_at: string | null
  edited_at: string | null
  created_at: string
  author?: Profile
}

interface MessageEditHistory {
  id: string
  message_id: string
  old_content: string
  new_content: string
  edited_by: string
  edited_at: string
  profiles?: { full_name: string }
}

interface WorkLogHistory {
  id: string
  project_id: string
  old_content: string
  new_content: string
  edited_by: string | null
  edited_at: string
  profiles?: { full_name: string }
}

const NOTE_DIVIDER = '|notes-divider|'

// Trình biên dịch Markdown gọn nhẹ, an toàn
function renderMarkdown(text: string) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  // Code block ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-950 p-3 rounded-lg border border-white/5 font-mono text-xs my-2 overflow-x-auto text-cyan-400"><code>$1</code></pre>')
  
  // Inline code `code`
  html = html.replace(/`(.*?)`/g, '<code class="bg-slate-900/80 px-1.5 py-0.5 rounded font-mono text-xs text-cyan-400">$1</code>')
  
  // Lists
  const lines = html.split('\n')
  let inList = false
  const processedLines = lines.map(line => {
    const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/)
    if (listMatch) {
      const content = listMatch[2]
      if (!inList) {
        inList = true
        return `<ul class="list-disc pl-5 my-2 space-y-1"><li>${content}</li>`
      }
      return `<li>${content}</li>`
    } else {
      if (inList) {
        inList = false
        return `</ul>${line}`
      }
      return line
    }
  })
  if (inList) {
    processedLines.push('</ul>')
  }
  html = processedLines.join('\n')

  // Paragraphs
  html = html.split('\n\n').map(p => {
    const trimmed = p.trim()
    if (trimmed.startsWith('<ul') || trimmed.startsWith('<pre') || trimmed.startsWith('</ul') || trimmed.startsWith('<li>') || trimmed.startsWith('</ul>')) {
      return p
    }
    return `<p class="mb-2 last:mb-0 leading-relaxed">${p}</p>`
  }).join('\n')

  return html
}

function formatWorkLogDate(dateStr: string | null) {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const formattedHours = hours.toString().padStart(2, '0')
  
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  
  return `${formattedHours}:${minutes} ${ampm} - ${day}/${month}/${year}`
}

function formatChatTime(dateStr: string) {
  const date = new Date(dateStr)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function getRoleBadgeStyle(role: string) {
  switch (role) {
    case 'admin':
      return 'border border-amber-500/30 text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase'
    case 'leader':
      return 'border border-sky-500/30 text-sky-400 bg-sky-500/5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase'
    case 'member':
      return 'border border-slate-500/30 text-slate-300 bg-slate-500/5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase'
    default:
      return 'border border-purple-500/30 text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase'
  }
}

function getRoleLabel(role: string) {
  switch (role) {
    case 'admin': return 'Admin'
    case 'leader': return 'Leader'
    case 'member': return 'Member'
    default: return 'Khách'
  }
}

const isWithin24Hours = (timestampStr: string | null) => {
  if (!timestampStr) return false
  const diffMs = Date.now() - new Date(timestampStr).getTime()
  return diffMs < 24 * 60 * 60 * 1000
}

export function ProjectChecklist({
  tasks: initialTasks,
  project,
  currentUser,
  projectMembers,
  allProfiles,
  onSaveSuccess,
  saveRef,
  onDirtyChange,
}: ProjectChecklistProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [savedTasks, setSavedTasks] = useState<Task[]>(initialTasks)
  const [localTasks, setLocalTasks] = useState<Task[]>(initialTasks)
  const [saving, setSaving] = useState(false)

  // Quyền chỉnh sửa chung cho danh sách tasks
  const isProjectMember = projectMembers.some((m) => m.id === currentUser.id)
  const isCreator = project.created_by === currentUser.id
  const isAdmin = currentUser.role === 'admin'
  const hasEditPermission = isAdmin || isProjectMember || isCreator

  // Quyền chỉnh sửa nhật ký công việc (Nhà thiết kế quy định: assignee của task, Leader, Admin)
  const isTaskAssignee = localTasks.some((t) => t.assignee_id === currentUser.id)
  const canEditWorkLog = isAdmin || currentUser.role === 'leader' || isTaskAssignee || isCreator

  const isDirtyRef = useRef(false)
  const hasTasksChanged = () => {
    if (localTasks.length !== savedTasks.length) return true
    for (const local of localTasks) {
      const saved = savedTasks.find((s) => s.id === local.id)
      if (!saved) return true
      if (local.title !== saved.title) return true
      if ((local.notes || '') !== (saved.notes || '')) return true
      if (local.start_date !== saved.start_date) return true
      if (local.deadline !== saved.deadline) return true
      if (local.status !== saved.status) return true
      if (local.assignee_id !== saved.assignee_id) return true
    }
    for (const saved of savedTasks) {
      if (!localTasks.some((l) => l.id === saved.id)) return true
    }
    return false
  }

  const isDirty = hasTasksChanged()

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  // Sync tasks from parent prop updates
  useEffect(() => {
    setSavedTasks(initialTasks)
    if (!isDirtyRef.current) {
      setLocalTasks(initialTasks)
    }
  }, [initialTasks])

  const pendingTasks = localTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const cancelledTasks = localTasks.filter((t) => t.status === 'cancelled')
  const completedTasks = localTasks.filter((t) => t.status === 'done')

  const handleAddTask = () => {
    if (!hasEditPermission) return
    const tempId = `temp-${Date.now()}`
    const newTask: Task = {
      id: tempId,
      project_id: project.id,
      title: '',
      description: null,
      assignee_id: null,
      start_date: null,
      deadline: null,
      status: 'todo',
      priority: 'medium',
      progress: 0,
      checklist: null,
      notes: '',
      attachment_url: null,
      column_order: localTasks.length,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setLocalTasks((prev) => [...prev, newTask])
  }

  const handleUpdateField = (
    id: string,
    field: 'title' | 'notes' | 'start_date' | 'deadline' | 'assignee_id',
    value: string | null
  ) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }

  const handleToggleStatus = (id: string) => {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t
      )
    )
  }

  const handleToggleCancel = (id: string) => {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'cancelled' ? 'todo' : 'cancelled' } : t
      )
    )
  }

  const handleDeleteLocal = (id: string) => {
    setLocalTasks((prev) => prev.filter((t) => t.id !== id))
  }

  // Lưu checklist xuống Supabase
  const handleSave = async () => {
    if (!hasEditPermission) return
    const hasEmptyTitle = localTasks.some((t) => !t.title.trim())
    if (hasEmptyTitle) {
      toast.error('Vui lòng điền đầy đủ tên cho các công việc')
      return
    }

    setSaving(true)
    try {
      let insertedData: Task[] = []
      const tasksToDelete = savedTasks.filter((st) => !localTasks.some((lt) => lt.id === st.id))
      const tasksToInsert = localTasks.filter((lt) => lt.id.startsWith('temp-'))
      const tasksToUpdate = localTasks.filter((lt) => {
        if (lt.id.startsWith('temp-')) return false
        const saved = savedTasks.find((st) => st.id === lt.id)
        if (!saved) return false
        return (
          lt.title !== saved.title ||
          lt.status !== saved.status ||
          (lt.notes || '') !== (saved.notes || '') ||
          lt.start_date !== saved.start_date ||
          lt.deadline !== saved.deadline ||
          lt.assignee_id !== saved.assignee_id
        )
      })

      if (tasksToDelete.length > 0) {
        const deleteIds = tasksToDelete.map((t) => t.id)
        const { error } = await supabase.from('tasks').delete().in('id', deleteIds)
        if (error) throw error

        for (const t of tasksToDelete) {
          await supabase.from('activity_logs').insert({
            actor_id: currentUser.id,
            action: 'deleted_task',
            entity_type: 'task',
            entity_id: t.id,
            entity_name: t.title,
            project_id: project.id,
            metadata: {},
          })
        }
      }

      if (tasksToInsert.length > 0) {
        const insertPayload = tasksToInsert.map((t, idx) => ({
          project_id: project.id,
          title: t.title.trim(),
          status: t.status,
          assignee_id: t.assignee_id,
          notes: t.notes ? t.notes.trim() : null,
          start_date: t.start_date,
          deadline: t.deadline,
          priority: 'medium',
          progress: t.status === 'done' ? 100 : 0,
          column_order: savedTasks.length + idx,
          created_by: currentUser.id,
        }))

        const { data, error } = await supabase
          .from('tasks')
          .insert(insertPayload)
          .select()

        if (error) throw error
        insertedData = data as Task[]

        for (const t of insertedData) {
          await supabase.from('activity_logs').insert({
            actor_id: currentUser.id,
            action: 'created_task',
            entity_type: 'task',
            entity_id: t.id,
            entity_name: t.title,
            project_id: project.id,
            metadata: {},
          })
        }
      }

      if (tasksToUpdate.length > 0) {
        for (const t of tasksToUpdate) {
          const { error } = await supabase
            .from('tasks')
            .update({
              title: t.title.trim(),
              status: t.status,
              assignee_id: t.assignee_id,
              notes: t.notes ? t.notes.trim() : null,
              start_date: t.start_date,
              deadline: t.deadline,
              progress: t.status === 'done' ? 100 : 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', t.id)

          if (error) throw error

          const saved = savedTasks.find((st) => st.id === t.id)
          if (saved && saved.status !== t.status) {
            await supabase.from('activity_logs').insert({
              actor_id: currentUser.id,
              action: t.status === 'done' ? 'completed_task' : t.status === 'cancelled' ? 'cancelled_task' : 'moved_task',
              entity_type: 'task',
              entity_id: t.id,
              entity_name: t.title,
              project_id: project.id,
              metadata: { new_status: t.status },
            })
          }
        }
      }

      toast.success('Đã lưu thay đổi thành công!')
      const nextSavedTasks = [
        ...localTasks.filter((lt) => !lt.id.startsWith('temp-')),
        ...insertedData,
      ]

      setSavedTasks(nextSavedTasks)
      setLocalTasks(nextSavedTasks)

      if (onSaveSuccess) {
        onSaveSuccess(nextSavedTasks, project)
      }

      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu')
    } finally {
      setSaving(false)
    }
  }

  // Synchronize handleSave and dirty states with parent
  const latestHandleSave = useRef(handleSave)
  useEffect(() => {
    latestHandleSave.current = handleSave
  })

  useEffect(() => {
    if (saveRef) {
      saveRef.current = () => latestHandleSave.current()
    }
    return () => {
      if (saveRef) {
        saveRef.current = null
      }
    }
  }, [saveRef])

  const latestOnDirtyChange = useRef(onDirtyChange)
  useEffect(() => {
    latestOnDirtyChange.current = onDirtyChange
  })

  useEffect(() => {
    latestOnDirtyChange.current?.(isDirty, saving)
  }, [isDirty, saving])

  // ==========================================
  // NHẬT KÝ CÔNG VIỆC STATE & HANDLERS
  // ==========================================
  const [workLog, setWorkLog] = useState<{
    content: string
    last_edited_by: string | null
    last_edited_at: string
    editor_name?: string
  } | null>(null)
  
  const [localWorkLogContent, setLocalWorkLogContent] = useState('')
  const [savingLog, setSavingLog] = useState(false)
  const [logLoading, setLogLoading] = useState(true)
  const [logTab, setLogTab] = useState<'edit' | 'preview'>('edit')

  const [showWorkLogHistoryModal, setShowWorkLogHistoryModal] = useState(false)
  const [workLogHistory, setWorkLogHistory] = useState<WorkLogHistory[]>([])

  // Tải nhật ký công việc từ Supabase
  useEffect(() => {
    const fetchWorkLog = async () => {
      setLogLoading(true)
      try {
        const { data, error } = await supabase
          .from('project_work_logs')
          .select('*, profiles:last_edited_by(full_name)')
          .eq('project_id', project.id)
          .maybeSingle()

        if (data) {
          setWorkLog({
            content: data.content || '',
            last_edited_by: data.last_edited_by,
            last_edited_at: data.last_edited_at,
            editor_name: data.profiles?.full_name || 'N/A'
          })
          setLocalWorkLogContent(data.content || '')
        } else {
          setWorkLog({
            content: '',
            last_edited_by: null,
            last_edited_at: new Date().toISOString(),
            editor_name: 'N/A'
          })
          setLocalWorkLogContent('')
        }
      } catch (err) {
        console.error('Lỗi khi tải nhật ký công việc:', err)
      } finally {
        setLogLoading(false)
      }
    }
    fetchWorkLog()
  }, [project.id, supabase])

  // Lưu nhật ký công việc
  const handleSaveWorkLog = async (newContent: string) => {
    try {
      const { data, error } = await supabase
        .from('project_work_logs')
        .upsert({
          project_id: project.id,
          content: newContent,
          last_edited_by: currentUser.id,
          last_edited_at: new Date().toISOString()
        }, { onConflict: 'project_id' })
        .select('*, profiles:last_edited_by(full_name)')
        .single()

      if (error) throw error

      setWorkLog({
        content: data.content || '',
        last_edited_by: data.last_edited_by,
        last_edited_at: data.last_edited_at,
        editor_name: data.profiles?.full_name || currentUser.full_name || 'N/A'
      })
    } catch (err) {
      console.error('Lỗi khi lưu nhật ký:', err)
    }
  }

  // Debounced autosave (1s)
  useEffect(() => {
    if (workLog === null || logLoading) return
    if (localWorkLogContent === workLog.content) return

    setSavingLog(true)
    const timer = setTimeout(async () => {
      await handleSaveWorkLog(localWorkLogContent)
      setSavingLog(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [localWorkLogContent])

  // Lắng nghe realtime cập nhật nhật ký công việc
  useEffect(() => {
    const channel = supabase
      .channel(`project-work-logs-realtime-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_work_logs',
          filter: `project_id=eq.${project.id}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('project_work_logs')
            .select('*, profiles:last_edited_by(full_name)')
            .eq('project_id', project.id)
            .single()
          
          if (data && data.last_edited_by !== currentUser.id) {
            setWorkLog({
              content: data.content || '',
              last_edited_by: data.last_edited_by,
              last_edited_at: data.last_edited_at,
              editor_name: data.profiles?.full_name || 'N/A'
            })
            setLocalWorkLogContent(data.content || '')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [project.id, supabase, currentUser.id])

  // Lịch sử sửa nhật ký công việc (Chỉ Admin)
  const handleViewWorkLogHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('work_log_history')
        .select('*, profiles:edited_by(full_name)')
        .eq('project_id', project.id)
        .order('edited_at', { ascending: false })

      if (error) throw error
      setWorkLogHistory(data || [])
      setShowWorkLogHistoryModal(true)
    } catch (err) {
      toast.error('Không thể tải lịch sử nhật ký')
    }
  }

  // Chèn cú pháp markdown vào editor
  const insertMarkdown = (syntax: string) => {
    const textarea = document.getElementById('work-log-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)
    let replacement = ''

    if (syntax === 'bold') {
      replacement = `**${selected || 'chữ in đậm'}**`
    } else if (syntax === 'italic') {
      replacement = `*${selected || 'chữ in nghiêng'}*`
    } else if (syntax === 'list') {
      replacement = selected
        ? selected.split('\n').map(line => `- ${line}`).join('\n')
        : '- Dòng danh sách'
    } else if (syntax === 'code') {
      replacement = selected.includes('\n')
        ? `\`\`\`\n${selected}\n\`\`\``
        : `\`${selected || 'mã code'}\``
    }

    const newText = text.substring(0, start) + replacement + text.substring(end)
    setLocalWorkLogContent(newText)
    
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + replacement.length, start + replacement.length)
    }, 50)
  }

  // ==========================================
  // THẢO LUẬN & GÓP Ý STATE & HANDLERS
  // ==========================================
  const [messages, setMessages] = useState<DiscussionMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null)

  const [viewingHistoryMessageId, setViewingHistoryMessageId] = useState<string | null>(null)
  const [messageHistory, setMessageHistory] = useState<MessageEditHistory[]>([])
  
  const [activeDropdownMsgId, setActiveDropdownMsgId] = useState<string | null>(null)

  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior
      })
    }
  }

  const fetchSingleMessage = async (msgId: string) => {
    const { data } = await supabase
      .from('discussion_messages')
      .select('*, author:profiles!discussion_messages_author_id_fkey(id, full_name, avatar_url, role)')
      .eq('id', msgId)
      .single()
    return data as DiscussionMessage | null
  }

  // Tải tin nhắn thảo luận
  useEffect(() => {
    const fetchMessages = async () => {
      setMsgLoading(true)
      try {
        const { data, error } = await supabase
          .from('discussion_messages')
          .select('*, author:profiles!discussion_messages_author_id_fkey(id, full_name, avatar_url, role)')
          .eq('project_id', project.id)
          .order('created_at', { ascending: true })

        if (error) throw error
        setMessages(data || [])
        setTimeout(scrollToBottom, 100)
      } catch (err) {
        console.error('Lỗi khi tải thảo luận:', err)
      } finally {
        setMsgLoading(false)
      }
    }
    fetchMessages()
  }, [project.id, supabase])

  // Realtime thảo luận
  useEffect(() => {
    const channel = supabase
      .channel(`project-discussion-realtime-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discussion_messages',
          filter: `project_id=eq.${project.id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = await fetchSingleMessage(payload.new.id)
            if (newMsg) {
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev
                return [...prev, newMsg]
              })
              setTimeout(scrollToBottom, 50)
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = await fetchSingleMessage(payload.new.id)
            if (updatedMsg) {
              setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m))
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [project.id, supabase])

  // Gửi tin nhắn thảo luận
  const handleSendMessage = async (text: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    if (!text.trim() && !fileUrl) return
    try {
      const { data, error } = await supabase
        .from('discussion_messages')
        .insert({
          project_id: project.id,
          author_id: currentUser.id,
          content: text.trim() || null,
          attachment_url: fileUrl || null,
          attachment_name: fileName || null,
          attachment_type: fileType || null
        })
        .select('*, author:profiles!discussion_messages_author_id_fkey(id, full_name, avatar_url, role)')
        .single()

      if (error) throw error
      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev
          return [...prev, data as DiscussionMessage]
        })
        setTimeout(scrollToBottom, 50)
      }
      setChatInput('')
    } catch (err: any) {
      toast.error(`Không thể gửi thảo luận: ${err?.message || err}`)
      console.error(err)
    }
  }

  // Tải tài liệu lên Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
      const filePath = `discussions/${project.id}/${fileName}`

      const { error } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath)

      await handleSendMessage('', publicUrl, file.name, file.type || fileExt)
      toast.success('Đính kèm tài liệu thành công!')
    } catch (err: any) {
      toast.error(`Tải tài liệu lên thất bại: ${err?.message || err}`)
      console.error(err)
    } finally {
      setUploadingFile(false)
      // Reset input file
      e.target.value = ''
    }
  }

  // Sửa tin nhắn
  const handleEditMessage = async (id: string) => {
    if (!editingMessageText.trim()) return
    try {
      const { data, error } = await supabase
        .from('discussion_messages')
        .update({
          content: editingMessageText.trim(),
          edited_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*, author:profiles!discussion_messages_author_id_fkey(id, full_name, avatar_url, role)')
        .single()

      if (error) throw error
      if (data) {
        setMessages(prev => prev.map(m => m.id === data.id ? (data as DiscussionMessage) : m))
      }
      setEditingMessageId(null)
      setEditingMessageText('')
      toast.success('Đã cập nhật thảo luận')
    } catch (err: any) {
      toast.error(`Lỗi khi cập nhật thảo luận: ${err?.message || err}`)
    }
  }

  // Thu hồi tin nhắn
  const handleRecallMessage = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('discussion_messages')
        .update({
          is_recalled: true,
          recalled_at: new Date().toISOString(),
          recalled_by: currentUser.id
        })
        .eq('id', id)
        .select('*, author:profiles!discussion_messages_author_id_fkey(id, full_name, avatar_url, role)')
        .single()

      if (error) throw error
      if (data) {
        setMessages(prev => prev.map(m => m.id === data.id ? (data as DiscussionMessage) : m))
      }
      toast.success('Đã thu hồi tin nhắn')
    } catch (err: any) {
      toast.error(`Không thể thu hồi tin nhắn: ${err?.message || err}`)
    }
  }

  // Khôi phục tin nhắn
  const handleRestoreMessage = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('discussion_messages')
        .update({
          is_recalled: false,
          restored_at: new Date().toISOString(),
          recalled_at: null,
          recalled_by: null
        })
        .eq('id', id)
        .select('*, author:profiles!discussion_messages_author_id_fkey(id, full_name, avatar_url, role)')
        .single()

      if (error) throw error
      if (data) {
        setMessages(prev => prev.map(m => m.id === data.id ? (data as DiscussionMessage) : m))
      }
      toast.success('Đã khôi phục tin nhắn')
    } catch (err: any) {
      toast.error(`Không thể khôi phục tin nhắn: ${err?.message || err}`)
    }
  }

  // Tải lịch sử sửa tin nhắn (Admin)
  const handleViewMessageHistory = async (msgId: string) => {
    try {
      const { data, error } = await supabase
        .from('message_edit_history')
        .select('*, profiles:edited_by(full_name)')
        .eq('message_id', msgId)
        .order('edited_at', { ascending: false })

      if (error) throw error
      setMessageHistory(data || [])
      setViewingHistoryMessageId(msgId)
    } catch (err) {
      toast.error('Không thể tải lịch sử tin nhắn')
    }
  }

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleOutsideClick = () => setActiveDropdownMsgId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  return (
    <div className="space-y-6">
      {/* Cảnh báo quyền chỉnh sửa */}
      {!hasEditPermission && (
        <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5 flex items-center gap-3 text-amber-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs">
            Bạn chỉ có quyền xem chi tiết dự án. Chỉ có admin và thành viên dự án mới có quyền thay đổi.
          </p>
        </div>
      )}

      {/* Thông báo có thay đổi chưa lưu */}
      {isDirty && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-medium">
          ⚠️ Bạn đang có thay đổi công việc chưa lưu. Vui lòng nhấn nút &quot;Lưu thay đổi&quot; ở đầu trang.
        </div>
      )}

      {/* Danh sách chưa hoàn thành */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <span className="text-sm font-semibold text-slate-200">
              Cần làm ({pendingTasks.length})
            </span>
          </div>
        </div>

        <ul className="divide-y divide-white/5 bg-slate-950/20">
          {pendingTasks.map((task) => (
            <TaskChecklistRow
              key={task.id}
              task={task}
              projectName={project.name}
              hasEditPermission={hasEditPermission}
              allProfiles={allProfiles}
              onToggle={handleToggleStatus}
              onToggleCancel={handleToggleCancel}
              onUpdateField={handleUpdateField}
              onDelete={handleDeleteLocal}
            />
          ))}
          {pendingTasks.length === 0 && (
            <li className="px-5 py-6 text-center text-xs text-slate-500">
              Không có công việc nào cần làm.
            </li>
          )}
        </ul>
      </div>

      {/* Danh sách đã hủy */}
      <div className="glass-card overflow-hidden opacity-90">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
            <span className="text-sm font-semibold text-slate-300">
              Đã hủy / Tạm dừng ({cancelledTasks.length})
            </span>
          </div>
        </div>

        <ul className="divide-y divide-white/5 bg-slate-950/20">
          {cancelledTasks.map((task) => (
            <TaskChecklistRow
              key={task.id}
              task={task}
              projectName={project.name}
              hasEditPermission={hasEditPermission}
              allProfiles={allProfiles}
              onToggle={handleToggleStatus}
              onToggleCancel={handleToggleCancel}
              onUpdateField={handleUpdateField}
              onDelete={handleDeleteLocal}
            />
          ))}
          {cancelledTasks.length === 0 && (
            <li className="px-5 py-6 text-center text-xs text-slate-500">
              Không có công việc nào bị hủy / tạm dừng.
            </li>
          )}
        </ul>
      </div>

      {/* Danh sách đã hoàn thành */}
      <div className="glass-card overflow-hidden opacity-85">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
            <span className="text-sm font-semibold text-slate-400">
              Đã hoàn thành ({completedTasks.length})
            </span>
          </div>
        </div>

        <ul className="divide-y divide-white/5 bg-slate-950/20">
          {completedTasks.map((task) => (
            <TaskChecklistRow
              key={task.id}
              task={task}
              projectName={project.name}
              hasEditPermission={hasEditPermission}
              allProfiles={allProfiles}
              onToggle={handleToggleStatus}
              onToggleCancel={handleToggleCancel}
              onUpdateField={handleUpdateField}
              onDelete={handleDeleteLocal}
            />
          ))}
          {completedTasks.length === 0 && (
            <li className="px-5 py-6 text-center text-xs text-slate-500">
              Chưa có công việc nào được hoàn thành.
            </li>
          )}
        </ul>
      </div>

      {/* Nút thêm công việc mới */}
      {hasEditPermission && (
        <button
          id="checklist-add-task-btn"
          onClick={handleAddTask}
          className="w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/[0.02] active:scale-[0.99] transition-all text-xs font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Thêm công việc mới
        </button>
      )}

      {/* ==========================================
          HỆ THỐNG THẢO LUẬN & NHẬT KÝ CHI TIẾT
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Nhật ký công việc (Trái) */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col min-h-[380px]">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
          
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Nhật ký công việc
            </span>
            
            {canEditWorkLog ? (
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                <button
                  type="button"
                  onClick={() => setLogTab('edit')}
                  className={cn(
                    "text-[10px] font-semibold px-2 py-1 rounded transition-all",
                    logTab === 'edit' ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  Soạn thảo
                </button>
                <button
                  type="button"
                  onClick={() => setLogTab('preview')}
                  className={cn(
                    "text-[10px] font-semibold px-2 py-1 rounded transition-all",
                    logTab === 'preview' ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  Xem trước
                </button>
              </div>
            ) : (
              <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Chỉ xem
              </span>
            )}
          </div>

          {/* Editor & Preview Area */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            {logLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải nhật ký...
              </div>
            ) : canEditWorkLog ? (
              logTab === 'edit' ? (
                <div className="flex-1 flex flex-col gap-2">
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => insertMarkdown('bold')}
                      className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded transition-all"
                      title="In đậm (Bold)"
                    >
                      <Bold size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('italic')}
                      className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded transition-all"
                      title="In nghiêng (Italic)"
                    >
                      <Italic size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('list')}
                      className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded transition-all"
                      title="Danh sách (List)"
                    >
                      <List size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('code')}
                      className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded transition-all"
                      title="Chèn mã code"
                    >
                      <Code size={14} />
                    </button>
                    <span className="flex-1" />
                    {savingLog && (
                      <span className="text-[10px] text-cyan-400 animate-pulse font-medium mr-1.5 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Đang tự động lưu...
                      </span>
                    )}
                  </div>
                  {/* Textarea */}
                  <textarea
                    id="work-log-textarea"
                    value={localWorkLogContent}
                    onChange={(e) => setLocalWorkLogContent(e.target.value)}
                    placeholder="Viết nhật ký công việc tại đây (hỗ trợ Markdown)..."
                    className="flex-1 w-full bg-slate-900/40 border border-slate-800 focus:border-cyan-500/30 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all resize-none leading-relaxed min-h-[160px]"
                  />
                </div>
              ) : (
                <div 
                  className="flex-1 bg-slate-900/20 border border-slate-900/50 rounded-xl p-3 text-sm text-slate-300 leading-relaxed overflow-y-auto max-h-[220px]"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(localWorkLogContent) || '<p class="text-slate-600 italic text-xs">Chưa có nội dung nhật ký.</p>' }}
                />
              )
            ) : (
              <div 
                className="flex-grow bg-slate-900/20 border border-slate-900/50 rounded-xl p-3 text-sm text-slate-400 leading-relaxed overflow-y-auto max-h-[220px]"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(workLog?.content || '') || '<p class="text-slate-600 italic text-xs">Chưa có nội dung nhật ký.</p>' }}
              />
            )}
          </div>

          {/* Footer Info */}
          {workLog && (
            <div className="mt-4 pt-3 border-t border-white/5 flex items-end justify-between">
              <div className="text-[11px] text-slate-500 space-y-1">
                <div>
                  Người chỉnh sửa cuối: <strong className="text-slate-300">{workLog.editor_name || 'N/A'}</strong>
                </div>
                <div>
                  Cập nhật: <span className="text-slate-400">{formatWorkLogDate(workLog.last_edited_at)}</span>
                </div>
              </div>
              
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleViewWorkLogHistory}
                  className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/20 py-1.5 px-2.5 rounded-lg flex items-center gap-1 transition-all"
                >
                  <History size={11} /> Lịch sử chỉnh sửa
                </button>
              )}
            </div>
          )}
        </div>

        {/* Thảo luận & Góp ý (Phải) */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col min-h-[380px] max-h-[480px]">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Thảo luận & Góp ý
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              {messages.length} thảo luận
            </span>
          </div>

          {/* Messages List Area */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 py-1 scrollbar-thin"
          >
            {msgLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải thảo luận...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-600 py-10">
                <span className="text-2xl mb-1">💬</span>
                Chưa có cuộc thảo luận nào. Hãy bắt đầu!
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.author_id === currentUser.id
                const recalled = msg.is_recalled
                
                // Trực quan hóa tin nhắn bị thu hồi
                if (recalled) {
                  // Góc nhìn Admin: Vẫn nhìn thấy tin nhắn mờ kèm nhãn
                  if (isAdmin) {
                    return (
                      <div key={msg.id} className="flex gap-2.5 items-start opacity-45">
                        <div className="w-6 h-6 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-400 select-none flex-shrink-0">
                          {msg.author?.full_name ? msg.author.full_name[0] : 'U'}
                        </div>
                        <div className="flex-1 min-w-0 max-w-[75%]">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs text-slate-400 font-medium">{msg.author?.full_name}</span>
                            <span className="text-[8px] bg-slate-900 border border-slate-700 text-slate-400 px-1 rounded font-bold uppercase select-none">Admin View</span>
                          </div>
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2 text-xs text-slate-500 line-through italic">
                            [Đã thu hồi]: {msg.content || '[Tệp đính kèm]'}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-slate-600">{formatChatTime(msg.created_at)}</span>
                            {isWithin24Hours(msg.recalled_at) && (
                              <button
                                type="button"
                                onClick={() => handleRestoreMessage(msg.id)}
                                className="text-[9px] text-indigo-400 hover:underline flex items-center gap-0.5"
                              >
                                <RotateCcw size={9} /> Khôi phục
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  // Người gửi tin nhắn trong 24h: Hiện nút Khôi phục
                  if (isMine && isWithin24Hours(msg.recalled_at)) {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-500 italic max-w-[75%] flex items-center gap-2">
                          Bạn đã thu hồi tin nhắn.
                          <button
                            type="button"
                            onClick={() => handleRestoreMessage(msg.id)}
                            className="text-indigo-400 hover:text-indigo-300 font-semibold underline not-italic hover:scale-105 active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer"
                          >
                            <RotateCcw size={10} /> Khôi phục
                          </button>
                        </div>
                      </div>
                    )
                  }

                  // Member khác: Ẩn hoàn toàn
                  return null
                }

                // Tin nhắn bình thường
                return (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex gap-2.5 items-start group relative",
                      isMine ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-xs font-bold flex items-center justify-center text-indigo-300 select-none flex-shrink-0">
                      {msg.author?.full_name ? msg.author.full_name[0] : 'U'}
                    </div>

                    {/* Content Block */}
                    <div className={cn("flex flex-col max-w-[75%] min-w-0", isMine ? "items-end" : "items-start")}>
                      {/* Name & Badge */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] text-slate-400 font-medium">{msg.author?.full_name}</span>
                        {msg.author?.role && (
                          <span className={getRoleBadgeStyle(msg.author.role)}>
                            {getRoleLabel(msg.author.role)}
                          </span>
                        )}
                      </div>

                      {/* Message bubble & actions wrapper */}
                      <div className={cn("flex items-center gap-1.5 group/bubble", isMine ? "flex-row-reverse" : "flex-row")}>
                        <div className="relative">
                          {editingMessageId === msg.id ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 min-w-[200px] flex flex-col gap-2">
                              <textarea
                                value={editingMessageText}
                                onChange={(e) => setEditingMessageText(e.target.value)}
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/30 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-700 outline-none transition-all resize-none leading-relaxed"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingMessageId(null)}
                                  className="text-[10px] bg-slate-800 text-slate-400 py-1 px-2 rounded hover:bg-slate-700"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditMessage(msg.id)}
                                  className="text-[10px] bg-indigo-600 text-white py-1 px-2 rounded hover:bg-indigo-500"
                                >
                                  Lưu
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className={cn(
                                "rounded-2xl p-2.5 text-xs leading-relaxed break-words whitespace-pre-wrap select-text",
                                isMine 
                                  ? "bg-indigo-500/10 border border-indigo-500/20 text-slate-100 rounded-tr-none" 
                                  : "bg-slate-900/40 border border-slate-800 text-slate-200 rounded-tl-none"
                              )}
                            >
                              {/* Attachment */}
                              {msg.attachment_url && (
                                <div className="mb-2 max-w-full">
                                  {msg.attachment_type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(msg.attachment_type || '') ? (
                                    <div 
                                      className="cursor-zoom-in rounded-lg overflow-hidden border border-white/5 max-h-[140px] hover:opacity-90 transition-opacity"
                                      onClick={() => setActiveLightboxUrl(msg.attachment_url)}
                                    >
                                      <img 
                                        src={msg.attachment_url} 
                                        alt={msg.attachment_name || 'Hình ảnh'}
                                        className="object-cover w-full h-full max-h-[140px]"
                                      />
                                    </div>
                                  ) : (
                                    <a 
                                      href={msg.attachment_url} 
                                      download={msg.attachment_name}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-white/5 hover:border-indigo-500/30 transition-all group/card max-w-xs"
                                    >
                                      <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400">
                                        <FileText size={16} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-slate-200 truncate group-hover/card:text-indigo-300">
                                          {msg.attachment_name}
                                        </p>
                                        <span className="text-[9px] text-slate-600 block uppercase">
                                          {msg.attachment_type?.split('/').pop() || 'Tài liệu'}
                                        </span>
                                      </div>
                                      <Download size={12} className="text-slate-500 group-hover/card:text-slate-300 flex-shrink-0" />
                                    </a>
                                  )}
                                </div>
                              )}
                              
                              {/* Text content */}
                              {msg.content && <span>{msg.content}</span>}
                            </div>
                          )}
                        </div>

                        {/* Actions menu dropdown */}
                        {!recalled && (isMine || (isAdmin && !!msg.edited_at)) && (
                          <div className="relative flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveDropdownMsgId(activeDropdownMsgId === msg.id ? null : msg.id)
                              }}
                              className="w-5 h-5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-slate-500 hover:text-slate-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-all opacity-80 hover:opacity-100 cursor-pointer"
                              title="Tùy chọn"
                            >
                              <MoreVertical size={11} />
                            </button>
                            
                            {activeDropdownMsgId === msg.id && (
                              <div 
                                className={cn(
                                  "absolute top-6 bg-slate-950 border border-slate-800 rounded-xl p-1 shadow-2xl z-20 min-w-[120px] flex flex-col gap-0.5",
                                  isMine ? "right-0" : "left-0"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Edit */}
                                {isMine && !recalled && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(msg.id)
                                      setEditingMessageText(msg.content || '')
                                      setActiveDropdownMsgId(null)
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-1.5"
                                  >
                                    <Edit2 size={11} /> Sửa
                                  </button>
                                )}
                                {/* Recall */}
                                {isMine && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleRecallMessage(msg.id)
                                      setActiveDropdownMsgId(null)
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Trash2 size={11} /> Thu hồi
                                  </button>
                                )}
                                {/* View message history (Admin only) */}
                                {isAdmin && msg.edited_at && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleViewMessageHistory(msg.id)
                                      setActiveDropdownMsgId(null)
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/5 rounded-lg transition-colors flex items-center gap-1.5"
                                  >
                                    <History size={11} /> Lịch sử sửa
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bubble Time & Status */}
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                        <span>{formatChatTime(msg.created_at)}</span>
                        {msg.edited_at && (
                          <span className="text-slate-600 italic select-none">· Đã chỉnh sửa</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            {/* End of messages */}
          </div>

          {/* Chat input at bottom */}
          <div className="mt-3.5 pt-3.5 border-t border-white/5 flex gap-2 items-center">
            {/* Attachment paperclip */}
            <div>
              <input
                type="file"
                id="discussion-file-input"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingFile}
              />
              <button
                type="button"
                onClick={() => document.getElementById('discussion-file-input')?.click()}
                disabled={uploadingFile}
                className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-indigo-400 flex items-center justify-center active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                title="Đính kèm tài liệu"
              >
                {uploadingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip size={15} />
                )}
              </button>
            </div>

            {/* Input textarea */}
            <input
              type="text"
              placeholder="Nhập nội dung góp ý, thảo luận..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSendMessage(chatInput)
                }
              }}
              className="flex-1 bg-slate-900/60 border border-slate-800 focus:border-indigo-500/30 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
            />

            {/* Send button */}
            <button
              type="button"
              onClick={() => handleSendMessage(chatInput)}
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center active:scale-95 transition-all flex-shrink-0 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Nút lưu checklist đã được chuyển lên đầu trang */}

      {/* ==========================================
          MODALS & OVERLAYS SYSTEM
          ========================================== */}
      
      {/* Lightbox Modal phóng to ảnh */}
      {activeLightboxUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setActiveLightboxUrl(null)}
        >
          <img 
            src={activeLightboxUrl} 
            className="max-w-[90%] max-h-[90%] object-contain rounded shadow-2xl" 
            alt="Phóng to" 
          />
          <button 
            type="button"
            className="absolute top-4 left-4 text-white/80 hover:text-white flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 border border-white/10 px-3.5 py-2 rounded-xl transition-all"
            onClick={() => setActiveLightboxUrl(null)}
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
      )}

      {/* Modal Lịch sử chỉnh sửa Ghi chú/Nhật ký (Chỉ Admin) */}
      {showWorkLogHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-6 shadow-2xl relative border-slate-800">
            <button
              type="button"
              onClick={() => setShowWorkLogHistoryModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 rounded-lg p-1 hover:bg-white/5"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
              <History size={16} className="text-cyan-400" />
              Lịch sử chỉnh sửa Nhật ký công việc
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 scrollbar-thin">
              {workLogHistory.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 italic">
                  Chưa có lịch sử thay đổi nào được ghi nhận.
                </div>
              ) : (
                workLogHistory.map((hist) => (
                  <div key={hist.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>Người sửa: <strong className="text-slate-300">{hist.profiles?.full_name || 'N/A'}</strong></span>
                      <span>Thời gian: {formatWorkLogDate(hist.edited_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Phiên bản trước</p>
                        <div className="bg-slate-950/60 p-2 rounded-lg text-slate-400 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {hist.old_content}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1 font-bold">Phiên bản mới</p>
                        <div className="bg-slate-950/60 p-2 rounded-lg text-slate-200 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {hist.new_content}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Lịch sử chỉnh sửa bình luận thảo luận (Chỉ Admin) */}
      {viewingHistoryMessageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-6 shadow-2xl relative border-slate-800">
            <button
              type="button"
              onClick={() => setViewingHistoryMessageId(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 rounded-lg p-1 hover:bg-white/5"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
              <History size={16} className="text-indigo-400" />
              Lịch sử sửa đổi tin nhắn thảo luận
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 scrollbar-thin">
              {messageHistory.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 italic">
                  Chưa có lịch sử chỉnh sửa nào.
                </div>
              ) : (
                messageHistory.map((hist) => (
                  <div key={hist.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>Người sửa: <strong className="text-slate-300">{hist.profiles?.full_name || 'N/A'}</strong></span>
                      <span>Thời gian: {formatWorkLogDate(hist.edited_at)}</span>
                    </div>
                    <div className="space-y-1.5 pt-1 border-t border-white/5">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Nội dung cũ:</span>
                        <p className="text-slate-400 italic bg-slate-950/40 p-1.5 rounded-md mt-0.5">{hist.old_content}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-indigo-400 font-bold block uppercase">Nội dung mới:</span>
                        <p className="text-slate-200 bg-slate-950/60 p-1.5 rounded-md mt-0.5">{hist.new_content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ---------------------------------------------------------
// Sub-component: Dòng hiển thị checklist công việc
// ---------------------------------------------------------
interface TaskChecklistRowProps {
  task: Task
  projectName: string
  hasEditPermission: boolean
  allProfiles: Profile[]
  onToggle: (id: string) => void
  onToggleCancel: (id: string) => void
  onUpdateField: (
    id: string,
    field: 'title' | 'notes' | 'start_date' | 'deadline' | 'assignee_id',
    value: string | null
  ) => void
  onDelete: (id: string) => void
}

function TaskChecklistRow({
  task,
  projectName,
  hasEditPermission,
  allProfiles,
  onToggle,
  onToggleCancel,
  onUpdateField,
  onDelete,
}: TaskChecklistRowProps) {
  const isDone = task.status === 'done'
  const isCancelled = task.status === 'cancelled'

  // Parse notes to array of string split by '|notes-divider|'
  const noteLines = task.notes ? task.notes.split(NOTE_DIVIDER) : ['']

  return (
    <li
      id={`checklist-task-${task.id}`}
      className={`flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-white/[0.02] ${
        isDone ? 'opacity-70 bg-white/[0.005]' : ''
      } ${isCancelled ? 'opacity-80 bg-red-950/[0.02]' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox (Complete/Incomplete) */}
        <button
          type="button"
          id={`checklist-toggle-${task.id}`}
          onClick={() => hasEditPermission && !isCancelled && onToggle(task.id)}
          disabled={!hasEditPermission || isCancelled}
          className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
            isDone
              ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'border-slate-600 hover:border-cyan-400/80 bg-slate-900/50'
          } ${(!hasEditPermission || isCancelled) ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          title={isCancelled ? 'Công việc đã hủy không thể hoàn thành' : isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
        >
          {isDone && (
            <svg
              className="w-3.5 h-3.5 stroke-[3px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Project Name Badge */}
        <span className="text-[9px] uppercase tracking-wider font-bold bg-cyan-950/60 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-md select-none flex-shrink-0">
          {projectName}
        </span>

        {/* Task Title Input */}
        <div className="flex-1 min-w-0">
          {hasEditPermission ? (
            <input
              id={`checklist-title-input-${task.id}`}
              type="text"
              value={task.title}
              onChange={(e) => onUpdateField(task.id, 'title', e.target.value)}
              placeholder="Nhập tên công việc..."
              disabled={isCancelled || isDone}
              className={`w-full bg-transparent border-b border-transparent focus:border-cyan-500/30 outline-none text-sm text-white py-0.5 transition-all ${
                isDone ? 'line-through text-slate-500' : ''
              } ${isCancelled ? 'line-through text-red-400/70' : ''} ${(isCancelled || isDone) ? 'opacity-85' : ''}`}
            />
          ) : (
            <p
              className={`text-sm font-medium truncate ${
                isDone ? 'line-through text-slate-500' : ''
              } ${isCancelled ? 'line-through text-red-400/70' : 'text-slate-200'}`}
            >
              {task.title || '(Trống)'}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Nút Hủy */}
          {hasEditPermission && (
            <button
              type="button"
              id={`checklist-cancel-${task.id}`}
              onClick={() => onToggleCancel(task.id)}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 active:scale-[0.97] cursor-pointer',
                isCancelled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/20'
              )}
              title={isCancelled ? 'Khôi phục công việc' : 'Hủy công việc'}
            >
              {isCancelled ? 'Khôi phục' : 'Hủy bỏ'}
            </button>
          )}

          {/* Nút xóa */}
          {hasEditPermission && (
            <button
              type="button"
              id={`checklist-delete-${task.id}`}
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn xóa công việc này không?')) {
                  onDelete(task.id)
                }
              }}
              className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-all cursor-pointer"
              title="Xóa công việc"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Details: Notes List, Start Date, End Date, Assignee Dropdown */}
      <div className="pl-8 flex flex-col gap-3 mt-2 border-l border-white/5 pb-1">
        {/* Notes (Multi-row with + icon to add new note row) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-medium">Ghi chú công việc:</span>
            {hasEditPermission && !isCancelled && !isDone && (
              <button
                type="button"
                onClick={() => {
                  const newNotes = [...noteLines, '']
                  onUpdateField(task.id, 'notes', newNotes.join(NOTE_DIVIDER))
                }}
                className="text-cyan-400 hover:text-cyan-300 text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer hover:underline"
              >
                <Plus size={11} /> Thêm dòng ghi chú
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {noteLines.map((note, index) => (
              <div key={index} className="flex items-center gap-2">
                {hasEditPermission ? (
                  <input
                    type="text"
                    value={note}
                    disabled={isCancelled || isDone}
                    onChange={(e) => {
                      const newLines = [...noteLines]
                      newLines[index] = e.target.value
                      onUpdateField(task.id, 'notes', newLines.join(NOTE_DIVIDER))
                    }}
                    placeholder="Ghi chú thêm cho công việc..."
                    className="flex-grow bg-transparent border-b border-white/5 focus:border-cyan-500/20 outline-none text-xs text-slate-400 py-0.5 transition-all placeholder-slate-600 disabled:opacity-60"
                  />
                ) : (
                  <p className="text-xs text-slate-400 italic flex-grow">
                    • {note || '(Ghi chú trống)'}
                  </p>
                )}

                {hasEditPermission && !isCancelled && !isDone && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const newLines = [...noteLines]
                        newLines.splice(index + 1, 0, '')
                        onUpdateField(task.id, 'notes', newLines.join(NOTE_DIVIDER))
                      }}
                      className="text-cyan-500 hover:text-cyan-400 p-0.5 rounded cursor-pointer hover:bg-cyan-500/10 transition-colors"
                      title="Chèn dòng ghi chú ngay dưới dòng này"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    {noteLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newLines = noteLines.filter((_, idx) => idx !== index)
                          onUpdateField(task.id, 'notes', newLines.join(NOTE_DIVIDER))
                        }}
                        className="text-slate-600 hover:text-rose-400 p-0.5 rounded cursor-pointer hover:bg-rose-500/10 transition-colors"
                        title="Xóa dòng ghi chú này"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Date pickers & Assignee Selector */}
        <div className="flex flex-wrap gap-4 items-center pt-1">
          {/* Assignee selector dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Chỉ định:</span>
            {hasEditPermission ? (
              <select
                value={task.assignee_id || ''}
                disabled={isCancelled || isDone}
                onChange={(e) => onUpdateField(task.id, 'assignee_id', e.target.value || null)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 outline-none focus:border-cyan-500/30 disabled:opacity-60 cursor-pointer"
              >
                <option value="">-- Chưa chỉ định --</option>
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role === 'admin' ? 'Admin' : p.role === 'leader' ? 'Leader' : 'Member'})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] text-slate-300">
                {allProfiles.find(p => p.id === task.assignee_id)?.full_name || 'Chưa chỉ định'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Bắt đầu:</span>
            {hasEditPermission ? (
              <input
                type="date"
                value={task.start_date ? task.start_date.substring(0, 10) : ''}
                disabled={isCancelled || isDone}
                onChange={(e) => onUpdateField(task.id, 'start_date', e.target.value || null)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 outline-none focus:border-cyan-500/30 disabled:opacity-60 cursor-pointer"
              />
            ) : (
              <span className="text-[11px] text-slate-300">
                {task.start_date ? task.start_date.substring(0, 10) : 'Chưa đặt'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Kết thúc:</span>
            {hasEditPermission ? (
              <input
                type="date"
                value={task.deadline ? task.deadline.substring(0, 10) : ''}
                disabled={isCancelled || isDone}
                onChange={(e) => onUpdateField(task.id, 'deadline', e.target.value || null)}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 outline-none focus:border-cyan-500/30 disabled:opacity-60 cursor-pointer"
              />
            ) : (
              <span className="text-[11px] text-slate-300">
                {task.deadline ? task.deadline.substring(0, 10) : 'Chưa đặt'}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
