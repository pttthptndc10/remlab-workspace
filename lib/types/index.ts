// =====================================================
// RemLab Workspace - TypeScript Types
// =====================================================

export type UserRole = 'admin' | 'leader' | 'member'

export type ProjectStatus = 'planning' | 'in_progress' | 'review' | 'completed' | 'paused'

export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical'

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type ActivityEntityType = 'task' | 'project' | 'comment' | 'member'

// =====================================================
// Database Types
// =====================================================

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  department: string | null
  bio: string | null
  github_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  deadline: string | null
  status: ProjectStatus
  priority: ProjectPriority
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  creator?: Profile
  members?: ProjectMember[]
  tasks?: Task[]
}

export interface ProjectMember {
  id: string
  project_id: string
  member_id: string
  role: 'leader' | 'member'
  joined_at: string
  // Relations
  member?: Profile
  project?: Project
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  assignee_id: string | null
  deadline: string | null
  status: TaskStatus
  priority: TaskPriority
  progress: number
  notes: string | null
  attachment_url: string | null
  column_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  assignee?: Profile
  project?: Project
  creator?: Profile
  comments?: Comment[]
}

export interface ActivityLog {
  id: string
  actor_id: string | null
  action: string
  entity_type: ActivityEntityType
  entity_id: string | null
  entity_name: string | null
  project_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Relations
  actor?: Profile
  project?: Project
}

export interface Comment {
  id: string
  task_id: string
  author_id: string | null
  content: string
  created_at: string
  updated_at: string
  // Relations
  author?: Profile
}

// =====================================================
// UI / Component Types
// =====================================================

export interface DashboardStats {
  totalProjects: number
  activeProjects: number
  totalTasks: number
  activeTasks: number
  completedTasks: number
  overdueTasks: number
  blockedTasks: number
}

export interface MemberStats {
  profile: Profile
  assignedTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  avgProgress: number
}

export interface KanbanColumn {
  id: TaskStatus
  label: string
  color: string
  tasks: Task[]
}

export interface ProjectWithStats extends Project {
  memberCount: number
  taskCount: number
  completedTaskCount: number
  completionPercentage: number
}

// =====================================================
// Form Types
// =====================================================

export interface CreateProjectForm {
  name: string
  description: string
  deadline: string
  status: ProjectStatus
  priority: ProjectPriority
  memberIds: string[]
}

export interface CreateTaskForm {
  title: string
  description: string
  assignee_id: string
  deadline: string
  status: TaskStatus
  priority: TaskPriority
  progress: number
  notes: string
  attachment_url: string
}

export interface UpdateProfileForm {
  full_name: string
  department: string
  bio: string
  github_url: string
  phone: string
}

// =====================================================
// API Response Types
// =====================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}
